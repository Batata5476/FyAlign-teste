'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  loadDentalGeometry,
  createDentalMaterial,
  DentalMaterialPreset,
} from '@/lib/three/stlLoader';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  Eye,
  Sliders,
  Flame,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export interface StageMeshInfo {
  stageNumber: number;
  upperModelUrl?: string;
  lowerModelUrl?: string;
  upperTriangleCount?: number;
  lowerTriangleCount?: number;
  movements?: any[];
}

interface DentalViewer3DProps {
  maxStages?: number;
  initialStage?: number;
  iprSchedule?: Array<{ teeth: string; amountMm: number; stage: number }>;
  attachmentSchedule?: Array<{ tooth: string; type: string; stage: number }>;
  onStageChange?: (stage: number) => void;
  stagesData?: StageMeshInfo[];
}

export function DentalViewer3D({
  maxStages = 14,
  initialStage = 0,
  iprSchedule = [
    { teeth: '11-21', amountMm: 0.2, stage: 3 },
    { teeth: '31-32', amountMm: 0.2, stage: 2 },
    { teeth: '41-42', amountMm: 0.2, stage: 2 },
  ],
  attachmentSchedule = [
    { tooth: '14', type: 'Retangular Horizontal', stage: 1 },
    { tooth: '24', type: 'Retangular Horizontal', stage: 1 },
    { tooth: '33', type: 'Biselado Oclusal', stage: 2 },
    { tooth: '43', type: 'Biselado Oclusal', stage: 2 },
  ],
  onStageChange,
  stagesData,
}: DentalViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const upperMeshRef = useRef<THREE.Group | null>(null);
  const lowerMeshRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const geometryCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());
  const stageCache = useRef<Map<number, { upperGeom?: THREE.BufferGeometry; lowerGeom?: THREE.BufferGeometry }>>(new Map());

  // Estados Interativos do Player e Câmera
  const [currentStage, setCurrentStage] = useState(initialStage);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.5x, 1x, 2x
  const [visibleArch, setVisibleArch] = useState<'BOTH' | 'UPPER' | 'LOWER'>('BOTH');
  const [bothArchesMode, setBothArchesMode] = useState<'VERTICAL' | 'OCCLUSION' | 'HORIZONTAL'>('HORIZONTAL');
  const [archSpacing, setArchSpacing] = useState<number>(16); // Espaçamento calibrado para visualização desobstruída das arcadas
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAttachments, setShowAttachments] = useState(true);
  const [superpositionMode, setSuperpositionMode] = useState(false);
  const [superpositionOpacity, setSuperpositionOpacity] = useState(0.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'IPR' | 'ATTACHMENTS'>('CONTROLS');
  const [materialPreset, setMaterialPreset] = useState<DentalMaterialPreset>('DENTAL_STONE');
  const [loadingMeshes, setLoadingMeshes] = useState(false);
  const [isUsingRealMesh, setIsUsingRealMesh] = useState(false);
  const [meshStats, setMeshStats] = useState<{ upperTriangles?: number; lowerTriangles?: number }>({});

  // Inicializa Scene, Camera, Lights, OrbitControls
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene com fundo escuro clínico (#161722)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161722);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 80);
    cameraRef.current = camera;

    // 3. Renderer com suporte a alta resolução
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls com rotação suave
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 25;
    controls.maxDistance = 180;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Iluminação Clínica Otimizada
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(30, 45, 60);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6); // Luz azulada secundária
    fillLight.position.set(-40, 20, 30);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(0, -30, -50);
    scene.add(backLight);

    // Render Loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // Atualiza as malhas 3D sempre que o estágio (currentStage) muda (Sprint 1 - Setup Real)
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    let isCancelled = false;

    // Localiza se existem URLs reais para o estágio ativo
    const stageInfo = stagesData?.find((s) => s.stageNumber === currentStage);
    const hasRealUrls = Boolean(stageInfo?.upperModelUrl || stageInfo?.lowerModelUrl);

    // Função interna de carregamento com cache em memória
    const fetchGeometry = async (url: string, cacheKey: string): Promise<THREE.BufferGeometry> => {
      if (geometryCache.current.has(cacheKey)) {
        return geometryCache.current.get(cacheKey)!;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao carregar malha do estágio (${res.status})`);
      const buffer = await res.arrayBuffer();
      const geom = await loadDentalGeometry(buffer, cacheKey);
      geometryCache.current.set(cacheKey, geom);
      return geom;
    };

    async function updateMeshes() {
      // Remove malhas anteriores do palco
      if (upperMeshRef.current) scene.remove(upperMeshRef.current);
      if (lowerMeshRef.current) scene.remove(lowerMeshRef.current);

      if (hasRealUrls) {
        setLoadingMeshes(true);
        setIsUsingRealMesh(true);

        const upperGroup = new THREE.Group();
        const lowerGroup = new THREE.Group();
        let upperTriangles = 0;
        let lowerTriangles = 0;

        try {
          let upperGeom: THREE.BufferGeometry | undefined;
          let lowerGeom: THREE.BufferGeometry | undefined;

          const cached = stageCache.current.get(currentStage);
          if (cached) {
            upperGeom = cached.upperGeom;
            lowerGeom = cached.lowerGeom;
          } else {
            if (stageInfo?.upperModelUrl) {
              upperGeom = await fetchGeometry(stageInfo.upperModelUrl, `stage_${currentStage}_upper.stl`);
            }
            if (stageInfo?.lowerModelUrl) {
              lowerGeom = await fetchGeometry(stageInfo.lowerModelUrl, `stage_${currentStage}_lower.stl`);
            }
            stageCache.current.set(currentStage, { upperGeom, lowerGeom });
          }

          if (isCancelled) return;

          if (upperGeom) {
            const upperMat = createDentalMaterial(materialPreset);
            const upperMesh = new THREE.Mesh(upperGeom, upperMat);
            upperMesh.name = 'PatientRealUpper';
            upperGroup.add(upperMesh);
            upperTriangles = Math.round(upperGeom.attributes.position.count / 3);
          }

          if (lowerGeom) {
            const lowerMat = createDentalMaterial(materialPreset);
            const lowerMesh = new THREE.Mesh(lowerGeom, lowerMat);
            lowerMesh.name = 'PatientRealLower';
            lowerGroup.add(lowerMesh);
            lowerTriangles = Math.round(lowerGeom.attributes.position.count / 3);
          }

          if (isCancelled) return;

          setMeshStats({ upperTriangles, lowerTriangles });
          upperMeshRef.current = upperGroup;
          lowerMeshRef.current = lowerGroup;

          upperGroup.visible = visibleArch === 'BOTH' || visibleArch === 'UPPER';
          lowerGroup.visible = visibleArch === 'BOTH' || visibleArch === 'LOWER';

          // Câmera, iluminação e controles NÃO são resetados
          scene.add(upperGroup);
          scene.add(lowerGroup);
          applyArchTransforms();

          // Pré-carrega estágios vizinhos (currentStage + 1 e currentStage - 1) em memória em background
          const nextStage = stagesData?.find((s) => s.stageNumber === currentStage + 1);
          if (nextStage && !stageCache.current.has(currentStage + 1)) {
            (async () => {
              try {
                const uG = nextStage.upperModelUrl ? await fetchGeometry(nextStage.upperModelUrl, `stage_${currentStage + 1}_upper.stl`) : undefined;
                const lG = nextStage.lowerModelUrl ? await fetchGeometry(nextStage.lowerModelUrl, `stage_${currentStage + 1}_lower.stl`) : undefined;
                stageCache.current.set(currentStage + 1, { upperGeom: uG, lowerGeom: lG });
              } catch {}
            })();
          }

          const prevStage = stagesData?.find((s) => s.stageNumber === currentStage - 1);
          if (prevStage && !stageCache.current.has(currentStage - 1)) {
            (async () => {
              try {
                const uG = prevStage.upperModelUrl ? await fetchGeometry(prevStage.upperModelUrl, `stage_${currentStage - 1}_upper.stl`) : undefined;
                const lG = prevStage.lowerModelUrl ? await fetchGeometry(prevStage.lowerModelUrl, `stage_${currentStage - 1}_lower.stl`) : undefined;
                stageCache.current.set(currentStage - 1, { upperGeom: uG, lowerGeom: lG });
              } catch {}
            })();
          }
        } catch (err) {
          console.error('Falha ao carregar STL real do estágio:', err);
          setIsUsingRealMesh(false);
          setMeshStats({});
        } finally {
          if (!isCancelled) setLoadingMeshes(false);
        }
      } else {
        setIsUsingRealMesh(false);
        setMeshStats({});
      }

      if (onStageChange) onStageChange(currentStage);
    }

    updateMeshes();

    return () => {
      isCancelled = true;
    };
  }, [currentStage, stagesData, materialPreset, onStageChange]);

  // Aplica posicionamento, separação e rotação anatômica das arcadas
  const applyArchTransforms = useCallback(() => {
    const upper = upperMeshRef.current;
    const lower = lowerMeshRef.current;
    if (!upper && !lower) return;

    if (visibleArch === 'UPPER') {
      if (upper) {
        upper.visible = true;
        upper.position.set(0, 0, 0);
        upper.rotation.set(0, 0, 0);
        upper.scale.set(1, 1, 1);
      }
      if (lower) lower.visible = false;
    } else if (visibleArch === 'LOWER') {
      if (upper) upper.visible = false;
      if (lower) {
        lower.visible = true;
        lower.position.set(0, 0, 0);
        lower.rotation.set(0, 0, 0);
        lower.scale.set(1, 1, 1);
      }
    } else {
      // visibleArch === 'BOTH'
      if (upper) upper.visible = true;
      if (lower) lower.visible = true;

      if (bothArchesMode === 'VERTICAL') {
        // Disposição Separada Vertical (Superior acima, Inferior abaixo)
        // Elimina 100% da sobreposição entre os modelos
        const halfGap = (22 + archSpacing) / 2;
        if (upper) {
          upper.position.set(0, halfGap, 0);
          upper.rotation.set(0, 0, 0);
          upper.scale.set(1, 1, 1);
        }
        if (lower) {
          lower.position.set(0, -halfGap, 0);
          lower.rotation.set(0, 0, 0);
          lower.scale.set(1, 1, 1);
        }
      } else if (bothArchesMode === 'HORIZONTAL') {
        // Disposição Lado a Lado (Superior à esquerda, Inferior à direita)
        const halfGap = (46 + archSpacing) / 2;
        if (upper) {
          upper.position.set(-halfGap, 0, 0);
          upper.rotation.set(0, 0, 0);
          upper.scale.set(1, 1, 1);
        }
        if (lower) {
          lower.position.set(halfGap, 0, 0);
          lower.rotation.set(0, 0, 0);
          lower.scale.set(1, 1, 1);
        }
      } else {
        // Modo Oclusão Articulada
        // Cúspides superiores voltadas para as inferiores (mordida em oclusão)
        const halfBite = archSpacing / 2;
        if (lower) {
          lower.position.set(0, 0, -halfBite);
          lower.rotation.set(0, 0, 0);
          lower.scale.set(1, 1, 1);
        }
        if (upper) {
          upper.position.set(0, 0, halfBite);
          upper.rotation.set(Math.PI, 0, 0);
          upper.scale.set(1, 1, 1);
        }
      }
    }
  }, [visibleArch, bothArchesMode, archSpacing]);

  // Atualiza transformações sempre que a arcada visível ou modo de disposição mudar
  useEffect(() => {
    applyArchTransforms();
  }, [applyArchTransforms]);

  // Player Automático de Animação (Play/Pause) (F4.09)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStage((prev) => {
          if (prev >= maxStages) {
            setIsPlaying(false);
            return maxStages;
          }
          return prev + 1;
        });
      }, 800 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxStages, playbackSpeed]);

  const applyHeatmapShader = (group: THREE.Group) => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith('Tooth')) {
        // Material com gradiente de contato oclusal
        child.material = new THREE.MeshStandardMaterial({
          color: 0x10b981, // Verde = contato ideal
          roughness: 0.3,
        });
      }
    });
  };

  const toggleAttachmentsVisibility = (group: THREE.Group, visible: boolean) => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith('Attachment')) {
        child.visible = visible;
      }
    });
  };

  // Vistas Anatômicas Rápidas de Câmera (F4.05)
  const setAnatomicalView = (view: 'FRONTAL' | 'UPPER_OCCLUSAL' | 'LOWER_OCCLUSAL' | 'RIGHT_LATERAL' | 'LEFT_LATERAL') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    controls.target.set(0, 0, 0);

    switch (view) {
      case 'FRONTAL':
        camera.position.set(0, 0, 80);
        break;
      case 'UPPER_OCCLUSAL':
        camera.position.set(0, -75, 20); // Olhando de baixo para cima para a maxila
        break;
      case 'LOWER_OCCLUSAL':
        camera.position.set(0, 75, 20); // Olhando de cima para baixo para a mandíbula
        break;
      case 'RIGHT_LATERAL':
        camera.position.set(-80, 0, 10);
        break;
      case 'LEFT_LATERAL':
        camera.position.set(80, 0, 10);
        break;
    }
    controls.update();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar do Visualizador: Vistas Rápidas & Modos Biomecânicos */}
      <div style={{
        padding: '12px 20px',
        background: 'rgba(10, 23, 42, 0.9)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Vistas Anatômicas Pré-definidas (F4.05) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginRight: '4px' }}>
            Vistas:
          </span>
          {[
            { id: 'FRONTAL', label: 'Frontal' },
            { id: 'UPPER_OCCLUSAL', label: 'Oclusal Sup' },
            { id: 'LOWER_OCCLUSAL', label: 'Oclusal Inf' },
            { id: 'RIGHT_LATERAL', label: 'Lateral D' },
            { id: 'LEFT_LATERAL', label: 'Lateral E' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setAnatomicalView(v.id as any)}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Alternância de Arcada Visível (F4.06) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '6px' }}>
          {(['BOTH', 'UPPER', 'LOWER'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setVisibleArch(mode)}
              style={{
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                background: visibleArch === mode ? 'var(--cyan-primary)' : 'transparent',
                color: visibleArch === mode ? '#05101f' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.74rem',
                cursor: 'pointer'
              }}
            >
              {mode === 'BOTH' ? 'Ambas' : mode === 'UPPER' ? 'Superior' : 'Inferior'}
            </button>
          ))}
        </div>

        {/* Controles de Disposição quando "Ambas" está ativado (evita sobreposição) */}
        {visibleArch === 'BOTH' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)',
              padding: '3px 8px',
              borderRadius: '6px',
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginRight: '2px' }}>
              Disposição:
            </span>
            <button
              type="button"
              onClick={() => setBothArchesMode('VERTICAL')}
              title="Superior acima, Inferior abaixo (sem sobreposição)"
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                background: bothArchesMode === 'VERTICAL' ? 'rgba(0, 210, 211, 0.25)' : 'transparent',
                color: bothArchesMode === 'VERTICAL' ? 'var(--cyan-primary)' : 'var(--text-muted)',
                fontWeight: bothArchesMode === 'VERTICAL' ? 700 : 500,
                fontSize: '0.73rem',
                cursor: 'pointer',
              }}
            >
              Separadas
            </button>
            <button
              type="button"
              onClick={() => setBothArchesMode('HORIZONTAL')}
              title="Superior à esquerda, Inferior à direita"
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                background: bothArchesMode === 'HORIZONTAL' ? 'rgba(0, 210, 211, 0.25)' : 'transparent',
                color: bothArchesMode === 'HORIZONTAL' ? 'var(--cyan-primary)' : 'var(--text-muted)',
                fontWeight: bothArchesMode === 'HORIZONTAL' ? 700 : 500,
                fontSize: '0.73rem',
                cursor: 'pointer',
              }}
            >
              Lado a Lado
            </button>
            <button
              type="button"
              onClick={() => setBothArchesMode('OCCLUSION')}
              title="Mordida articulada em oclusão"
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                background: bothArchesMode === 'OCCLUSION' ? 'rgba(0, 210, 211, 0.25)' : 'transparent',
                color: bothArchesMode === 'OCCLUSION' ? 'var(--cyan-primary)' : 'var(--text-muted)',
                fontWeight: bothArchesMode === 'OCCLUSION' ? 700 : 500,
                fontSize: '0.73rem',
                cursor: 'pointer',
              }}
            >
              Oclusão
            </button>

            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              Espaço: {archSpacing}mm
            </span>
            <input
              type="range"
              min={0}
              max={60}
              step={2}
              value={archSpacing}
              onChange={(e) => setArchSpacing(Number(e.target.value))}
              style={{ width: '60px', accentColor: 'var(--cyan-primary)', cursor: 'pointer' }}
              title="Ajustar distância entre as arcadas"
            />
          </div>
        )}

        {/* Modos Especiais: Material, Attachments, Heatmap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Seletor Gesso / Esmalte */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setMaterialPreset('DENTAL_STONE')}
              style={{
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                background: materialPreset === 'DENTAL_STONE' ? '#2a2e42' : 'transparent',
                color: materialPreset === 'DENTAL_STONE' ? 'var(--cyan-primary)' : '#cbd5e1',
                fontWeight: materialPreset === 'DENTAL_STONE' ? 700 : 500,
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              Gesso
            </button>
            <button
              type="button"
              onClick={() => setMaterialPreset('ENAMEL')}
              style={{
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                background: materialPreset === 'ENAMEL' ? '#2a2e42' : 'transparent',
                color: materialPreset === 'ENAMEL' ? 'var(--cyan-primary)' : '#cbd5e1',
                fontWeight: materialPreset === 'ENAMEL' ? 700 : 500,
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              Esmalte
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className="btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              borderColor: showAttachments ? 'var(--cyan-primary)' : 'var(--border-subtle)',
              color: showAttachments ? 'var(--cyan-primary)' : 'var(--text-muted)'
            }}
          >
            <Sparkles size={13} />
            <span>Attachments</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              borderColor: showHeatmap ? 'var(--emerald-success)' : 'var(--border-subtle)',
              color: showHeatmap ? 'var(--emerald-success)' : 'var(--text-muted)'
            }}
          >
            <Flame size={13} />
            <span>Contatos Oclusais</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Alternar Tela Cheia"
            className="btn-secondary"
            style={{ padding: '6px 8px' }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Canvas 3D Principal */}
      <div style={{ position: 'relative', width: '100%', height: '520px', background: '#161722' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Badge do Estágio Ativo */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          background: 'rgba(10, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          padding: '8px 14px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isUsingRealMesh ? 'var(--emerald-success)' : 'var(--cyan-primary)',
            boxShadow: `0 0 8px ${isUsingRealMesh ? 'var(--emerald-success)' : 'var(--cyan-primary)'}`
          }}></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Estágio Biomecânico
              </span>
              {isUsingRealMesh ? (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {loadingMeshes ? <Loader2 size={10} className="animate-spin" /> : '✓ STL Real CAD'}
                  {meshStats.upperTriangles ? ` • ${(meshStats.upperTriangles + (meshStats.lowerTriangles || 0)).toLocaleString()} triângulos` : ''}
                </span>
              ) : (
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                  Aguardando STL Real
                </span>
              )}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {currentStage === 0 ? 'Posição Inicial (Pré-Tratamento)' : `Alinhador #${currentStage} de ${maxStages}`}
            </div>
          </div>
        </div>

        {/* FPS & WebGL Badge */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          fontSize: '0.72rem',
          color: 'var(--text-dim)',
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          WebGL 2.0 • 60 FPS • Real STL Engine
        </div>

        {/* Overlay limpo caso o estágio atual não possua STL real carregado */}
        {!isUsingRealMesh && !loadingMeshes && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.88)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '24px 32px',
                maxWidth: '460px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Layers size={32} color="var(--cyan-primary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Aguardando Malhas STL do Estágio {currentStage}
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Nenhum modelo fictício é exibido. Para visualizar o caso clínico real, realize o upload dos arquivos
                STL padronizados (<code style={{ color: 'var(--cyan-primary)' }}>stage_{currentStage}_upper.stl</code> e <code style={{ color: 'var(--cyan-primary)' }}>stage_{currentStage}_lower.stl</code>).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Timeline Slider & Controles de Reprodução (F4.09) */}
      <div style={{
        padding: '14px 16px',
        background: 'rgba(10, 23, 42, 0.95)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Botões Play / Pause / Skip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setCurrentStage(0)}
              title="Voltar ao Início"
              className="btn-secondary"
              style={{ padding: '8px' }}
            >
              <RotateCcw size={15} />
            </button>

            <button
              id="btn-prev-stage"
              type="button"
              onClick={() => setCurrentStage((prev) => Math.max(0, prev - 1))}
              disabled={currentStage === 0}
              className="btn-secondary"
              style={{ padding: '8px' }}
            >
              <SkipBack size={15} />
            </button>

            <button
              id="btn-play-pause-stage"
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-primary"
              style={{ width: '40px', height: '40px', borderRadius: '50%', padding: 0 }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
            </button>

            <button
              id="btn-next-stage"
              type="button"
              onClick={() => setCurrentStage((prev) => Math.min(maxStages, prev + 1))}
              disabled={currentStage === maxStages}
              className="btn-secondary"
              style={{ padding: '8px' }}
            >
              <SkipForward size={15} />
            </button>
          </div>

          {/* Slider Contínuo de Estágios */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estágio 0 (Inicial)</span>
              <span style={{ color: 'var(--cyan-primary)', fontWeight: 700 }}>
                Passo {currentStage} ({Math.round((currentStage / maxStages) * 100)}%)
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Estágio {maxStages} (Final)</span>
            </div>
            <input
              id="stage-timeline-slider"
              type="range"
              min={0}
              max={maxStages}
              value={currentStage}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStage(parseInt(e.target.value, 10));
              }}
              style={{
                width: '100%',
                height: '8px',
                accentColor: 'var(--cyan-primary)',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Controle de Velocidade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: playbackSpeed === s ? 'rgba(0, 210, 211, 0.2)' : 'transparent',
                  color: playbackSpeed === s ? 'var(--cyan-primary)' : 'var(--text-dim)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Abas Secundárias: IPR e Attachments */}
        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('IPR')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'IPR' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Tabela de IPR (Desgastes) ({iprSchedule.length})
          </button>

          <span style={{ color: 'var(--border-subtle)' }}>•</span>

          <button
            type="button"
            onClick={() => setActiveTab('ATTACHMENTS')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'ATTACHMENTS' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Acessórios / Attachments ({attachmentSchedule.length})
          </button>
        </div>

        {/* Conteúdo da Aba IPR */}
        {activeTab === 'IPR' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {iprSchedule.map((ipr, idx) => (
                <div key={idx} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--cyan-primary)', fontWeight: 600 }}>Dentes #{ipr.teeth}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Desgaste: <strong>{ipr.amountMm} mm</strong> no Passo {ipr.stage}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conteúdo da Aba Attachments */}
        {activeTab === 'ATTACHMENTS' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {attachmentSchedule.map((att, idx) => (
                <div key={idx} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--cyan-primary)', fontWeight: 600 }}>Dente #{att.tooth}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{att.type} • Passo {att.stage}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

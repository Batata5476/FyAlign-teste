'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createSyntheticDentalArch,
  loadDentalGeometry,
  createDentalMaterial,
  DentalMaterialPreset,
} from '@/lib/three/stlLoader';
import {
  RotateCw,
  RefreshCw,
  Maximize2,
  Minimize2,
  Camera,
  Layers,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface STLModalViewerProps {
  fileName?: string;
  fileSizeBytes?: number;
  slotNumber: number;
  isUpper?: boolean;
  fileUrl?: string;
  fileBlob?: Blob | File;
}

export function STLModalViewer({
  fileName,
  fileSizeBytes,
  slotNumber,
  isUpper = true,
  fileUrl,
  fileBlob,
}: STLModalViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Estados de controle e renderização
  const [autoRotate, setAutoRotate] = useState(false);
  const [materialPreset, setMaterialPreset] = useState<DentalMaterialPreset>('DENTAL_STONE');
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [triangleCount, setTriangleCount] = useState<number | null>(null);
  const [isRealFileLoaded, setIsRealFileLoaded] = useState(false);
  const [activeView, setActiveView] = useState<'OCCLUSAL' | 'FRONTAL' | 'RIGHT' | 'LEFT' | 'LINGUAL'>('OCCLUSAL');

  const isUpperArch = slotNumber === 11 || (slotNumber !== 12 && isUpper);

  // Aplica o material selecionado em todos os meshes do grupo ativo
  const updateMeshMaterials = useCallback((group: THREE.Group, preset: DentalMaterialPreset) => {
    const mat = createDentalMaterial(preset);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Se for um attachment em modo sintético, mantém o destaque
        if (child.name.startsWith('Attachment')) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x00d2d3,
            roughness: 0.3,
            metalness: 0.1,
          });
        } else {
          child.material = mat;
        }
      }
    });
  }, []);

  // Vistas Anatômicas Rápidas (calibradas para o ângulo clínico como na foto de referência)
  const setAnatomicalView = useCallback((view: 'OCCLUSAL' | 'FRONTAL' | 'RIGHT' | 'LEFT' | 'LINGUAL') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    controls.target.set(0, 0, 0);

    setActiveView(view);

    switch (view) {
      case 'OCCLUSAL':
        // Vista Oclusal-Anterior (perspectiva clássica da arcada odontológica, idêntica à foto)
        if (isUpperArch) {
          // Olhando para cima para a maxila
          camera.position.set(0, -38, 48);
        } else {
          // Olhando para baixo para a mandíbula (como na imagem de referência)
          camera.position.set(0, 38, 48);
        }
        break;

      case 'FRONTAL':
        camera.position.set(0, 0, 68);
        break;

      case 'RIGHT':
        camera.position.set(-68, 5, 0);
        break;

      case 'LEFT':
        camera.position.set(68, 5, 0);
        break;

      case 'LINGUAL':
        camera.position.set(0, 10, -68);
        break;
    }

    controls.update();
  }, [isUpperArch]);

  // Inicializa Scene, Lights, WebGLRenderer e Controles
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 380;

    // 1. Scene com fundo escuro elegante clínico (#161722 - padrão da referência fotográfica)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161722);
    sceneRef.current = scene;

    // 2. Camera em perspectiva
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    // Posição inicial: Vista Oclusal angulada da arcada
    camera.position.set(0, isUpperArch ? -38 : 38, 48);
    cameraRef.current = camera;

    // 3. WebGL Renderer de Alta Performance
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Permite capturas de tela em PNG
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls suave
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 15;
    controls.maxDistance = 200;
    controls.target.set(0, 0, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.2;
    controlsRef.current = controls;

    // 5. Configuração de Luzes de Estúdio Odontológico
    const ambientLight = new THREE.AmbientLight(0x353849, 0.9);
    scene.add(ambientLight);

    // Luz principal superior/frontal
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(30, 50, 45);
    scene.add(keyLight);

    // Luz de preenchimento lateral suave
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.6);
    fillLight.position.set(-35, 15, 25);
    scene.add(fillLight);

    // Luz de contorno / silhueta traseira
    const rimLight = new THREE.DirectionalLight(0xa5b4fc, 0.8);
    rimLight.position.set(0, -30, -50);
    scene.add(rimLight);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // 6. Carregamento da Malha 3D (Arquivo Real ou Modelo Anatômico Esculpido)
    let isCancelled = false;

    async function loadMesh() {
      setLoading(true);
      setLoadingError(null);

      try {
        let buffer: ArrayBuffer | null = null;
        let sourceName = fileName || 'model.stl';

        // Tentativa A: Objeto Blob / File local passado diretamente
        if (fileBlob) {
          buffer = await fileBlob.arrayBuffer();
          if ('name' in fileBlob && (fileBlob as File).name) {
            sourceName = (fileBlob as File).name;
          }
        }
        // Tentativa B: URL de download de arquivo já enviado ao servidor
        else if (fileUrl) {
          const res = await fetch(fileUrl);
          if (!res.ok) {
            throw new Error(`Erro ao baixar arquivo 3D (${res.status})`);
          }
          buffer = await res.arrayBuffer();
        }

        if (isCancelled) return;

        // Limpa malhas anteriores do grupo
        while (meshGroup.children.length > 0) {
          const obj = meshGroup.children[0];
          meshGroup.remove(obj);
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
          }
        }

        if (buffer && buffer.byteLength > 0) {
          // Arquivo Real carregado com sucesso
          const geometry = await loadDentalGeometry(buffer, sourceName);
          if (isCancelled) return;

          // Normaliza orientação e escala para enquadramento perfeito
          geometry.computeBoundingSphere();
          const sphere = geometry.boundingSphere;
          const radius = sphere ? sphere.radius : 35;

          const mesh = new THREE.Mesh(geometry, createDentalMaterial(materialPreset));
          mesh.name = 'PatientRealScan';

          // Se a escala do scanner for muito pequena ou gigante (ex: metros ou micrômetros)
          const targetRadius = 32;
          if (radius > 0) {
            const scaleFactor = targetRadius / radius;
            mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
          }

          meshGroup.add(mesh);
          setIsRealFileLoaded(true);

          const triCount = geometry.attributes.position
            ? Math.round(geometry.attributes.position.count / 3)
            : 0;
          setTriangleCount(triCount);
        } else {
          // Fallback: Gera modelo sintético de alta resolução esculpido com dentes anatômicos
          const arch = createSyntheticDentalArch(isUpperArch, 0, 14, true);
          arch.scale.set(1.15, 1.15, 1.15);
          meshGroup.add(arch);
          setIsRealFileLoaded(false);
          setTriangleCount(14 * 294 + 504); // Aproximação de triângulos da malha sintética
        }
      } catch (err: any) {
        console.error('Falha ao processar arquivo 3D:', err);
        if (!isCancelled) {
          setLoadingError(err.message || 'Falha ao processar malha 3D.');
          // Carrega arco anatômico como demonstração de contingência
          const arch = createSyntheticDentalArch(isUpperArch, 0, 14, true);
          arch.scale.set(1.15, 1.15, 1.15);
          meshGroup.add(arch);
          setIsRealFileLoaded(false);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadMesh();

    // 7. Loop de Renderização a 60 FPS
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      renderer.dispose();
      controls.dispose();
    };
  }, [slotNumber, isUpperArch, fileUrl, fileBlob]);

  // Atualiza autoRotate nos controles
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Atualiza material dinamicamente quando o usuário troca o modo
  useEffect(() => {
    if (meshGroupRef.current) {
      updateMeshMaterials(meshGroupRef.current, materialPreset);
    }
  }, [materialPreset, updateMeshMaterials]);

  const resetCamera = () => {
    setAnatomicalView('OCCLUSAL');
  };

  const handleCaptureSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName ? fileName.replace(/\.[^/.]+$/, '') : 'escaneamento_3d'}_captura.png`;
    a.click();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current?.parentElement) return;
    const parent = containerRef.current.parentElement;
    if (!isFullscreen) {
      parent.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '420px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #282a38',
        backgroundColor: '#161722',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      }}
    >
      {/* Canvas Three.js */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
        }}
      />

      {/* Loading Overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(22, 23, 34, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--text-main)',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '3px solid rgba(0, 210, 211, 0.2)',
              borderTopColor: 'var(--cyan-primary)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Processando Malha 3D Odontológica...
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Calculando topografia anatômica e normais de superfície
          </div>
        </div>
      )}

      {/* Top Bar: Identificação Clínica do Escaneamento */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {/* Status Badge */}
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(22, 24, 35, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #2e3144',
            padding: '6px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.78rem',
            color: 'var(--text-main)',
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: isRealFileLoaded ? 'var(--emerald-success)' : 'var(--cyan-primary)',
              boxShadow: isRealFileLoaded
                ? '0 0 10px var(--emerald-success)'
                : '0 0 10px var(--cyan-primary)',
            }}
          />
          <div>
            <span style={{ fontWeight: 600 }}>
              {isUpperArch ? 'Arcada Superior' : 'Arcada Inferior'}
            </span>
            <span style={{ color: 'var(--text-dim)', marginLeft: '6px' }}>
              {isRealFileLoaded
                ? `• Escaneamento do Paciente (${triangleCount?.toLocaleString()} triângulos)`
                : '• Modelo Anatômico de Referência'}
            </span>
          </div>
        </div>

        {/* Seletor de Estilo de Material (Gesso Clínico / Esmalte / Resina / Wireframe) */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(22, 24, 35, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #2e3144',
            padding: '4px',
            borderRadius: '8px',
          }}
        >
          {[
            { id: 'DENTAL_STONE', label: 'Gesso Clínico' },
            { id: 'ENAMEL', label: 'Esmalte' },
            { id: 'RESIN', label: 'Resina' },
            { id: 'WIREFRAME', label: 'Malha' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMaterialPreset(mode.id as DentalMaterialPreset)}
              title={`Modo de Renderização: ${mode.label}`}
              style={{
                padding: '5px 10px',
                borderRadius: '5px',
                border: 'none',
                background: materialPreset === mode.id ? '#2a2e42' : 'transparent',
                color: materialPreset === mode.id ? 'var(--cyan-primary)' : '#cbd5e1',
                fontWeight: materialPreset === mode.id ? 700 : 500,
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Barra Inferior Central: Vistas Anatômicas Pré-definidas */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(22, 24, 35, 0.88)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #2e3144',
          padding: '4px 8px',
          borderRadius: '8px',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginRight: '4px', fontWeight: 600 }}>
          Vista:
        </span>
        {[
          { id: 'OCCLUSAL', label: 'Oclusal' },
          { id: 'FRONTAL', label: 'Frontal' },
          { id: 'RIGHT', label: 'Lat. D' },
          { id: 'LEFT', label: 'Lat. E' },
          { id: 'LINGUAL', label: 'Lingual' },
        ].map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setAnatomicalView(v.id as any)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              background: activeView === v.id ? '#2e334a' : 'transparent',
              color: activeView === v.id ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontSize: '0.72rem',
              fontWeight: activeView === v.id ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Barra Inferior Direita: Ações (Girar, Resetar, Captura PNG, Fullscreen) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          gap: '6px',
          background: 'rgba(22, 24, 35, 0.88)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #2e3144',
          padding: '4px 8px',
          borderRadius: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className="btn-secondary"
          title={autoRotate ? 'Pausar rotação contínua' : 'Ativar rotação automática 360°'}
          style={{
            padding: '5px 8px',
            fontSize: '0.72rem',
            gap: '4px',
            background: autoRotate ? 'rgba(0, 210, 211, 0.15)' : 'transparent',
            color: autoRotate ? 'var(--cyan-primary)' : 'var(--text-muted)',
            borderColor: autoRotate ? 'var(--cyan-primary)' : '#2e3144',
          }}
        >
          <RotateCw size={12} />
          <span>{autoRotate ? 'Girando' : 'Girar'}</span>
        </button>

        <button
          type="button"
          onClick={resetCamera}
          className="btn-secondary"
          title="Centralizar e resetar câmera"
          style={{ padding: '5px 8px', fontSize: '0.72rem', gap: '4px', borderColor: '#2e3144' }}
        >
          <RefreshCw size={12} />
          <span>Resetar</span>
        </button>

        <button
          type="button"
          onClick={handleCaptureSnapshot}
          className="btn-secondary"
          title="Capturar foto em alta definição (PNG)"
          style={{ padding: '5px 8px', fontSize: '0.72rem', borderColor: '#2e3144' }}
        >
          <Camera size={13} />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="btn-secondary"
          title="Alternar Tela Cheia"
          style={{ padding: '5px 8px', fontSize: '0.72rem', borderColor: '#2e3144' }}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
}

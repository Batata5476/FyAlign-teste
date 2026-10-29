import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

/**
 * Parser de alta performance de arquivos STL (Binário e ASCII) para Three.js BufferGeometry (F4.02)
 */
export function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const isBinary = checkIfBinary(buffer);
  return isBinary ? parseBinarySTL(buffer) : parseAsciiSTL(buffer);
}

function checkIfBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const reader = new DataView(buffer);
  const numTriangles = reader.getUint32(80, true);
  const expectedSize = 84 + numTriangles * 50;
  return buffer.byteLength === expectedSize;
}

function parseBinarySTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const reader = new DataView(buffer);
  const numTriangles = reader.getUint32(80, true);
  const positions = new Float32Array(numTriangles * 3 * 3);
  const normals = new Float32Array(numTriangles * 3 * 3);

  let offset = 84;
  let posIdx = 0;
  let normIdx = 0;

  for (let i = 0; i < numTriangles; i++) {
    const nx = reader.getFloat32(offset, true);
    const ny = reader.getFloat32(offset + 4, true);
    const nz = reader.getFloat32(offset + 8, true);
    offset += 12;

    for (let j = 0; j < 3; j++) {
      const vx = reader.getFloat32(offset, true);
      const vy = reader.getFloat32(offset + 4, true);
      const vz = reader.getFloat32(offset + 8, true);
      offset += 12;

      positions[posIdx++] = vx;
      positions[posIdx++] = vy;
      positions[posIdx++] = vz;

      normals[normIdx++] = nx;
      normals[normIdx++] = ny;
      normals[normIdx++] = nz;
    }

    offset += 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function parseAsciiSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const text = new TextDecoder().decode(buffer);
  const vertexPattern = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;

  const vertices: number[] = [];
  let match;
  while ((match = vertexPattern.exec(text)) !== null) {
    vertices.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Loader universal para arquivos odontológicos (.STL, .PLY, .OBJ)
 * Centraliza geometria e normaliza orientação para a área clínica
 */
export async function loadDentalGeometry(
  buffer: ArrayBuffer,
  fileName: string = 'model.stl'
): Promise<THREE.BufferGeometry> {
  const lowerName = fileName.toLowerCase();

  let geometry: THREE.BufferGeometry;

  if (lowerName.endsWith('.ply')) {
    const plyLoader = new PLYLoader();
    geometry = plyLoader.parse(buffer);
  } else if (lowerName.endsWith('.obj')) {
    const text = new TextDecoder().decode(buffer);
    const objLoader = new OBJLoader();
    const group = objLoader.parse(text);
    const geometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        geometries.push(child.geometry.clone());
      }
    });
    if (geometries.length > 0) {
      geometry = geometries[0];
    } else {
      throw new Error('Nenhuma malha 3D encontrada no arquivo OBJ.');
    }
  } else {
    // STL (Padrão) - tenta STLLoader do Three.js com fallback para parser local
    try {
      const stlLoader = new STLLoader();
      geometry = stlLoader.parse(buffer);
    } catch {
      geometry = parseSTL(buffer);
    }
  }

  geometry.computeVertexNormals();
  geometry.center();
  geometry.computeBoundingBox();

  return geometry;
}

let cachedMatCap: THREE.DataTexture | null = null;

/**
 * Gera textura MatCap procedural em alta resolução emulando o gesso odontológico / dental stone (F4.03)
 * Reproduz o acabamento fosco cinza-ardósia com sombreamento escuro em fissuras e sulcos oclusais.
 */
export function getDentalMatCapTexture(): THREE.DataTexture {
  if (cachedMatCap) return cachedMatCap;

  const size = 256;
  const data = new Uint8Array(size * size * 4);

  // Vetor de luz clínica vindo de cima/frente/direita
  const lx = 0.32;
  const ly = 0.52;
  const lz = 0.79;
  const lenL = Math.sqrt(lx * lx + ly * ly + lz * lz);
  const nlx = lx / lenL;
  const nly = ly / lenL;
  const nlz = lz / lenL;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Normalização (-1 a +1)
      const u = (x / (size - 1)) * 2 - 1;
      const v = -((y / (size - 1)) * 2 - 1);
      const mag = u * u + v * v;
      const idx = (y * size + x) * 4;

      if (mag > 1.0) {
        // Fora da esfera: cor de fundo sutil
        data[idx] = 23;
        data[idx + 1] = 24;
        data[idx + 2] = 34;
        data[idx + 3] = 255;
      } else {
        const z = Math.sqrt(1.0 - mag);

        // Difusa Lambert
        const dot = Math.max(0, u * nlx + v * nly + z * nlz);

        // Destaque especular suave em cristas marginais e cúspides
        const hx = nlx;
        const hy = nly;
        const hz = nlz + 1.0;
        const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
        const nhx = hx / hLen;
        const nhy = hy / hLen;
        const nhz = hz / hLen;
        const nDotH = Math.max(0, u * nhx + v * nhy + z * nhz);
        const spec = Math.pow(nDotH, 18) * 0.38;

        // Oclusão de borda e sulcos (escurece depressões interproximais e cavidades)
        const cavityFactor = Math.pow(z, 0.42);
        const rim = Math.pow(1.0 - z, 3.5) * 0.15;

        // Tom base do gesso odontológico: cinza ardósia neutro (RGB: 122, 126, 144)
        const baseR = 122;
        const baseG = 126;
        const baseB = 144;

        const lighting = (0.26 + 0.74 * dot) * cavityFactor;
        const r = Math.min(255, Math.floor(baseR * lighting + spec * 220 + rim * 45));
        const g = Math.min(255, Math.floor(baseG * lighting + spec * 220 + rim * 48));
        const b = Math.min(255, Math.floor(baseB * lighting + spec * 220 + rim * 55));

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  cachedMatCap = texture;
  return texture;
}

export type DentalMaterialPreset = 'DENTAL_STONE' | 'ENAMEL' | 'RESIN' | 'WIREFRAME' | 'HEATMAP';

/**
 * Cria materiais clínicos de alta fidelidade
 */
export function createDentalMaterial(
  preset: DentalMaterialPreset = 'DENTAL_STONE',
  options?: { wireframe?: boolean }
): THREE.Material {
  if (options?.wireframe || preset === 'WIREFRAME') {
    return new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      wireframe: true,
    });
  }

  switch (preset) {
    case 'DENTAL_STONE': {
      // Estilo Gesso Anatômico Odontológico (Idêntico ao software clínico de referência)
      return new THREE.MeshMatcapMaterial({
        matcap: getDentalMatCapTexture(),
        flatShading: false,
      });
    }

    case 'ENAMEL': {
      // Esmalte dental natural com transluscência
      return new THREE.MeshPhysicalMaterial({
        color: 0xf1f3f7,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.15,
        transmission: 0.12,
        ior: 1.54,
      });
    }

    case 'RESIN': {
      // Resina composta CAD/CAM
      return new THREE.MeshStandardMaterial({
        color: 0xdfdad2,
        roughness: 0.45,
        metalness: 0.05,
      });
    }

    case 'HEATMAP': {
      return new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.3,
        metalness: 0.05,
      });
    }

    default:
      return new THREE.MeshMatcapMaterial({
        matcap: getDentalMatCapTexture(),
      });
  }
}

/**
 * Cria geometria anatômica com relevo de cúspides e fossa oclusal
 */
function createAnatomicalToothGeometry(
  type: 'molar' | 'canine' | 'incisor' | 'premolar',
  scaleX: number,
  scaleY: number,
  scaleZ: number
): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(scaleX, scaleY, scaleZ, 6, 6, 6);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = v.y / (scaleY * 0.5);
    const nx = v.x / (scaleX * 0.5);
    const nz = v.z / (scaleZ * 0.5);

    if (type === 'molar' || type === 'premolar') {
      if (ny < 0) {
        // Taper cervical
        const factor = 1.0 + ny * 0.22;
        v.x *= factor;
        v.z *= factor;
      } else {
        // Anatomia oclusal: cúspides periféricas elevadas e depressão do sulco central
        const centralFossa = Math.exp(-(nx * nx * 3.5 + nz * nz * 3.5)) * 0.35;
        const cuspElevation = Math.abs(nx * nz) * 0.45;
        v.y += (cuspElevation - centralFossa) * (scaleY * 0.28);
      }
    } else if (type === 'incisor') {
      if (ny > 0) {
        // Bordo incisicvo mais afilado e largo
        v.z *= Math.max(0.25, 1.0 - ny * 0.65);
        v.x *= 1.0 + ny * 0.12;
      } else {
        v.x *= 1.0 + ny * 0.18;
        v.z *= 1.0 + ny * 0.14;
      }
    } else if (type === 'canine') {
      if (ny > 0) {
        const peak = Math.max(0, 1.0 - Math.sqrt(nx * nx + nz * nz));
        v.y += peak * (scaleY * 0.25);
        v.z *= Math.max(0.4, 1.0 - ny * 0.4);
      }
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Gerador de Malha Odontológica Sintética Realista para Casos e Demonstrações de Alinhadores
 * Cria arcada maxilar/mandibular com dentes anatômicos individualizados (F4.01, F4.08)
 */
export function createSyntheticDentalArch(
  isUpper = true,
  stageIndex = 0,
  maxStages = 14,
  useStoneMaterial = true
): THREE.Group {
  const group = new THREE.Group();
  group.name = isUpper ? 'UpperArch' : 'LowerArch';

  const progress = stageIndex / maxStages;
  const yOffset = isUpper ? 8 : -8;
  const invertZ = isUpper ? 1 : 1;

  // Material de dentes: Gesso Anatômico Clínico (estilo da referência) ou Esmalte
  const toothMaterial = useStoneMaterial
    ? createDentalMaterial('DENTAL_STONE')
    : createDentalMaterial('ENAMEL');

  // Material da base alveolar / gengiva em tom de gesso integrado
  const gingivaMaterial = useStoneMaterial
    ? createDentalMaterial('DENTAL_STONE')
    : new THREE.MeshStandardMaterial({
        color: 0xc87882,
        roughness: 0.6,
        metalness: 0.0,
      });

  // 1. Cria arco gengival anatômico contínuo
  const curvePoints: THREE.Vector3[] = [];
  const archRadiusX = 26;
  const archRadiusZ = 30;

  for (let i = 0; i <= 24; i++) {
    const angle = (i / 24) * Math.PI;
    const x = Math.cos(angle) * archRadiusX;
    const z = Math.sin(angle) * archRadiusZ * invertZ - (isUpper ? 10 : 10);
    curvePoints.push(new THREE.Vector3(x, yOffset + (isUpper ? -3 : 3), z));
  }

  const archCurve = new THREE.CatmullRomCurve3(curvePoints);
  const gingivaGeometry = new THREE.TubeGeometry(archCurve, 36, 4.8, 14, false);
  const gingivaMesh = new THREE.Mesh(gingivaGeometry, gingivaMaterial);
  gingivaMesh.name = 'Gingiva';
  group.add(gingivaMesh);

  // 2. Cria 14 dentes anatômicos individualizados ao longo do arco
  const teethCount = 14;
  for (let i = 0; i < teethCount; i++) {
    const t = 0.08 + (i / (teethCount - 1)) * 0.84;
    const point = archCurve.getPoint(t);
    const tangent = archCurve.getTangent(t);

    const isMolar = i <= 2 || i >= 11;
    const isPremolar = i === 3 || i === 10;
    const isCanine = i === 4 || i === 9;
    const isCentralIncisor = i === 6 || i === 7;

    const scaleX = isMolar ? 4.5 : isPremolar ? 3.8 : isCanine ? 3.5 : isCentralIncisor ? 3.8 : 3.0;
    const scaleY = isMolar ? 5.0 : isPremolar ? 5.5 : isCanine ? 6.5 : isCentralIncisor ? 6.0 : 5.0;
    const scaleZ = isMolar ? 5.5 : isPremolar ? 4.2 : isCanine ? 3.5 : isCentralIncisor ? 2.8 : 3.0;

    const toothType = isMolar ? 'molar' : isPremolar ? 'premolar' : isCanine ? 'canine' : 'incisor';

    // Simulação de movimentação ortodôntica ao longo dos estágios
    const initialMisalignment = Math.sin(i * 1.8) * 2.2 * (1 - progress);
    const toothPosY = point.y + (isUpper ? 2.5 : -2.5);
    const toothPosZ = point.z + initialMisalignment;

    const toothGeometry = createAnatomicalToothGeometry(toothType, scaleX, scaleY, scaleZ);
    const toothMesh = new THREE.Mesh(toothGeometry, toothMaterial);
    toothMesh.position.set(point.x, toothPosY, toothPosZ);

    // Orienta dente tangencialmente à arcada
    const angle = Math.atan2(tangent.x, tangent.z);
    toothMesh.rotation.y = angle;

    toothMesh.name = `Tooth_${isUpper ? 'U' : 'L'}_${i + 1}`;
    group.add(toothMesh);

    // 3. Attachments em resina composta em dentes selecionados (F4.11)
    if ((isUpper && (i === 3 || i === 10)) || (!isUpper && (i === 4 || i === 9))) {
      const attachGeometry = new THREE.BoxGeometry(1.4, 2.0, 1.2);
      const attachMaterial = new THREE.MeshStandardMaterial({
        color: 0x00d2d3,
        roughness: 0.3,
        metalness: 0.1,
      });
      const attachMesh = new THREE.Mesh(attachGeometry, attachMaterial);
      attachMesh.position.set(point.x, toothPosY, toothPosZ + (isUpper ? 2.2 : 2.2));
      attachMesh.rotation.y = angle;
      attachMesh.name = `Attachment_${toothMesh.name}`;
      group.add(attachMesh);
    }
  }

  return group;
}

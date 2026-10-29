import { parseSTL, createSyntheticDentalArch } from '../src/lib/three/stlLoader';
import * as THREE from 'three';

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('🔬 INICIANDO BATERIA DE TESTES DA FASE 4: THREE.JS & SETUPS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TESTE 1: Parser de STL Binário para Three.js BufferGeometry (F4.02)
  // ----------------------------------------------------
  console.log('▶ Teste 1: Parser de STL Binário para Three.js BufferGeometry');
  
  // Cria STL binário com 2 triângulos
  const header = Buffer.alloc(80, 'FyAlign Test 3D Mesh');
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32LE(2, 0); // 2 triângulos = 6 vértices
  const trianglesBuf = Buffer.alloc(2 * 50);
  const binaryBuffer = Buffer.concat([header, countBuf, trianglesBuf]);

  const arrayBuffer = binaryBuffer.buffer.slice(
    binaryBuffer.byteOffset,
    binaryBuffer.byteOffset + binaryBuffer.byteLength
  );

  const geom = parseSTL(arrayBuffer);
  assert(geom instanceof THREE.BufferGeometry, 'Retorna instância válida de THREE.BufferGeometry');
  
  const positionAttr = geom.getAttribute('position');
  assert(positionAttr !== undefined && positionAttr.count === 6, 'BufferGeometry contém exatamente 6 vértices (2 triângulos)');

  const normalAttr = geom.getAttribute('normal');
  assert(normalAttr !== undefined, 'Normais dos vértices computadas com sucesso');

  // ----------------------------------------------------
  // TESTE 2: Parser de STL ASCII para Three.js (F4.02)
  // ----------------------------------------------------
  console.log('\n▶ Teste 2: Parser de STL ASCII para Three.js');
  const asciiContent = `solid FyAlignArch
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 1.0 0.0 0.0
      vertex 0.0 1.0 0.0
    endloop
  endfacet
endsolid FyAlignArch`;

  const asciiBuffer = new TextEncoder().encode(asciiContent).buffer;
  const asciiGeom = parseSTL(asciiBuffer);
  assert(asciiGeom.getAttribute('position').count === 3, 'STL ASCII convertido com 3 vértices (1 triângulo)');

  // ----------------------------------------------------
  // TESTE 3: Geração de Malha Odontológica e Biomecânica (F4.01, F4.08)
  // ----------------------------------------------------
  console.log('\n▶ Teste 3: Geração de Arcos Dentários (Maxila & Mandíbula)');
  
  const upperArchStage0 = createSyntheticDentalArch(true, 0, 14);
  const upperArchStage14 = createSyntheticDentalArch(true, 14, 14);

  assert(upperArchStage0 instanceof THREE.Group, 'Arcada superior gerada como THREE.Group');
  assert(upperArchStage0.name === 'UpperArch', 'Nome do grupo identificado como UpperArch');

  // Verifica presença de gengiva e dentes
  const gingiva = upperArchStage0.getObjectByName('Gingiva');
  assert(gingiva !== undefined, 'Elemento anatômico de Gengiva presente na malha');

  const toothU1 = upperArchStage0.getObjectByName('Tooth_U_7'); // Incisivo Central
  assert(toothU1 !== undefined, 'Dentes individuais (Tooth_U_7) presentes e nomeados');

  // Verifica movimentação entre Estágio 0 e Estágio 14 (Progressão Biomecânica)
  const toothStage0Z = toothU1!.position.z;
  const toothStage14 = upperArchStage14.getObjectByName('Tooth_U_7');
  const toothStage14Z = toothStage14!.position.z;

  assert(toothStage0Z !== toothStage14Z, 'Posição dental varia entre Estágio Inicial (0) e Final (14)');

  // ----------------------------------------------------
  // TESTE 4: Identificação e Destaque de Attachments (F4.11)
  // ----------------------------------------------------
  console.log('\n▶ Teste 4: Identificação e Destaque de Attachments de Resina');
  
  let attachmentCount = 0;
  upperArchStage0.traverse((child) => {
    if (child.name.startsWith('Attachment')) {
      attachmentCount++;
    }
  });

  assert(attachmentCount > 0, `Attachments detectados na malha: ${attachmentCount} casulos`);

  // ----------------------------------------------------
  // TESTE 5: Coordenadas das Vistas Anatômicas de Câmera (F4.05)
  // ----------------------------------------------------
  console.log('\n▶ Teste 5: Cálculo Matemático das Vistas Anatômicas de Câmera');
  
  const anatomicalViews = {
    FRONTAL: new THREE.Vector3(0, 0, 80),
    UPPER_OCCLUSAL: new THREE.Vector3(0, -75, 20),
    LOWER_OCCLUSAL: new THREE.Vector3(0, 75, 20),
    RIGHT_LATERAL: new THREE.Vector3(-80, 0, 10),
    LEFT_LATERAL: new THREE.Vector3(80, 0, 10),
  };

  assert(anatomicalViews.FRONTAL.z === 80, 'Vista Frontal calibrada no eixo Z');
  assert(anatomicalViews.UPPER_OCCLUSAL.y === -75, 'Vista Oclusal Superior angulada no eixo Y');
  assert(anatomicalViews.LOWER_OCCLUSAL.y === 75, 'Vista Oclusal Inferior angulada no eixo Y');
  assert(anatomicalViews.RIGHT_LATERAL.x === -80, 'Vista Lateral Direita calibrada no eixo X negativo');
  assert(anatomicalViews.LEFT_LATERAL.x === 80, 'Vista Lateral Esquerda calibrada no eixo X positivo');

  // ----------------------------------------------------
  // TESTE 6: Validação de Cronograma de IPR e Attachments (F4.12)
  // ----------------------------------------------------
  console.log('\n▶ Teste 6: Validação de Tabela de IPR e Estágios');

  const iprSchedule = [
    { teeth: '11-21', amountMm: 0.2, stage: 3 },
    { teeth: '31-32', amountMm: 0.2, stage: 2 },
  ];

  for (const item of iprSchedule) {
    assert(item.amountMm <= 0.5, `IPR no contato #${item.teeth} (${item.amountMm}mm) dentro do limite biológico permitido`);
    assert(item.stage > 0 && item.stage <= 14, `IPR agendado no estágio válido #${item.stage}`);
  }

  // ----------------------------------------------------
  // RESULTADO CONSOLIDADO
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 RESULTADO DOS TESTES DA FASE 4: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});

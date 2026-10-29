import { strict as assert } from 'assert';
import { prisma } from '../src/lib/prisma';
import {
  ToothMovementSchema,
  SetupStageDataSchema,
  ClinicalSetupSchema,
} from '../src/lib/types/setup';
import {
  parseStageFileName,
  analyzeStageFiles,
} from '../src/lib/three/stageParser';
import fs from 'fs';
import path from 'path';

async function runSprint1Tests() {
  console.log('====================================================');
  console.log('🔬 TESTES DO SPRINT 1: SETUP CONTRACT & ESTÁGIOS REAIS');
  console.log('====================================================');

  // ----------------------------------------------------
  // TESTE 1: Validação do SetupContract com Zod
  // ----------------------------------------------------
  console.log('\n▶ Teste 1: Validação do Contrato Canônico (SetupContract)');

  // 1.1 ToothMovement válido
  const validMovement = ToothMovementSchema.safeParse({
    toothFdi: '21',
    translationMm: { x: 0.2, y: -0.1, z: 0.5 },
    rotationDeg: { x: 1.5, y: -0.8, z: 2.1 },
  });
  assert(validMovement.success, 'ToothMovement válido aceito pelo schema');
  console.log('  ✅ PASS: ToothMovement válido aceito (#21)');

  // 1.2 Dente FDI inválido rejeitado
  const invalidMovement = ToothMovementSchema.safeParse({
    toothFdi: '99', // FDI só vai de 11 a 48
    translationMm: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
  });
  assert(!invalidMovement.success, 'Dente FDI 99 deve ser rejeitado');
  console.log('  ✅ PASS: Dente FDI inválido (#99) rejeitado pelo Zod');

  // 1.3 SetupStageData guarda storageKey (não URL persistida no banco)
  const validStage = SetupStageDataSchema.safeParse({
    stageNumber: 0,
    upperStorageKey: 'clinics/123/cases/456/stage_0_upper_uuid.stl',
    lowerStorageKey: 'clinics/123/cases/456/stage_0_lower_uuid.stl',
    movements: [validMovement.data!],
  });
  assert(validStage.success, 'SetupStageData com storageKey validado com sucesso');
  assert(validStage.data?.upperStorageKey?.endsWith('.stl'), 'Armazena chave de storage no padrão de arquivo');
  console.log('  ✅ PASS: SetupStageData valida storageKeys sem persistir URLs temporárias');

  // ----------------------------------------------------
  // TESTE 2: Parser de Arquivos Multi-STL do Planner
  // ----------------------------------------------------
  console.log('\n▶ Teste 2: Parser e Validação de Nomenclatura de Estágios');

  // 2.1 Reconhecimento de nomes válidos (formato canônico e formato CAD compacto)
  const file1 = parseStageFileName('1-I-.stl', 21600000);
  assert.strictEqual(file1?.stageNumber, 1, '1-I-.stl deve ser estágio 1');
  assert.strictEqual(file1?.arch, 'LOWER', '1-I-.stl deve ser LOWER');

  const file2 = parseStageFileName('1-S-.stl', 21600000);
  assert.strictEqual(file2?.stageNumber, 1, '1-S-.stl deve ser estágio 1');
  assert.strictEqual(file2?.arch, 'UPPER', '1-S-.stl deve ser UPPER');

  const file3 = parseStageFileName('12-I-.stl', 21600000);
  assert.strictEqual(file3?.stageNumber, 12, '12-I-.stl deve ser estágio 12');
  assert.strictEqual(file3?.arch, 'LOWER', '12-I-.stl deve ser LOWER');

  const file4 = parseStageFileName('12-S-.stl', 21600000);
  assert.strictEqual(file4?.stageNumber, 12, '12-S-.stl deve ser estágio 12');
  assert.strictEqual(file4?.arch, 'UPPER', '12-S-.stl deve ser UPPER');

  const file5 = parseStageFileName('stage_0_lower.stl', 15000000);
  assert.strictEqual(file5?.stageNumber, 0, 'stage_0_lower.stl deve ser estágio 0');
  assert.strictEqual(file5?.arch, 'LOWER', 'stage_0_lower.stl deve ser LOWER');

  const file6 = parseStageFileName('stage_0_upper.stl', 15000000);
  assert.strictEqual(file6?.stageNumber, 0, 'stage_0_upper.stl deve ser estágio 0');
  assert.strictEqual(file6?.arch, 'UPPER', 'stage_0_upper.stl deve ser UPPER');

  const fileInvalid = parseStageFileName('arquivo-aleatorio.stl', 1000);
  assert.strictEqual(fileInvalid, null, 'arquivo-aleatorio.stl deve ser rejeitado como inválido');
  console.log('  ✅ PASS: Nomenclatura CAD (1-I-, 1-S-, 12-I-, 12-S-) e canônica validadas');

  // 2.2 Análise de lote completo (Estágio 0 e Estágio 1 completos)
  const testFiles = [
    { name: 'stage_0_upper.stl', size: 1000 },
    { name: 'stage_0_lower.stl', size: 1000 },
    { name: 'stage_1_upper.stl', size: 1000 },
    { name: 'stage_1_lower.stl', size: 1000 },
  ];
  const batchResult = analyzeStageFiles(testFiles);
  assert(batchResult.isValid, 'Lote com Estágio 0 e 1 completo é válido');
  assert(batchResult.stages.size === 2, '2 estágios identificados');
  assert(batchResult.stages.get(0)?.isComplete, 'Estágio 0 possui par superior e inferior completo');
  assert(batchResult.stages.get(1)?.isComplete, 'Estágio 1 possui par superior e inferior completo');
  console.log('  ✅ PASS: Análise de lote de múltiplos STLs valida Estágio 0 e Estágio 1');

  // 2.3 Detecção de arquivo ausente
  const incompleteFiles = [
    { name: 'stage_0_upper.stl', size: 1000 },
    { name: 'stage_0_lower.stl', size: 1000 },
    { name: 'stage_1_upper.stl', size: 1000 },
    // Faltando stage_1_lower.stl
  ];
  const incompleteResult = analyzeStageFiles(incompleteFiles);
  assert(!incompleteResult.isValid, 'Lote incompleto deve ser detectado como inválido');
  assert(
    incompleteResult.missingFiles.some((m) => m.toLowerCase().includes('inferior') || m.toLowerCase().includes('lower')),
    'Detectou ausência de arcada inferior no estágio 1'
  );
  console.log('  ✅ PASS: Detecção clara de erro para arquivos de estágios ausentes');

  // 2.4 Validação de lote real do software CAD (12 arquivos, 6 pares de estágio iniciando no estágio 1)
  const cadFiles12 = [
    { name: '1-S-.stl', size: 21500000 },
    { name: '1-I-.stl', size: 21600000 },
    { name: '2-S-.stl', size: 21500000 },
    { name: '2-I-.stl', size: 21600000 },
    { name: '3-S-.stl', size: 21400000 },
    { name: '3-I-.stl', size: 21500000 },
    { name: '4-S-.stl', size: 21600000 },
    { name: '4-I-.stl', size: 21600000 },
    { name: '5-S-.stl', size: 21500000 },
    { name: '5-I-.stl', size: 21500000 },
    { name: '6-S-.stl', size: 21600000 },
    { name: '6-I-.stl', size: 21600000 },
  ];
  const cadAnalysis = analyzeStageFiles(cadFiles12);
  assert.strictEqual(cadAnalysis.isValid, true, 'Lote CAD de 12 arquivos deve ser válido');
  assert.strictEqual(cadAnalysis.totalStagesDetected, 6, '6 estágios detectados');
  assert.strictEqual(cadAnalysis.totalCompletePairs, 6, '6 pares completos');
  assert.strictEqual(cadAnalysis.unrecognizedFiles.length, 0, '0 arquivos não reconhecidos');
  assert(cadAnalysis.warnings.some((w) => w.includes('Estágio 1')), 'Aviso de início no estágio 1 presente');
  console.log('  ✅ PASS: Lote CAD com 12 arquivos (6 pares completos, estágios 1 a 6) validado com sucesso');
  console.log('\n▶ Teste 3: Persistência de Setup com Estágios e StorageKeys');

  const sampleCase = await prisma.case.findFirst({
    include: { setups: true },
  });
  if (!sampleCase) throw new Error('Nenhum caso clínico encontrado no banco');

  // Cria um setup de teste com Estágio 0 e Estágio 1 reais
  const testSetup = await prisma.setup.create({
    data: {
      caseId: sampleCase.id,
      versionNumber: 99, // Versão de teste
      status: 'PUBLISHED',
      upperAlignersCount: 2,
      lowerAlignersCount: 2,
      plannerComments: 'Setup de teste Sprint 1 com STLs reais',
      stages: {
        create: [
          {
            stageIndex: 0,
            upperMeshStorageKey: 'test/stages/stage_0_upper.stl',
            lowerMeshStorageKey: 'test/stages/stage_0_lower.stl',
            toothTransformMatrices: JSON.stringify([{ toothFdi: '11', translationMm: { x: 0, y: 0, z: 0 } }]),
          },
          {
            stageIndex: 1,
            upperMeshStorageKey: 'test/stages/stage_1_upper.stl',
            lowerMeshStorageKey: 'test/stages/stage_1_lower.stl',
            toothTransformMatrices: JSON.stringify([{ toothFdi: '11', translationMm: { x: 0.2, y: 0, z: 0.1 } }]),
          },
        ],
      },
    },
    include: { stages: true },
  });

  assert(testSetup.stages.length === 2, '2 estágios criados no banco de dados');
  assert(testSetup.stages[0].upperMeshStorageKey === 'test/stages/stage_0_upper.stl', 'storageKey persistido sem expiração');
  console.log('  ✅ PASS: Setup criado com estágios associados a storageKeys reais');

  // Limpeza do setup de teste
  await prisma.setup.delete({ where: { id: testSetup.id } });
  console.log('  ✅ PASS: Limpeza de dados de teste executada com sucesso');

  console.log('\n====================================================');
  console.log('🏁 RESULTADO DO SPRINT 1: TODOS OS TESTES PASSARAM COM SUCESSO');
  console.log('====================================================\n');
}

runSprint1Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha nos testes do Sprint 1:', err);
    process.exit(1);
  });

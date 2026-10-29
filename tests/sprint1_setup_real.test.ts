import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ToothMovementSchema,
  SetupStageDataSchema,
  ClinicalSetupSchema,
  ClinicalSetupClientDtoSchema,
  IPRItemSchema,
  AttachmentItemSchema,
} from '../src/lib/types/setup';
import {
  parseStageFileName,
  analyzeStageFiles,
} from '../src/lib/three/stageParser';
import { validate3DMeshBuffer } from '../src/lib/storage/validator';

console.log('====================================================');
console.log('🔬 INICIANDO TESTES DO SPRINT 1: SETUP REAL & CAD STL');
console.log('====================================================');

describe('Sprint 1 - Contrato SetupContract e Validações Zod', () => {
  it('Deve validar ToothMovement com FDI válida (11 a 48) e coordenadas de translação/rotação', () => {
    const validMovement = {
      toothFdi: '21',
      translationMm: { x: 0.2, y: 0.1, z: 0.05 },
      rotationDeg: { x: 1.5, y: -0.5, z: 2.1 },
    };

    const parsed = ToothMovementSchema.parse(validMovement);
    assert.strictEqual(parsed.toothFdi, '21');
    assert.strictEqual(parsed.translationMm.x, 0.2);

    // FDI inválida (ex: 99 ou 00) deve falhar na validação
    assert.throws(() => {
      ToothMovementSchema.parse({
        toothFdi: '99',
        translationMm: { x: 0, y: 0, z: 0 },
        rotationDeg: { x: 0, y: 0, z: 0 },
      });
    });
  });

  it('SetupStageData deve persistir referências storageKey (sem URLs temporárias pré-assinadas no banco)', () => {
    const stageData = {
      stageNumber: 0,
      upperStorageKey: 'clinics/c1/cases/case-123/setups/v1/stage_0_upper.stl',
      lowerStorageKey: 'clinics/c1/cases/case-123/setups/v1/stage_0_lower.stl',
      movements: [
        {
          toothFdi: '11',
          translationMm: { x: 0.1, y: 0.0, z: -0.05 },
          rotationDeg: { x: 0.5, y: 0.0, z: 1.0 },
        },
      ],
    };

    const parsed = SetupStageDataSchema.parse(stageData);
    assert.strictEqual(parsed.stageNumber, 0);
    assert.ok(parsed.upperStorageKey?.includes('stage_0_upper.stl'));
    assert.ok(!parsed.upperStorageKey?.includes('http')); // Garantir que não guarda URLs temporárias
  });

  it('ClinicalSetupSchema deve validar ciclo completo com IPR, attachments e status DRAFT/PUBLISHED/APPROVED', () => {
    const setup = {
      id: 'a0000000-0000-4000-8000-000000000001',
      caseId: 'b0000000-0000-4000-8000-000000000002',
      versionNumber: 1,
      status: 'PUBLISHED',
      upperAlignersCount: 14,
      lowerAlignersCount: 12,
      stages: [
        { stageNumber: 0, upperStorageKey: 'key_0_up', lowerStorageKey: 'key_0_low' },
        { stageNumber: 1, upperStorageKey: 'key_1_up', lowerStorageKey: 'key_1_low' },
      ],
      iprSchedule: [
        { teeth: '11-21', amountMm: 0.2, stage: 3 },
      ],
      attachmentSchedule: [
        { toothFdi: '14', type: 'Retangular Horizontal', stage: 1 },
      ],
      plannerNotes: 'Planejamento ortodôntico aprovado tecnicamente para confecção.',
      createdAt: new Date().toISOString(),
    };

    const validated = ClinicalSetupSchema.parse(setup);
    assert.strictEqual(validated.versionNumber, 1);
    assert.strictEqual(validated.status, 'PUBLISHED');
    assert.strictEqual(validated.stages.length, 2);
    assert.strictEqual(validated.iprSchedule[0].teeth, '11-21');
  });

  it('ClinicalSetupClientDtoSchema deve validar a entrega ao frontend com URLs temporárias de streaming', () => {
    const clientDto = {
      id: 'setup-123',
      caseId: 'case-abc',
      versionNumber: 1,
      status: 'PUBLISHED',
      upperAlignersCount: 1,
      lowerAlignersCount: 1,
      stages: [
        {
          stageNumber: 0,
          upperModelUrl: '/api/cases/case-abc/stages/stage-0/mesh?arch=upper',
          lowerModelUrl: '/api/cases/case-abc/stages/stage-0/mesh?arch=lower',
          upperTriangleCount: 142000,
          lowerTriangleCount: 128000,
        },
        {
          stageNumber: 1,
          upperModelUrl: '/api/cases/case-abc/stages/stage-1/mesh?arch=upper',
          lowerModelUrl: '/api/cases/case-abc/stages/stage-1/mesh?arch=lower',
        },
      ],
      iprSchedule: [],
      attachmentSchedule: [],
      createdAt: new Date().toISOString(),
    };

    const validated = ClinicalSetupClientDtoSchema.parse(clientDto);
    assert.strictEqual(validated.stages[0].upperModelUrl, '/api/cases/case-abc/stages/stage-0/mesh?arch=upper');
  });
});

describe('Sprint 1 - Parser Automático de Nomenclatura de Estágios', () => {
  it('Deve reconhecer nomenclatura CAD real (1-I-, 1-S-, 12-I-, 12-S-) e canônica (stage_0_upper, stage_0_lower)', () => {
    // 1-I-.stl -> LOWER / 1
    const file1I = parseStageFileName('1-I-.stl', 21600000);
    assert.ok(file1I);
    assert.strictEqual(file1I.stageNumber, 1);
    assert.strictEqual(file1I.arch, 'LOWER');

    // 1-S-.stl -> UPPER / 1
    const file1S = parseStageFileName('1-S-.stl', 21600000);
    assert.ok(file1S);
    assert.strictEqual(file1S.stageNumber, 1);
    assert.strictEqual(file1S.arch, 'UPPER');

    // 12-I-.stl -> LOWER / 12
    const file12I = parseStageFileName('12-I-.stl', 21600000);
    assert.ok(file12I);
    assert.strictEqual(file12I.stageNumber, 12);
    assert.strictEqual(file12I.arch, 'LOWER');

    // 12-S-.stl -> UPPER / 12
    const file12S = parseStageFileName('12-S-.stl', 21600000);
    assert.ok(file12S);
    assert.strictEqual(file12S.stageNumber, 12);
    assert.strictEqual(file12S.arch, 'UPPER');

    // stage_0_lower.stl -> LOWER / 0
    const file0Low = parseStageFileName('stage_0_lower.stl', 15000000);
    assert.ok(file0Low);
    assert.strictEqual(file0Low.stageNumber, 0);
    assert.strictEqual(file0Low.arch, 'LOWER');

    // stage_0_upper.stl -> UPPER / 0
    const file0Up = parseStageFileName('stage_0_upper.stl', 15000000);
    assert.ok(file0Up);
    assert.strictEqual(file0Up.stageNumber, 0);
    assert.strictEqual(file0Up.arch, 'UPPER');

    // arquivo-aleatorio.stl -> null / inválido
    const fileInvalid = parseStageFileName('arquivo-aleatorio.stl', 1000);
    assert.strictEqual(fileInvalid, null, 'arquivo-aleatorio.stl deve ser rejeitado como nulo');

    // Suporte a português descritivo
    const parsedPT = parseStageFileName('estagio_14_superior.stl', 4096);
    assert.ok(parsedPT);
    assert.strictEqual(parsedPT.stageNumber, 14);
    assert.strictEqual(parsedPT.arch, 'UPPER');
  });

  it('Deve validar lote de arquivos CAD (12 arquivos, 6 pares de estágio do 1 ao 6) iniciando no Estágio 1', () => {
    // 12 arquivos CAD reais: estágios 1 a 6 (superior e inferior para cada um)
    const cadBatch12Files = [
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

    const result = analyzeStageFiles(cadBatch12Files);

    // Validações da análise
    assert.strictEqual(result.isValid, true, 'Lote com 12 arquivos do estágio 1 ao 6 é válido');
    assert.strictEqual(result.totalStagesDetected, 6, '6 estágios detectados');
    assert.strictEqual(result.totalCompletePairs, 6, '6 pares de estágio completos');
    assert.strictEqual(result.minStage, 1);
    assert.strictEqual(result.maxStage, 6);
    assert.strictEqual(result.unrecognizedFiles.length, 0);
    assert.strictEqual(result.errors.length, 0);

    // Deve emitir aviso informando que iniciou no estágio 1
    assert.ok(
      result.warnings.some((w) => w.includes('Estágio 1')),
      'Deve conter aviso de início no estágio 1'
    );
  });

  it('Deve detectar ausência de arquivo em par incompleto e buracos na sequência', () => {
    // Caso 1: Estágio 0 e 1, mas falta stage_1_lower.stl
    const incompleteBatch = [
      { name: 'stage_0_upper.stl', size: 1000 },
      { name: 'stage_0_lower.stl', size: 1000 },
      { name: 'stage_1_upper.stl', size: 1000 },
    ];
    const resultIncomplete = analyzeStageFiles(incompleteBatch);
    assert.strictEqual(resultIncomplete.isValid, false);
    assert.ok(
      resultIncomplete.missingFiles.some((m) =>
        m.toLowerCase().includes('inferior') || m.toLowerCase().includes('lower')
      ),
      'Detectou ausência de arcada inferior no estágio 1'
    );

    // Caso 2: Inicia no Estágio 3 sem estágio 0 ou 1
    const invalidStartBatch = [
      { name: '3-S-.stl', size: 1000 },
      { name: '3-I-.stl', size: 1000 },
    ];
    const resultInvalidStart = analyzeStageFiles(invalidStartBatch);
    assert.strictEqual(resultInvalidStart.isValid, false);
    assert.ok(
      resultInvalidStart.errors.some((e) => e.includes('Sequência inicial incorreta')),
      'Deve acusar erro se planejamento iniciar em estágio > 1'
    );

    // Caso 3: Buraco no meio da sequência (estágios 1 e 3 presentes, estágio 2 ausente)
    const gapBatch = [
      { name: '1-S-.stl', size: 1000 },
      { name: '1-I-.stl', size: 1000 },
      { name: '3-S-.stl', size: 1000 },
      { name: '3-I-.stl', size: 1000 },
    ];
    const resultGap = analyzeStageFiles(gapBatch);
    assert.strictEqual(resultGap.isValid, false);
    assert.ok(
      resultGap.errors.some((e) => e.includes('Estágio 2')),
      'Deve acusar ausência do Estágio 2 intermediário'
    );
  });

  it('Deve validar integridade de Buffer STL binário e rejeitar arquivos corrompidos', () => {
    // Buffer menor que cabeçalho padrão de 84 bytes
    const smallBuffer = Buffer.alloc(50);
    const resultSmall = validate3DMeshBuffer(smallBuffer, '.stl');
    assert.strictEqual(resultSmall.valid, false);

    // Buffer STL Binário válido com 2 triângulos (84 + 2 * 50 = 184 bytes)
    const validBinaryBuffer = Buffer.alloc(184);
    validBinaryBuffer.writeUInt32LE(2, 80); // 2 triângulos
    const resultValid = validate3DMeshBuffer(validBinaryBuffer, '.stl');
    assert.strictEqual(resultValid.valid, true);
    assert.ok(resultValid.details?.includes('2 triângulos'));
  });
});

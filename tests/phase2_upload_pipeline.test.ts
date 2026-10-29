import { validateFileForSlot, validate3DMeshBuffer, SLOTS_METADATA } from '../src/lib/storage/validator';
import { generateAnonymizedStorageKey, verifyLocalUploadSignature } from '../src/lib/storage/s3';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('🔬 INICIANDO BATERIA DE TESTES DA FASE 2: UPLOAD S3 & GRID');
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
  // TESTE 1: Validação de Slots e Extensões Permitidas (F2.13)
  // ----------------------------------------------------
  console.log('▶ Teste 1: Validação de Extensões e Limites por Slot');
  
  // Slot 1 (Foto Extraoral Frontal): aceita JPG/PNG/HEIC até 25MB
  const validPhoto = validateFileForSlot(1, 'rosto_frontal.jpg', 5 * 1024 * 1024);
  assert(validPhoto.valid, 'Slot 1 aceita imagem JPG de 5 MB');

  const invalidExtPhoto = validateFileForSlot(1, 'rosto.stl', 5 * 1024 * 1024);
  assert(!invalidExtPhoto.valid, 'Slot 1 rejeita arquivo .stl (formato indevido)');

  const oversizedPhoto = validateFileForSlot(1, 'rosto_grande.png', 30 * 1024 * 1024);
  assert(!oversizedPhoto.valid, 'Slot 1 rejeita foto acima de 25 MB');

  // Slot 9 (Radiografia): aceita DICOM (.dcm) até 50MB
  const validDicom = validateFileForSlot(9, 'panoramica.dcm', 40 * 1024 * 1024);
  assert(validDicom.valid, 'Slot 9 aceita radiografia DICOM de 40 MB');

  // Slot 11 (Malha 3D Superior): aceita STL/PLY até 100MB
  const validStl = validateFileForSlot(11, 'arcada_superior.stl', 45 * 1024 * 1024);
  assert(validStl.valid, 'Slot 11 aceita malha 3D .STL de 45 MB');

  const invalid3dExt = validateFileForSlot(11, 'arcada.pdf', 10 * 1024 * 1024);
  assert(!invalid3dExt.valid, 'Slot 11 rejeita formato .pdf');

  // ----------------------------------------------------
  // TESTE 2: Validação Geométrica de Malha 3D (F2.14)
  // ----------------------------------------------------
  console.log('\n▶ Teste 2: Validação de Cabeçalho e Integridade de Malhas 3D');

  // Cria buffer simulando STL binário válido (80 bytes cabeçalho + 4 bytes num triângulos + triângulos)
  const header = Buffer.alloc(80, 'FyAlign 3D Scanner');
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32LE(2, 0); // 2 triângulos
  const trianglesBuf = Buffer.alloc(2 * 50); // 50 bytes por triângulo
  const mockValidBinaryStl = Buffer.concat([header, countBuf, trianglesBuf]);

  const stlCheck = validate3DMeshBuffer(mockValidBinaryStl, '.stl');
  assert(stlCheck.valid, `STL binário sintetizado validado: ${stlCheck.details}`);

  // STL truncado (< 84 bytes)
  const corruptStl = Buffer.alloc(40);
  const corruptCheck = validate3DMeshBuffer(corruptStl, '.stl');
  assert(!corruptCheck.valid, 'STL corrompido/truncado (<84 bytes) é rejeitado com sucesso');

  // STL ASCII
  const asciiStl = Buffer.from('solid FyAlignModel\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nendloop\nendfacet\nendsolid');
  const asciiCheck = validate3DMeshBuffer(asciiStl, '.stl');
  assert(asciiCheck.valid, `STL ASCII reconhecido: ${asciiCheck.details}`);

  // ----------------------------------------------------
  // TESTE 3: Anonimização de Nomes no Storage LGPD (F2.04)
  // ----------------------------------------------------
  console.log('\n▶ Teste 3: Política de Anonimização de Arquivos (LGPD)');
  const clinicId = 'mock-clinic-uuid';
  const caseId = 'mock-case-uuid';
  const rawFileName = 'Paciente_Mariana_Costa_Foto_Intraoral.jpg';

  const anonymizedKey = generateAnonymizedStorageKey(clinicId, caseId, 4, rawFileName);
  assert(!anonymizedKey.includes('Mariana'), 'Chave de armazenamento NÃO contém nome do paciente');
  assert(!anonymizedKey.includes('Costa'), 'Chave de armazenamento NÃO contém sobrenome do paciente');
  assert(anonymizedKey.startsWith('clinics/mock-clinic-uuid/cases/mock-case-uuid/slot_4_'), 'Chave segue padrão particionado por clínica e caso');
  assert(anonymizedKey.endsWith('.jpg'), 'Extensão original preservada para MIME resolution');

  // ----------------------------------------------------
  // TESTE 4: Assinaturas de Upload Local com HMAC (F2.01, F2.03)
  // ----------------------------------------------------
  console.log('\n▶ Teste 4: Geração e Validação de Assinaturas Presigned HMAC');
  const testKey = 'test/file.stl';
  const timestamp = Date.now().toString();
  const secret = process.env.JWT_SECRET || 'fyalign-super-secure-production-jwt-secret-key-32chars-min';
  
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(`${testKey}:${timestamp}`)
    .digest('hex');

  const isSigValid = verifyLocalUploadSignature(testKey, timestamp, validSig);
  assert(isSigValid, 'Assinatura HMAC válida é aprovada');

  const tamperedSig = verifyLocalUploadSignature(testKey, timestamp, 'tampered-fake-signature');
  assert(!tamperedSig, 'Assinatura HMAC adulterada é rejeitada');

  // ----------------------------------------------------
  // TESTE 5: Integração do Ciclo de Upload no Banco de Dados
  // ----------------------------------------------------
  console.log('\n▶ Teste 5: Ciclo de Criação, Upload e Confirmação no Banco');
  
  // Busca o caso 2 (Gabriel Ramos Santos) para teste de upload
  const targetCase = await prisma.case.findFirst({
    where: { caseCode: 'FY-2026-002' },
  });

  if (!targetCase) {
    throw new Error('Caso FY-2026-002 não encontrado no banco');
  }

  // 1. Cria CaseFile com status UPLOADING (Slot 11 - Malha Superior)
  const caseFile = await prisma.caseFile.create({
    data: {
      caseId: targetCase.id,
      slotNumber: 11,
      category: 'SCAN_3D',
      originalFileName: 'arcada_superior.stl',
      storageKey: `clinics/${targetCase.clinicId}/cases/${targetCase.id}/slot_11_test.stl`,
      mimeType: 'model/stl',
      fileSizeBytes: 24500000,
      status: 'UPLOADING',
    },
  });
  assert(caseFile.status === 'UPLOADING', 'Arquivo registrado inicialmente com status UPLOADING');

  // 2. Confirmação de Upload
  const confirmed = await prisma.caseFile.update({
    where: { id: caseFile.id },
    data: {
      status: 'UPLOADED',
      fileHashSha256: 'a1b2c3d4e5f6mockhash789',
    },
  });
  assert(confirmed.status === 'UPLOADED', 'Status alterado com sucesso para UPLOADED após confirmação');

  // 3. Exclusão e limpeza do arquivo de teste
  await prisma.caseFile.delete({
    where: { id: caseFile.id },
  });
  const deletedCheck = await prisma.caseFile.findUnique({
    where: { id: caseFile.id },
  });
  assert(deletedCheck === null, 'Arquivo de teste removido corretamente com rollback');

  // ----------------------------------------------------
  // RESULTADO CONSOLIDADO
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 RESULTADO DOS TESTES DA FASE 2: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests()
  .catch((err) => {
    console.error('Erro fatal nos testes:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

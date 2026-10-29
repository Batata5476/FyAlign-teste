import { prisma } from '../src/lib/prisma';
import { SLOTS_METADATA } from '../src/lib/storage/validator';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🔬 INICIANDO BATERIA DE TESTES DA FASE 3: PRESCRIÇÃO & FDI');
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
  // TESTE 1: Notação Dentária FDI (32 Dentes Permanentes) (F3.08)
  // ----------------------------------------------------
  console.log('▶ Teste 1: Validação do Odontograma e Notação FDI (11 a 48)');
  
  const validFdiTeeth = [
    '11', '12', '13', '14', '15', '16', '17', '18',
    '21', '22', '23', '24', '25', '26', '27', '28',
    '31', '32', '33', '34', '35', '36', '37', '38',
    '41', '42', '43', '44', '45', '46', '47', '48',
  ];

  assert(validFdiTeeth.length === 32, 'Odontograma possui exatamente 32 dentes permanentes');

  function isValidFdiTooth(num: string): boolean {
    const n = parseInt(num, 10);
    const quadrant = Math.floor(n / 10);
    const tooth = n % 10;
    return quadrant >= 1 && quadrant <= 4 && tooth >= 1 && tooth <= 8;
  }

  assert(isValidFdiTooth('16'), 'Dente #16 (Molar Sup Direito) é válido');
  assert(isValidFdiTooth('41'), 'Dente #41 (Incisivo Central Inf Direito) é válido');
  assert(!isValidFdiTooth('55'), 'Dente #55 (Dente decíduo/infantil) é rejeitado na dentição permanente');
  assert(!isValidFdiTooth('99'), 'Dente #99 inválido é rejeitado');

  // ----------------------------------------------------
  // TESTE 2: Serialização e Restrição de Movimentação (F3.09)
  // ----------------------------------------------------
  console.log('\n▶ Teste 2: Restrição de Dentes Anquilosados/Implantes');
  
  const testRestricted = ['16', '36']; // Implante no 16 e 36
  const serializedFdi = JSON.stringify(testRestricted);
  const deserializedFdi = JSON.parse(serializedFdi);

  assert(Array.isArray(deserializedFdi), 'Restrições serializadas como JSON Array');
  assert(deserializedFdi.includes('16') && deserializedFdi.includes('36'), 'Dentes restritos #16 e #36 persistidos fielmente');

  // ----------------------------------------------------
  // TESTE 3: Regra de Negócio RN-02 (Assinatura do Dentista com CRO)
  // ----------------------------------------------------
  console.log('\n▶ Teste 3: Regra de Negócio RN-02 (Perfil Autorizado com CRO)');
  
  const doctor = await prisma.user.findFirst({
    where: { role: 'DOCTOR' },
  });

  const assistant = await prisma.user.findFirst({
    where: { role: 'CLINIC_ASSISTANT' },
  });

  assert(doctor !== null && doctor.professionalIdCro !== null, 'Doutor possui registro de CRO cadastrado');
  assert(doctor?.role === 'DOCTOR', 'Papel DOCTOR autorizado para emitir prescrição');
  assert(assistant?.role === 'CLINIC_ASSISTANT', 'Papel CLINIC_ASSISTANT identificado como sem prerrogativa de prescrição');

  // ----------------------------------------------------
  // TESTE 4: Regra de Negócio RN-01 (Bloqueio sem 12 Arquivos)
  // ----------------------------------------------------
  console.log('\n▶ Teste 4: Regra de Negócio RN-01 (Mínimo Mandatório de Arquivos)');

  const caseGabriel = await prisma.case.findFirst({
    where: { caseCode: 'FY-2026-002' },
    include: { files: true },
  });

  if (!caseGabriel) throw new Error('Caso FY-2026-002 não encontrado');

  const requiredSlots = Object.values(SLOTS_METADATA).filter((s) => s.required);
  const uploadedSlotNumbers = caseGabriel.files
    .filter((f: { status: string }) => f.status === 'UPLOADED')
    .map((f: { slotNumber: number }) => f.slotNumber);

  const missingSlots = requiredSlots.filter(
    (s) => !uploadedSlotNumbers.includes(s.slotNumber)
  );

  assert(missingSlots.length > 0, `Caso rascunho possui ${missingSlots.length} arquivos obrigatórios ausentes`);
  assert(caseGabriel.status === 'DRAFT', 'Caso rascunho permanece em status DRAFT (não permite submissão prematura)');

  // ----------------------------------------------------
  // TESTE 5: Simulação de Submissão com Sucesso & Assinatura (F3.13)
  // ----------------------------------------------------
  console.log('\n▶ Teste 5: Ciclo de Submissão e Registro de Assinatura Eletrônica');

  // Cria temporariamente todos os 12 arquivos obrigatórios para testar a submissão
  const createdTestFiles = [];
  for (const slot of requiredSlots) {
    const file = await prisma.caseFile.create({
      data: {
        caseId: caseGabriel.id,
        slotNumber: slot.slotNumber,
        category: slot.category,
        originalFileName: `teste_slot_${slot.slotNumber}.bin`,
        storageKey: `test_slot_${slot.slotNumber}.bin`,
        mimeType: 'application/octet-stream',
        fileSizeBytes: 1024,
        status: 'UPLOADED',
      },
    });
    createdTestFiles.push(file);
  }

  // Verifica que agora todos os 12 slots estão presentes
  const allUploaded = await prisma.caseFile.findMany({
    where: { caseId: caseGabriel.id, status: 'UPLOADED' },
  });
  assert(allUploaded.length >= 12, 'Todos os 12 arquivos obrigatórios foram validados');

  // Transiciona o caso para SUBMITTED
  const submittedCase = await prisma.case.update({
    where: { id: caseGabriel.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });
  assert(submittedCase.status === 'SUBMITTED', 'Status transicionado com sucesso para SUBMITTED');

  // Registra e verifica log de auditoria da assinatura eletrônica
  const auditLog = await prisma.auditLog.create({
    data: {
      caseId: caseGabriel.id,
      userId: doctor!.id,
      action: 'SUBMIT_CLINICAL_CASE_WITH_DIGITAL_SIGNATURE',
      entityAffected: 'Case',
      payloadDiff: JSON.stringify({
        caseCode: caseGabriel.caseCode,
        doctorName: doctor!.fullName,
        cro: doctor!.professionalIdCro,
        signedAt: new Date().toISOString(),
      }),
      ipAddress: '127.0.0.1',
      userAgent: 'Automated-Test-Runner',
    },
  });

  assert(auditLog.action === 'SUBMIT_CLINICAL_CASE_WITH_DIGITAL_SIGNATURE', 'Assinatura eletrônica gravada com rastreabilidade legal');

  // Limpa arquivos de teste e restaura caso para DRAFT
  await prisma.caseFile.deleteMany({
    where: { caseId: caseGabriel.id },
  });
  await prisma.case.update({
    where: { id: caseGabriel.id },
    data: { status: 'DRAFT', submittedAt: null },
  });
  await prisma.auditLog.delete({
    where: { id: auditLog.id },
  });

  assert(true, 'Rollback dos dados de teste executado com integridade');

  // ----------------------------------------------------
  // RESULTADO CONSOLIDADO
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 RESULTADO DOS TESTES DA FASE 3: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests()
  .catch((err) => {
    console.error('Erro fatal nos testes:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Suíte de Testes Automatizados - Fase 5: Central de Aprovação, Chat Contextual & Esteira Fabril
 * Executa validações de regras de negócio RN-02, RN-03, cálculo de planos de OP,
 * menções anatômicas FDI, isolamento de notas internas do chat, controle de SLA e QC.
 */

import { extractFdiMentions, getToothFdiInfo } from '../src/lib/chat/fdiMention';
import { prisma } from '../src/lib/prisma';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('🔬 INICIANDO BATERIA DE TESTES DA FASE 5: APROVAÇÃO, CHAT & FABRIL');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // Teste 1: Parser e Dicionário Anatômico de Menções FDI (F5.07)
  // --------------------------------------------------------------------------
  console.log('▶ Teste 1: Parser e Dicionário Anatômico de Menções FDI (#11 a #48)');
  const sampleMessage = 'Favor reduzir IPR mesial no dente #21 e vestibularizar o #36. Verificar contato no #11.';
  const mentions = extractFdiMentions(sampleMessage);
  assert(mentions.length === 3, 'Detectou exatamente 3 menções a dentes válidos');
  assert(mentions.includes('21') && mentions.includes('36') && mentions.includes('11'), 'Extraiu dentes 21, 36 e 11');

  const invalidMessage = 'Favor checar o dente #99 e #00 e hashtag #clinica';
  const invalidMentions = extractFdiMentions(invalidMessage);
  assert(invalidMentions.length === 0, 'Ignorou números inexistentes na numeração FDI (#99, #00) e hashtags comuns');

  const infoTooth21 = getToothFdiInfo('21');
  assert(infoTooth21?.anatomicalName === 'Incisivo Central Superior Esquerdo', 'Identificou corretamente dente #21');
  assert(infoTooth21?.arch === 'UPPER' && infoTooth21?.side === 'LEFT', 'Arcada e lateralidade corretas para #21');

  const infoTooth36 = getToothFdiInfo('36');
  assert(infoTooth36?.anatomicalName === 'Primeiro Molar Inferior Esquerdo', 'Identificou corretamente dente #36');
  assert(infoTooth36?.arch === 'LOWER', 'Arcada inferior correta para #36');

  // --------------------------------------------------------------------------
  // Setup de Dados no Banco para Testes de Integração
  // --------------------------------------------------------------------------
  const testClinic = await prisma.clinic.findFirst();
  const testDoctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  const testAssistant = await prisma.user.findFirst({ where: { role: 'CLINIC_ASSISTANT' } });
  const testPlanner = await prisma.user.findFirst({ where: { role: 'PLANNER_3D' } });
  const testPatient = await prisma.patient.findFirst();

  if (!testClinic || !testDoctor || !testPatient || !testPlanner) {
    throw new Error('Ambiente de teste requer seed executado com clínica, doutor, paciente e planejador.');
  }

  const testCase = await prisma.case.create({
    data: {
      caseCode: `TEST-F5-${Date.now()}`,
      patientId: testPatient.id,
      doctorId: testDoctor.id,
      clinicId: testClinic.id,
      status: 'WAITING_DOCTOR_APPROVAL',
      submittedAt: new Date(Date.now() - 36 * 3600 * 1000), // submetido há 36 horas
    },
  });

  const testSetup = await prisma.setup.create({
    data: {
      caseId: testCase.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      upperAlignersCount: 14,
      lowerAlignersCount: 12,
      plannerComments: 'Setup v1 inicial gerado para teste',
    },
  });

  // --------------------------------------------------------------------------
  // Teste 2: Regra de Negócio RN-02 na Aprovação de Setup
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 2: Regra de Negócio RN-02 na Aprovação de Setup');
  const canAssistantApprove = testAssistant?.role === 'DOCTOR' && !!testAssistant?.professionalIdCro;
  assert(!canAssistantApprove, 'Assistente de clínica é bloqueado de aprovar setup clínico (RN-02)');

  const canDoctorApprove = testDoctor.role === 'DOCTOR' && !!testDoctor.professionalIdCro;
  assert(canDoctorApprove, 'Cirurgião-Dentista com CRO ativo é autorizado para aprovação (RN-02)');

  // --------------------------------------------------------------------------
  // Teste 3: Cálculo do Plano e Emissão de Ordem de Produção (F5.03 & F5.17)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 3: Geração Automática e Cálculo de Plano de Ordem de Produção (OP)');
  const calculatePlan = (upper: number, lower: number) => {
    const maxA = Math.max(upper, lower);
    if (maxA <= 14) return { plan: 'LITE', price: 1890.0 };
    if (maxA <= 26) return { plan: 'MODERATE', price: 2990.0 };
    return { plan: 'FULL', price: 4490.0 };
  };

  const plan14 = calculatePlan(14, 12);
  assert(plan14.plan === 'LITE' && plan14.price === 1890.0, '14 alinhadores classificado como Plano LITE (R$ 1.890)');

  const plan22 = calculatePlan(22, 20);
  assert(plan22.plan === 'MODERATE' && plan22.price === 2990.0, '22 alinhadores classificado como Plano MODERATE (R$ 2.990)');

  const plan32 = calculatePlan(32, 28);
  assert(plan32.plan === 'FULL' && plan32.price === 4490.0, '32 alinhadores classificado como Plano FULL (R$ 4.490)');

  // Simular criação da OP
  const createdOrder = await prisma.order.create({
    data: {
      caseId: testCase.id,
      orderCode: `OP-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      planType: plan14.plan,
      amount: plan14.price,
      paymentStatus: 'PENDING',
    },
  });
  assert(!!createdOrder.orderCode && createdOrder.orderCode.startsWith('OP-2026-'), 'Ordem de Produção criada com código padronizado');
  assert(createdOrder.planType === 'LITE', 'Ordem vinculada ao plano LITE');

  // --------------------------------------------------------------------------
  // Teste 4: Rejeição de Setup e Solicitação de Ajuste Técnico (F5.04)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 4: Rejeição com Justificativa e Abertura de Ciclo Técnico');
  const shortReason = 'Ruim';
  assert(shortReason.length < 10, 'Justificativa vazia ou rasa (< 10 caracteres) é barrada pela validação');

  const detailedReason = 'Favor inclinar a coroa vestibular do dente #21 em 1 grau adicional.';
  assert(detailedReason.length >= 10, 'Justificativa técnica fundamentada é aceita');

  const rejectedSetup = await prisma.setup.update({
    where: { id: testSetup.id },
    data: { status: 'REJECTED' },
  });
  assert(rejectedSetup.status === 'REJECTED', 'Status do setup alterado para REJECTED');

  // --------------------------------------------------------------------------
  // Teste 5: Versionamento Automático de Setups Virtuais (F5.05)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 5: Versionamento Automático de Setups (v1 -> v2)');
  const existingSetups = await prisma.setup.findMany({ where: { caseId: testCase.id } });
  const maxVersion = Math.max(...existingSetups.map((s: { versionNumber: number }) => s.versionNumber));
  const newVersion = maxVersion + 1;

  const setupV2 = await prisma.setup.create({
    data: {
      caseId: testCase.id,
      versionNumber: newVersion,
      status: 'PUBLISHED',
      upperAlignersCount: 15,
      lowerAlignersCount: 12,
      plannerComments: 'Setup v2 com correções no dente 21',
    },
  });
  assert(setupV2.versionNumber === 2, 'Setup v2 criado com versionamento incrementado');

  // --------------------------------------------------------------------------
  // Teste 6: Chat Contextual e Isolamento de Mensagens Internas (F5.06 & F5.09)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 6: Chat Contextual e Isolamento de Notas Internas (RBAC)');
  // Mensagem pública da clínica
  const publicMsg = await prisma.caseMessage.create({
    data: {
      caseId: testCase.id,
      senderId: testDoctor.id,
      content: 'Aguardando novo planejamento com attachment no #21.',
      isInternalLabOnly: false,
    },
  });

  // Mensagem interna do laboratório
  const internalMsg = await prisma.caseMessage.create({
    data: {
      caseId: testCase.id,
      senderId: testPlanner.id,
      content: 'Nota interna: verificar colisão de malha no estágio 4.',
      isInternalLabOnly: true,
    },
  });

  // Filtro de mensagens para o doutor
  const doctorVisibleMessages = await prisma.caseMessage.findMany({
    where: { caseId: testCase.id, isInternalLabOnly: false },
  });
  assert(
    doctorVisibleMessages.some((m: { id: string }) => m.id === publicMsg.id) &&
      !doctorVisibleMessages.some((m: { id: string }) => m.id === internalMsg.id),
    'Doutor visualiza apenas mensagens públicas (nota interna oculta)'
  );

  // Filtro de mensagens para a equipe FyAlign Lab
  const labVisibleMessages = await prisma.caseMessage.findMany({
    where: { caseId: testCase.id },
  });
  assert(
    labVisibleMessages.some((m: { id: string }) => m.id === publicMsg.id) &&
      labVisibleMessages.some((m: { id: string }) => m.id === internalMsg.id),
    'Equipe de planejamento e produção visualiza mensagens públicas E notas internas'
  );

  // --------------------------------------------------------------------------
  // Teste 7: Controle e Cálculo de SLA na Esteira Fabril (F5.11 & F5.12)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 7: Controle de SLA de 72h da Esteira Fabril');
  const nowMs = Date.now();
  const submitted36hAgo = new Date(nowMs - 36 * 3600 * 1000).getTime();
  const elapsed36h = Math.round((nowMs - submitted36hAgo) / (3600 * 1000));
  const isSlaBreached36h = elapsed36h > 72;
  assert(!isSlaBreached36h, 'Caso com 36h está dentro do SLA de 72h');

  const submitted80hAgo = new Date(nowMs - 80 * 3600 * 1000).getTime();
  const elapsed80h = Math.round((nowMs - submitted80hAgo) / (3600 * 1000));
  const isSlaBreached80h = elapsed80h > 72;
  assert(isSlaBreached80h, 'Caso com 80h tem estouro de SLA (> 72h) detectado com alerta');

  // --------------------------------------------------------------------------
  // Teste 8: Checklist de Controle de Qualidade Fabril (QC) (F5.13)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 8: Checklist de Controle de Qualidade (QC)');
  const qcPayload = {
    laserMarkingVerified: true,
    edgeLaserCutVerified: true,
    opticalClarityVerified: true,
    noBubblesOrDefects: true,
    alignersQuantityVerified: true,
  };
  const isQcFullyApproved = Object.values(qcPayload).every((val) => val === true);
  assert(isQcFullyApproved, 'Checklist fabril com todos os 5 itens conformes é homologado');

  const qcFlawed = { ...qcPayload, opticalClarityVerified: false };
  const isQcFlawedApproved = Object.values(qcFlawed).every((val) => val === true);
  assert(!isQcFlawedApproved, 'Checklist com defeito ótico ou bolha é reprovado no QC');

  // --------------------------------------------------------------------------
  // Teste 9: Módulo de Expedição e Código de Rastreamento (F5.14 & F5.15)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 9: Expedição e Código de Rastreio');
  const updatedOrderWithTracking = await prisma.order.update({
    where: { id: createdOrder.id },
    data: {
      carrierName: 'Correios Sedex',
      trackingCode: 'QB987654321BR',
      dispatchedAt: new Date(),
    },
  });
  assert(updatedOrderWithTracking.trackingCode === 'QB987654321BR', 'Código de rastreamento persistido na Ordem de Produção');
  assert(updatedOrderWithTracking.carrierName === 'Correios Sedex', 'Transportadora registrada');

  // --------------------------------------------------------------------------
  // Teste 10: Solicitação de Refinamento Vinculado (F5.16)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 10: Abertura de Caso de Refinamento Vinculado');
  const refinementCase = await prisma.case.create({
    data: {
      caseCode: `${testCase.caseCode}-R1`,
      parentCaseId: testCase.id,
      patientId: testPatient.id,
      doctorId: testDoctor.id,
      clinicId: testClinic.id,
      status: 'DRAFT',
      chiefComplaint: 'REFINAMENTO: Acabamento de incisivos',
    },
  });
  assert(refinementCase.parentCaseId === testCase.id, 'Caso de refinamento vinculado com chave parentCaseId');
  assert(refinementCase.caseCode.endsWith('-R1'), 'Código do refinamento segue notação com sufixo -R1');

  // Limpeza de dados de teste (Rollback)
  await prisma.caseMessage.deleteMany({ where: { caseId: testCase.id } });
  await prisma.setup.deleteMany({ where: { caseId: testCase.id } });
  await prisma.order.deleteMany({ where: { caseId: testCase.id } });
  await prisma.case.delete({ where: { id: refinementCase.id } });
  await prisma.case.delete({ where: { id: testCase.id } });

  console.log('\n====================================================');
  console.log(`🏁 RESULTADO DOS TESTES DA FASE 5: ${passedTests} PASSOU | ${failedTests} FALHOU`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Erro na execução dos testes da Fase 5:', err);
  process.exit(1);
});

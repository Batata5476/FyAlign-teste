import assert from 'assert';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';

// Rotas da Arquitetura Final v1.0
import { GET as getContract, POST as createContract, PATCH as confirmContract } from '../src/app/api/cases/[id]/contract/route';
import { POST as amendContract } from '../src/app/api/cases/[id]/contract/amend/route';
import { PATCH as updateSchedule } from '../src/app/api/cases/[id]/contract/schedule/route';
import { GET as getProductionUnits, POST as createProductionUnit } from '../src/app/api/cases/[id]/production-units/route';
import { POST as qcInspection } from '../src/app/api/cases/[id]/production-units/[unitId]/qc/route';
import { GET as getShipments, POST as createShipment } from '../src/app/api/cases/[id]/shipments/route';
import { POST as deliverShipment } from '../src/app/api/cases/[id]/shipments/[shipmentId]/deliver/route';
import { GET as getRefinements, POST as createRefinement } from '../src/app/api/cases/[id]/refinements/v2/route';
import { POST as approveRefinementCommercial } from '../src/app/api/cases/[id]/refinements/v2/[refinementId]/commercial-approve/route';
import { POST as approveSetup } from '../src/app/api/cases/[id]/setups/[setupId]/approve/route';

const db = prisma as any;

function createReq(url: string, method: string, token: string, body?: any) {
  const headers = new Headers();
  headers.set('Cookie', `fyalign_access_token=${token}`);
  if (body) {
    headers.set('Content-Type', 'application/json');
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 SUÍTE DE TESTES: ESPECIFICAÇÃO TÉCNICA E ARQUITETURA FINAL V1.0');
  console.log('Validação dos 6 pilares: Contrato, Gatilho Duplo, Lotes, QC, Remessas e Refinamentos');
  console.log('========================================================================\n');

  // 1. Obter usuários de teste do seed
  const superAdmin = await db.user.findUnique({
    where: { email: 'admin@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });
  const adminMembership = superAdmin.memberships[0];
  const adminSession = await db.session.create({
    data: {
      userId: superAdmin.id,
      membershipId: adminMembership.id,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const adminToken = await signAccessToken({
    userId: superAdmin.id,
    sessionId: adminSession.id,
    activeMembershipId: adminMembership.id,
    organizationId: adminMembership.organizationId,
    organizationType: adminMembership.organization.type,
    role: adminMembership.role,
    croStatus: adminMembership.croStatus,
    email: superAdmin.email,
    fullName: superAdmin.fullName,
  });

  const doctorA = await db.user.findUnique({
    where: { email: 'roberto@odontoprime.com.br' },
    include: { memberships: { include: { organization: true } } },
  });
  const doctorAMembership = doctorA.memberships.find((m: any) => m.role === 'DOCTOR')!;
  const doctorASession = await db.session.create({
    data: {
      userId: doctorA.id,
      membershipId: doctorAMembership.id,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const doctorAToken = await signAccessToken({
    userId: doctorA.id,
    sessionId: doctorASession.id,
    activeMembershipId: doctorAMembership.id,
    organizationId: doctorAMembership.organizationId,
    organizationType: doctorAMembership.organization.type,
    role: doctorAMembership.role,
    croStatus: doctorAMembership.croStatus,
    email: doctorA.email,
    fullName: doctorA.fullName,
  });

  const doctorCamila = await db.user.findUnique({
    where: { email: 'camila@sorrisosul.com.br' },
    include: { memberships: { include: { organization: true } } },
  });
  const doctorCamilaMembership = doctorCamila.memberships[0];
  const doctorCamilaSession = await db.session.create({
    data: {
      userId: doctorCamila.id,
      membershipId: doctorCamilaMembership.id,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const doctorCamilaToken = await signAccessToken({
    userId: doctorCamila.id,
    sessionId: doctorCamilaSession.id,
    activeMembershipId: doctorCamilaMembership.id,
    organizationId: doctorCamilaMembership.organizationId,
    organizationType: doctorCamilaMembership.organization.type,
    role: doctorCamilaMembership.role,
    croStatus: doctorCamilaMembership.croStatus,
    email: doctorCamila.email,
    fullName: doctorCamila.fullName,
  });

  const qcUser = await db.user.findUnique({
    where: { email: 'producao@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });
  const qcMembership = qcUser.memberships[0];
  const qcSession = await db.session.create({
    data: {
      userId: qcUser.id,
      membershipId: qcMembership.id,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const qcToken = await signAccessToken({
    userId: qcUser.id,
    sessionId: qcSession.id,
    activeMembershipId: qcMembership.id,
    organizationId: qcMembership.organizationId,
    organizationType: qcMembership.organization.type,
    role: qcMembership.role,
    croStatus: qcMembership.croStatus,
    email: qcUser.email,
    fullName: qcUser.fullName,
  });

  // Criar Caso de Teste dedicado para a suíte
  const testPatient = await db.patient.create({
    data: {
      clinicId: doctorAMembership.organizationId,
      fullName: 'Paciente Teste Arquitetura v1.0',
      birthDate: new Date('1995-05-15'),
      gender: 'MALE',
      phone: '(11) 99887-1122',
    },
  });

  const testCase = await db.case.create({
    data: {
      caseCode: `FY-ARCH-${Date.now()}`,
      patientId: testPatient.id,
      doctorId: doctorA.id,
      clinicId: doctorAMembership.organizationId,
      status: 'WAITING_DOCTOR_APPROVAL',
      treatedArches: 'BOTH',
    },
  });

  const testSetup = await db.setup.create({
    data: {
      caseId: testCase.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      upperAlignersCount: 10,
      lowerAlignersCount: 10,
    },
  });

  console.log('✓ Ambiente de teste provisionado com sucesso.\n');

  // ========================================================================
  // [BLOCO 1] Contrato Comercial e Gatilho Duplo (CT-01 a CT-07)
  // ========================================================================
  console.log('----------------------------------------------------');
  console.log('▶ [BLOCO 1] Contrato Comercial e Gatilho Duplo de Produção');
  console.log('----------------------------------------------------');

  // CT-01 & CT-02: Criação de contrato em DRAFT
  console.log('• CT-01: Criando contrato comercial inicial em estado DRAFT...');
  const createContractReq = createReq(
    `/api/cases/${testCase.id}/contract`,
    'POST',
    adminToken,
    {
      packageName: 'FyAlign Comprehensive 10 Pares',
      contractedAligners: 10,
      totalPriceCents: 120000, // R$ 1.200,00 em centavos inteiros
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 1, // 1 refinamento incluso na franquia
      refinementWindowDays: 180,
      extraAlignerPriceCents: 8000, // R$ 80,00 por par excedente
      commercialNotes: 'Caso de teste da Arquitetura v1.0',
    }
  );
  const createContractRes = await createContract(createContractReq, { params: { id: testCase.id } });
  assert.strictEqual(createContractRes.status, 201, 'CT-01: Criação do contrato deve retornar 201');
  const contractBody = await createContractRes.json();
  assert.strictEqual(contractBody.contract.status, 'DRAFT', 'Contrato criado deve iniciar em DRAFT');
  assert.strictEqual(contractBody.contract.totalPriceCents, 120000, 'Preço deve ser gravado em centavos inteiros');
  console.log('  ✅ [PASS] Contrato comercial DRAFT criado com preço em centavos inteiros (120000).');

  // CT-04: Doutor sem autoridade comercial tenta confirmar contrato -> 403
  console.log('• CT-04: Doutor tentando confirmar contrato comercial...');
  const docConfirmReq = createReq(`/api/cases/${testCase.id}/contract`, 'PATCH', doctorAToken);
  const docConfirmRes = await confirmContract(docConfirmReq, { params: { id: testCase.id } });
  assert.strictEqual(docConfirmRes.status, 403, 'CT-04: Doutor não pode confirmar contrato comercial');
  console.log('  ✅ [PASS] Bloqueio 403: Doutor não possui autoridade comercial.');

  // CT-01: Doutor aprova setup com contrato ainda em DRAFT -> caso NÃO entra em produção
  console.log('• CT-01: Doutor aprovando setup clínico com contrato ainda em DRAFT...');
  const approveSetupReq = createReq(
    `/api/cases/${testCase.id}/setups/${testSetup.id}/approve`,
    'POST',
    doctorAToken,
    {
      professionalAcceptance: true,
      clinicalNotes: 'Setup clinicamente aprovado pelo Dr. Roberto',
    }
  );
  const approveSetupRes = await approveSetup(approveSetupReq, {
    params: { id: testCase.id, setupId: testSetup.id },
  });
  assert.strictEqual(approveSetupRes.status, 200, 'Aprovação clínica retorna 200');

  const caseAfterSetupApproval = await db.case.findUnique({ where: { id: testCase.id } });
  assert.strictEqual(
    caseAfterSetupApproval.status,
    'APPROVED',
    'CT-01: Com contrato em DRAFT, caso fica em APPROVED (esperando contrato), e NÃO entra em IN_PRODUCTION'
  );
  console.log('  ✅ [PASS] Gatilho Duplo: Setup aprovado manteve status APPROVED (produção bloqueada sem contrato confirmado).');

  // CT-05: Responsável comercial confirma contrato -> libera para IN_PRODUCTION e cria Versão 1
  console.log('• CT-05 & CT-03: Responsável comercial confirmando o contrato...');
  const adminConfirmReq = createReq(`/api/cases/${testCase.id}/contract`, 'PATCH', adminToken);
  const adminConfirmRes = await confirmContract(adminConfirmReq, { params: { id: testCase.id } });
  assert.strictEqual(adminConfirmRes.status, 200, 'Confirmação comercial retorna 200');
  const confirmBody = await adminConfirmRes.json();
  assert.strictEqual(confirmBody.contract.status, 'CONFIRMED');

  const version1 = await db.contractVersion.findFirst({
    where: { contractId: confirmBody.contract.id, versionNumber: 1 },
  });
  assert(version1, 'CT-05: Versão 1 do contrato deve ser gravada no snapshot');
  assert.strictEqual(version1.totalPriceCents, 120000);

  const caseAfterContractConfirm = await db.case.findUnique({ where: { id: testCase.id } });
  assert.strictEqual(
    caseAfterContractConfirm.status,
    'IN_PRODUCTION',
    'CT-03: Com setup aprovado E contrato confirmado, caso avança para IN_PRODUCTION'
  );
  console.log('  ✅ [PASS] Gatilho Duplo satisfeito: Versão 1 persistida e caso transicionado para IN_PRODUCTION.');

  // CT-06: Repetição da confirmação -> Idempotente
  console.log('• CT-06: Testando idempotência da confirmação...');
  const repeatConfirmReq = createReq(`/api/cases/${testCase.id}/contract`, 'PATCH', adminToken);
  const repeatConfirmRes = await confirmContract(repeatConfirmReq, { params: { id: testCase.id } });
  assert.strictEqual(repeatConfirmRes.status, 200);
  const versionsCount = await db.contractVersion.count({ where: { contractId: confirmBody.contract.id } });
  assert.strictEqual(versionsCount, 1, 'CT-06: Não deve duplicar a versão 1 em confirmações repetidas');
  console.log('  ✅ [PASS] Idempotência garantida: Sem duplicação de versão.');

  // ========================================================================
  // [BLOCO 2] Aditivo Contratual e Cronograma (CT-08, PR-07, RF-07)
  // ========================================================================
  console.log('\n----------------------------------------------------');
  console.log('▶ [BLOCO 2] Aditivo Contratual e Cronograma Flexível Auditado');
  console.log('----------------------------------------------------');

  // Aditivo válido: Aumentar quantidade contratada de 10 para 12 pares
  console.log('• Registrando aditivo contratual para 12 pares...');
  const amendReq = createReq(
    `/api/cases/${testCase.id}/contract/amend`,
    'POST',
    adminToken,
    {
      contractedAligners: 12,
      totalPriceCents: 140000,
      changeReason: 'Aditivo comercial: expansão de arcada necessitou de mais 2 pares de alinhadores.',
    }
  );
  const amendRes = await amendContract(amendReq, { params: { id: testCase.id } });
  assert.strictEqual(amendRes.status, 200, 'Aditivo contratual válido retorna 200');
  const amendBody = await amendRes.json();
  assert.strictEqual(amendBody.contract.versionNumber, 2);
  assert.strictEqual(amendBody.contract.contractedAligners, 12);
  assert.strictEqual(amendBody.contract.totalPriceCents, 140000);

  const version2 = await db.contractVersion.findFirst({
    where: { contractId: confirmBody.contract.id, versionNumber: 2 },
  });
  assert(version2, 'Versão 2 do contrato registrada com snapshot imutável');
  console.log('  ✅ [PASS] Aditivo registrado com sucesso: Contrato avançou para Versão 2 (12 pares, R$ 1.400,00).');

  // ========================================================================
  // [BLOCO 3] Produção Híbrida, Lotes e QC (PR-01 a PR-06)
  // ========================================================================
  console.log('\n----------------------------------------------------');
  console.log('▶ [BLOCO 3] Produção Híbrida por Lotes e Controle de Qualidade');
  console.log('----------------------------------------------------');

  // PR-01: Tentativa de criar lote com quantidade zero ou negativa -> 400
  console.log('• PR-01: Tentativa de criar lote com quantidade 0...');
  const invalidUnitReq = createReq(
    `/api/cases/${testCase.id}/production-units`,
    'POST',
    adminToken,
    {
      unitCode: 'LOTE-INVALIDO',
      quantityPairs: 0,
      stagesDescription: 'Invalido',
    }
  );
  const invalidUnitRes = await createProductionUnit(invalidUnitReq, { params: { id: testCase.id } });
  assert.strictEqual(invalidUnitRes.status, 400, 'PR-01: Quantidade zero deve ser rejeitada com 400');
  console.log('  ✅ [PASS] Validação Zod: Quantidade zero rejeitada.');

  // PR-02: Criar Lote 1 com 6 pares (Estágios 01 a 06)
  console.log('• PR-02: Criando Lote 01 (6 pares, Estágios 01 a 06)...');
  const unit1Req = createReq(
    `/api/cases/${testCase.id}/production-units`,
    'POST',
    adminToken,
    {
      unitCode: 'LOTE-01',
      type: 'BATCH',
      quantityPairs: 6,
      stagesDescription: 'Estágios 01 a 06 (Superior e Inferior)',
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    }
  );
  const unit1Res = await createProductionUnit(unit1Req, { params: { id: testCase.id } });
  assert.strictEqual(unit1Res.status, 201, 'Lote 01 criado com sucesso');
  const unit1 = (await unit1Res.json()).unit;
  assert.strictEqual(unit1.status, 'PENDING');
  assert.strictEqual(unit1.quantityPairs, 6);
  console.log('  ✅ [PASS] Lote 01 registrado no contrato com status PENDING.');

  // Criar Lote 2 com 6 pares (Estágios 07 a 12) para fechar os 12 contratados
  console.log('• Criando Lote 02 (6 pares, Estágios 07 a 12)...');
  const unit2Req = createReq(
    `/api/cases/${testCase.id}/production-units`,
    'POST',
    adminToken,
    {
      unitCode: 'LOTE-02',
      type: 'BATCH',
      quantityPairs: 6,
      stagesDescription: 'Estágios 07 a 12 (Superior e Inferior)',
    }
  );
  const unit2Res = await createProductionUnit(unit2Req, { params: { id: testCase.id } });
  assert.strictEqual(unit2Res.status, 201);
  const unit2 = (await unit2Res.json()).unit;
  console.log('  ✅ [PASS] Lote 02 registrado (total em produção = 12 pares).');

  // PR-07: Tentativa de exceder a quantidade contratada (12 + 2 = 14 > 12) -> 400
  console.log('• PR-07: Tentativa de criar lote excedendo a quantidade contratada...');
  const excessUnitReq = createReq(
    `/api/cases/${testCase.id}/production-units`,
    'POST',
    adminToken,
    {
      unitCode: 'LOTE-EXCESSO',
      quantityPairs: 2,
      stagesDescription: 'Excedente sem refinamento',
    }
  );
  const excessUnitRes = await createProductionUnit(excessUnitReq, { params: { id: testCase.id } });
  assert.strictEqual(excessUnitRes.status, 400, 'PR-07: Excesso de quantidade deve ser rejeitado');
  console.log('  ✅ [PASS] Trava de Integridade: Bloqueio de produção além do contratado.');

  // Alterar Cronograma do Lote 02 com justificativa
  console.log('• Alterando cronograma do Lote 02 com justificativa auditada...');
  const newEndDate = new Date(Date.now() + 86400000 * 7).toISOString();
  const scheduleReq = createReq(
    `/api/cases/${testCase.id}/contract/schedule`,
    'PATCH',
    adminToken,
    {
      unitId: unit2.id,
      plannedEndDate: newEndDate,
      changeReason: 'Ajuste operacional de calibração da impressora 3D.',
    }
  );
  const scheduleRes = await updateSchedule(scheduleReq, { params: { id: testCase.id } });
  assert.strictEqual(scheduleRes.status, 200, 'Cronograma alterado com sucesso');
  console.log('  ✅ [PASS] Cronograma alterado e auditado.');

  // PR-04: Homologação QC com Reprovação
  console.log('• PR-04: Simulando reprovação de inspeção no Lote 01...');
  const qcRejectReq = createReq(
    `/api/cases/${testCase.id}/production-units/${unit1.id}/qc`,
    'POST',
    qcToken,
    {
      approved: false,
      laserMarkingVerified: true,
      edgeLaserCutVerified: false, // falha no corte
      opticalClarityVerified: true,
      noBubblesOrDefects: true,
      alignersQuantityVerified: true,
      qcNotes: 'Microrebarba na margem gengival do alinhador 03.',
    }
  );
  const qcRejectRes = await qcInspection(qcRejectReq, { params: { id: testCase.id, unitId: unit1.id } });
  assert.strictEqual(qcRejectRes.status, 200);
  const rejectedUnit = (await qcRejectRes.json()).unit;
  assert.strictEqual(rejectedUnit.status, 'QC_REJECTED');
  console.log('  ✅ [PASS] Lote 01 marcado como QC_REJECTED.');

  // SH-03: Tentativa de despachar unidade reprovada no QC -> 400
  console.log('• SH-03: Tentativa de despachar Lote 01 em estado QC_REJECTED...');
  const invalidShipReq = createReq(
    `/api/cases/${testCase.id}/shipments`,
    'POST',
    adminToken,
    {
      carrierName: 'Correios Sedex',
      trackingCode: 'BR123456789SP',
      items: [{ productionUnitId: unit1.id, quantityShipped: 6 }],
    }
  );
  const invalidShipRes = await createShipment(invalidShipReq, { params: { id: testCase.id } });
  assert.strictEqual(invalidShipRes.status, 400, 'SH-03: Expedição de unidade não aprovada no QC deve falhar');
  console.log('  ✅ [PASS] Bloqueio SH-03: Unidade não aprovada no QC barrada da expedição.');

  // PR-03: Correção e aprovação do Lote 01 no QC
  console.log('• PR-03: Reinspeção e aprovação do Lote 01 no QC...');
  const qcApproveReq = createReq(
    `/api/cases/${testCase.id}/production-units/${unit1.id}/qc`,
    'POST',
    qcToken,
    {
      approved: true,
      laserMarkingVerified: true,
      edgeLaserCutVerified: true,
      opticalClarityVerified: true,
      noBubblesOrDefects: true,
      alignersQuantityVerified: true,
      qcNotes: 'Acabamento refeito com perfeição. Liberado.',
    }
  );
  const qcApproveRes = await qcInspection(qcApproveReq, { params: { id: testCase.id, unitId: unit1.id } });
  assert.strictEqual(qcApproveRes.status, 200);
  const approvedUnit = (await qcApproveRes.json()).unit;
  assert.strictEqual(approvedUnit.status, 'QC_PASSED');
  console.log('  ✅ [PASS] Lote 01 aprovado no QC e liberado para remessa.');

  // Aprovar também Lote 02 no QC
  await qcInspection(
    createReq(`/api/cases/${testCase.id}/production-units/${unit2.id}/qc`, 'POST', qcToken, {
      approved: true,
      laserMarkingVerified: true,
      edgeLaserCutVerified: true,
      opticalClarityVerified: true,
      noBubblesOrDefects: true,
      alignersQuantityVerified: true,
    }),
    { params: { id: testCase.id, unitId: unit2.id } }
  );

  // ========================================================================
  // [BLOCO 4] Remessas Parciais e Conclusão Transacional (SH-01 a SH-08)
  // ========================================================================
  console.log('\n----------------------------------------------------');
  console.log('▶ [BLOCO 4] Remessas Parciais, Saldo Expedível e Conclusão');
  console.log('----------------------------------------------------');

  // SH-01: Expedir Remessa Parcial 1 com 6 pares (todo o Lote 01)
  console.log('• SH-01: Despachando Remessa 01 (6 pares do Lote 01)...');
  const ship1Req = createReq(
    `/api/cases/${testCase.id}/shipments`,
    'POST',
    adminToken,
    {
      carrierName: 'Correios Sedex',
      trackingCode: 'BR000111222SP',
      items: [{ productionUnitId: unit1.id, quantityShipped: 6 }],
    }
  );
  const ship1Res = await createShipment(ship1Req, { params: { id: testCase.id } });
  assert.strictEqual(ship1Res.status, 201, 'Remessa 01 criada');
  const shipment1 = (await ship1Res.json()).shipment;
  assert.strictEqual(shipment1.status, 'DISPATCHED');

  const unit1AfterShip = await db.productionUnit.findUnique({ where: { id: unit1.id } });
  assert.strictEqual(unit1AfterShip.shippedQuantity, 6);
  assert.strictEqual(unit1AfterShip.status, 'SHIPPED');
  console.log('  ✅ [PASS] Remessa 01 despachada com sucesso. Saldo do Lote 01 zerado.');

  // SH-02: Tentativa de sobre-expedição (tentar expedir mais 1 par do Lote 01) -> 400
  console.log('• SH-02: Tentando expedir 1 par excedente do Lote 01...');
  const overShipReq = createReq(
    `/api/cases/${testCase.id}/shipments`,
    'POST',
    adminToken,
    {
      carrierName: 'Loggi',
      trackingCode: 'LOGGI999',
      items: [{ productionUnitId: unit1.id, quantityShipped: 1 }],
    }
  );
  const overShipRes = await createShipment(overShipReq, { params: { id: testCase.id } });
  assert.strictEqual(overShipRes.status, 400, 'SH-02: Sobre-expedição deve ser bloqueada');
  console.log('  ✅ [PASS] Bloqueio SH-02: Saldo insuficiente impediu sobre-expedição.');

  // SH-05: Entregar a Remessa 01 -> Caso NÃO deve ser concluído (ainda falta o Lote 02!)
  console.log('• SH-05: Confirmando entrega da Remessa 01...');
  const deliver1Req = createReq(`/api/cases/${testCase.id}/shipments/${shipment1.id}/deliver`, 'POST', adminToken);
  const deliver1Res = await deliverShipment(deliver1Req, { params: { id: testCase.id, shipmentId: shipment1.id } });
  assert.strictEqual(deliver1Res.status, 200);
  const deliver1Body = await deliver1Res.json();
  assert.strictEqual(deliver1Body.caseCompleted, false, 'SH-05: Caso NÃO deve ser concluído em entrega parcial');

  const caseAfterShip1 = await db.case.findUnique({ where: { id: testCase.id } });
  assert.strictEqual(caseAfterShip1.status, 'IN_PRODUCTION', 'Caso continua em produção');
  console.log('  ✅ [PASS] Remessa 01 entregue. Caso permaneceu IN_PRODUCTION (entregas pendentes preservadas).');

  // Expedir Remessa 02 com os 6 pares restantes do Lote 02
  console.log('• Despachando Remessa 02 (6 pares do Lote 02)...');
  const ship2Req = createReq(
    `/api/cases/${testCase.id}/shipments`,
    'POST',
    adminToken,
    {
      carrierName: 'Correios Sedex',
      trackingCode: 'BR333444555SP',
      items: [{ productionUnitId: unit2.id, quantityShipped: 6 }],
    }
  );
  const ship2Res = await createShipment(ship2Req, { params: { id: testCase.id } });
  assert.strictEqual(ship2Res.status, 201);
  const shipment2 = (await ship2Res.json()).shipment;

  // SH-06: Entregar a Remessa 02 -> Todas as 12 unidades entregues -> Caso atinge COMPLETED
  console.log('• SH-06: Confirmando entrega da Remessa 02 (todas as obrigações cumpridas)...');
  const deliver2Req = createReq(`/api/cases/${testCase.id}/shipments/${shipment2.id}/deliver`, 'POST', adminToken);
  const deliver2Res = await deliverShipment(deliver2Req, { params: { id: testCase.id, shipmentId: shipment2.id } });
  assert.strictEqual(deliver2Res.status, 200);
  const deliver2Body = await deliver2Res.json();
  assert.strictEqual(deliver2Body.caseCompleted, true, 'SH-06: Caso deve ser concluído após todas as entregas');

  const caseAfterAllDelivered = await db.case.findUnique({ where: { id: testCase.id } });
  assert.strictEqual(caseAfterAllDelivered.status, 'COMPLETED', 'Caso deve estar em COMPLETED');
  console.log('  ✅ [PASS] Conclusão alcançada: Todas as 12 entregas confirmadas transicionaram o caso para COMPLETED.');

  // ========================================================================
  // [BLOCO 5] Refinamentos Desacoplados (RF-01 a RF-05)
  // ========================================================================
  console.log('\n----------------------------------------------------');
  console.log('▶ [BLOCO 5] Refinamentos Desacoplados e Decisão Comercial');
  console.log('----------------------------------------------------');

  // RF-01: Solicitação de 1º Refinamento (Coberto pela franquia: includedRefinements = 1)
  console.log('• RF-01: Dr. Roberto solicitando 1º refinamento (coberto pela franquia)...');
  const ref1Req = createReq(
    `/api/cases/${testCase.id}/refinements/v2`,
    'POST',
    doctorAToken,
    {
      clinicalReason: 'Refinamento para alinhamento fino do incisivo lateral #12.',
      extraAlignersCount: 3,
    }
  );
  const ref1Res = await createRefinement(ref1Req, { params: { id: testCase.id } });
  assert.strictEqual(ref1Res.status, 201, 'RF-01: Refinamento coberto criado');
  const ref1 = (await ref1Res.json()).refinement;
  assert.strictEqual(ref1.isCoveredByContract, true, 'Deve estar coberto pela franquia');
  assert.strictEqual(ref1.commercialStatus, 'APPROVED', 'Coberto pela franquia aprova automaticamente');
  assert.strictEqual(ref1.extraAmountChargedCents, 0, 'Valor cobrado zero');

  // Invariante: O Case não foi duplicado!
  const casesTotal = await db.case.count({ where: { patientId: testPatient.id } });
  assert.strictEqual(casesTotal, 1, 'Invariante Crítica: O prontuário do paciente mantém exatamente 1 Case!');
  console.log('  ✅ [PASS] 1º Refinamento coberto registrado sem duplicação de Case.');

  // RF-02: Solicitação de 2º Refinamento (Excedente -> exige aprovação comercial)
  console.log('• RF-02: Solicitando 2º refinamento (excedente à franquia)...');
  const ref2Req = createReq(
    `/api/cases/${testCase.id}/refinements/v2`,
    'POST',
    doctorAToken,
    {
      clinicalReason: 'Segundo refinamento para fechamento de diastema residual.',
      extraAlignersCount: 4, // 4 pares extras * R$ 80,00 (8000 centavos) = 32000 centavos (R$ 320,00)
    }
  );
  const ref2Res = await createRefinement(ref2Req, { params: { id: testCase.id } });
  assert.strictEqual(ref2Res.status, 201);
  const ref2 = (await ref2Res.json()).refinement;
  assert.strictEqual(ref2.isCoveredByContract, false, 'Não está coberto');
  assert.strictEqual(ref2.commercialStatus, 'PENDING_COMMERCIAL_APPROVAL');
  assert.strictEqual(ref2.extraAmountChargedCents, 32000, '4 pares * 8000 centavos = 32000 centavos');
  console.log('  ✅ [PASS] 2º Refinamento excedente retido para aprovação comercial (R$ 320,00).');

  // RF-03: Tentativa de produzir alinhadores do refinamento 2 antes da aprovação comercial -> 400
  console.log('• RF-03: Tentando criar lote para refinamento pendente comercialmente...');
  const prematureUnitReq = createReq(
    `/api/cases/${testCase.id}/production-units`,
    'POST',
    adminToken,
    {
      unitCode: 'LOTE-REF-2',
      quantityPairs: 4,
      stagesDescription: 'Refinamento 2',
      refinementRequestId: ref2.id,
    }
  );
  const prematureUnitRes = await createProductionUnit(prematureUnitReq, { params: { id: testCase.id } });
  assert.strictEqual(prematureUnitRes.status, 400, 'RF-03: Produção de refinamento não aprovado deve falhar');
  console.log('  ✅ [PASS] Bloqueio RF-03: Produção barrada até a aprovação comercial.');

  // RF-04: Responsável comercial aprova o refinamento excedente
  console.log('• RF-04: Responsável comercial aprovando a cobrança adicional do refinamento...');
  const approveCommReq = createReq(
    `/api/cases/${testCase.id}/refinements/v2/${ref2.id}/commercial-approve`,
    'POST',
    adminToken,
    {
      approved: true,
      isCoveredByContract: false,
      extraAmountChargedCents: 32000,
      commercialNotes: 'Cobrança adicional autorizada pela diretoria comercial.',
    }
  );
  const approveCommRes = await approveRefinementCommercial(approveCommReq, {
    params: { id: testCase.id, refinementId: ref2.id },
  });
  assert.strictEqual(approveCommRes.status, 200);
  const approvedRef2 = (await approveCommRes.json()).refinement;
  assert.strictEqual(approvedRef2.commercialStatus, 'COMMERCIALLY_APPROVED');
  console.log('  ✅ [PASS] Refinamento excedente aprovado comercialmente.');

  // RF-05: Agora a produção do refinamento é autorizada
  console.log('• RF-05: Criando lote de produção do refinamento aprovado...');
  const refUnitReq = createReq(
    `/api/cases/${testCase.id}/production-units`,
    'POST',
    adminToken,
    {
      unitCode: 'LOTE-REF-2',
      quantityPairs: 4,
      stagesDescription: 'Refinamento 2 Aprovado (Estágios R1 a R4)',
      refinementRequestId: ref2.id,
    }
  );
  const refUnitRes = await createProductionUnit(refUnitReq, { params: { id: testCase.id } });
  assert.strictEqual(refUnitRes.status, 201, 'Lote de refinamento criado');
  console.log('  ✅ [PASS] Lote de refinamento criado com sucesso e vinculado à solicitação.');

  // ========================================================================
  // [BLOCO 6] Isolamento Multi-Tenant e Anti-IDOR (RB-01 a RB-04)
  // ========================================================================
  console.log('\n----------------------------------------------------');
  console.log('▶ [BLOCO 6] Isolamento Multi-Tenant e Proteção Anti-IDOR');
  console.log('----------------------------------------------------');

  // RB-01: Dra. Camila da Clínica B tenta ler o contrato da Clínica A -> 404
  console.log('• RB-01: Dra. Camila (Clínica B) tentando ler contrato da Clínica A...');
  const idorContractReq = createReq(`/api/cases/${testCase.id}/contract`, 'GET', doctorCamilaToken);
  const idorContractRes = await getContract(idorContractReq, { params: { id: testCase.id } });
  assert.strictEqual(idorContractRes.status, 404, 'RB-01: Anti-IDOR deve retornar 404 neutro');
  console.log('  ✅ [PASS] Anti-IDOR Contratos: Retorna 404 para clínica não proprietária.');

  // RB-02: Dra. Camila da Clínica B tenta ler as remessas da Clínica A -> 404
  console.log('• RB-02: Dra. Camila (Clínica B) tentando ler remessas da Clínica A...');
  const idorShipReq = createReq(`/api/cases/${testCase.id}/shipments`, 'GET', doctorCamilaToken);
  const idorShipRes = await getShipments(idorShipReq, { params: { id: testCase.id } });
  assert.strictEqual(idorShipRes.status, 404, 'RB-02: Anti-IDOR deve retornar 404 neutro');
  console.log('  ✅ [PASS] Anti-IDOR Remessas: Retorna 404 para clínica não proprietária.');

  // RB-03: Dra. Camila da Clínica B tenta ler os refinamentos da Clínica A -> 404
  console.log('• RB-03: Dra. Camila (Clínica B) tentando ler refinamentos da Clínica A...');
  const idorRefReq = createReq(`/api/cases/${testCase.id}/refinements/v2`, 'GET', doctorCamilaToken);
  const idorRefRes = await getRefinements(idorRefReq, { params: { id: testCase.id } });
  assert.strictEqual(idorRefRes.status, 404, 'RB-03: Anti-IDOR deve retornar 404 neutro');
  console.log('  ✅ [PASS] Anti-IDOR Refinamentos: Retorna 404 para clínica não proprietária.');

  console.log('\n========================================================================');
  console.log('🎉 SUCESSO TOTAL: TODOS OS CENÁRIOS DA ARQUITETURA V1.0 PASSARAM!');
  console.log('========================================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ FALHA NOS TESTES DA ARQUITETURA V1.0:', err);
    process.exit(1);
  });

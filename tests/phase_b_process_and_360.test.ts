/**
 * FyAlign B2B — Suíte Integrada da Fase B:
 * Matriz de Processo v2.0, Motor de SLA Configurável, Nemo/WhatsApp/ERP (B-INT01) e Ficha 360° (B-P01)
 */

import assert from 'assert';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { ROLE_DEFAULT_PERMISSIONS, ROLES, UserRole } from '../src/lib/auth/rbac';
import {
  calculateProductionDueAt,
  calculateSecondBatchPrepDueAt,
  calculateSetupDueAt,
} from '../src/lib/sla/treatment-sla';
import { POST as upsertExternalLink } from '../src/app/api/external-links/route';
import {
  GET as getServiceOrders,
  POST as createServiceOrder,
} from '../src/app/api/cases/[id]/service-orders/route';
import { PATCH as patchServiceOrder } from '../src/app/api/cases/[id]/service-orders/[orderId]/route';
import {
  POST as createContract,
  PATCH as confirmContract,
} from '../src/app/api/cases/[id]/contract/route';
import { POST as approveSetup } from '../src/app/api/cases/[id]/setups/[setupId]/approve/route';
import { GET as getPatient360 } from '../src/app/api/patients/[id]/overview-360/route';
import { GET as getCase360 } from '../src/app/api/cases/[id]/overview-360/route';

function makeReq(url: string, method: string, token: string, body?: any): NextRequest {
  const headers = new Headers();
  headers.set('Cookie', `fyalign_access_token=${token}`);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function cleanupPhaseBTestData() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Case" WHERE "caseCode" LIKE 'FY-FASEB-%'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Patient" WHERE "email" LIKE '%@test-faseb.com'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "MembershipPermission" WHERE "membershipId" IN (SELECT id FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-faseb.com'))`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-faseb.com')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-faseb.com')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "User" WHERE email LIKE '%@test-faseb.com'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Organization" WHERE "taxId" IN ('77.111.222/0001-01', '77.111.222/0001-02', '77.111.222/0001-03')`
  );
}

async function provisionActor(params: {
  email: string;
  fullName: string;
  organizationId: string;
  organizationType: 'FYALIGN' | 'CLINIC';
  role: UserRole;
  croStatus?: 'NOT_REQUIRED' | 'VERIFIED';
}) {
  const user = await prisma.user.create({
    data: {
      email: params.email,
      fullName: params.fullName,
      passwordHash: 'hash-faseb',
      professionalIdCro: params.role === ROLES.DOCTOR ? 'CRO-SP-55110' : null,
    },
  });

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: params.organizationId,
      role: params.role,
      status: 'ACTIVE',
      croStatus: params.croStatus || 'NOT_REQUIRED',
      permissions: {
        create: ROLE_DEFAULT_PERMISSIONS[params.role].map((permission) => ({
          permission,
        })),
      },
    },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      membershipId: membership.id,
      isValid: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const token = await signAccessToken({
    userId: user.id,
    sessionId: session.id,
    activeMembershipId: membership.id,
    organizationId: params.organizationId,
    organizationType: params.organizationType,
    role: params.role,
    croStatus: membership.croStatus,
    email: user.email,
    fullName: user.fullName,
    professionalIdCro: user.professionalIdCro || undefined,
  });

  return { user, membership, token };
}

async function runPhaseBTests() {
  console.log('========================================================================');
  console.log('🚀 SUÍTE FASE B: MATRIZ V2.0, SLAS CONFIGURÁVEIS, B-INT01 & FICHA 360°');
  console.log('========================================================================\n');

  await cleanupPhaseBTestData();

  try {
    // ========================================================================
    // 1. Testes Puros do Motor de Prazos (SLA Engine)
    // ========================================================================
    console.log('▶ Bloco 1: Motor de Prazos (3 dias úteis Setup, 15 dias configurável, 2ª Leva T-30d)');

    // Sexta-feira 2026-10-30T12:00:00Z + 3 dias úteis => Seg(1), Ter(2), Qua(3) = 2026-11-04
    const friday = new Date('2026-10-30T12:00:00.000Z');
    const setupDue = calculateSetupDueAt(friday, 3);
    assert.strictEqual(
      setupDue.toISOString().slice(0, 10),
      '2026-11-04',
      'Sexta + 3 dias úteis deve pular fim de semana e cair na quarta-feira'
    );

    // 15 dias corridos vs 15 dias úteis
    const prodCalendar = calculateProductionDueAt(friday, {
      days: 15,
      dayType: 'CALENDAR_DAYS',
    });
    assert.strictEqual(prodCalendar.toISOString().slice(0, 10), '2026-11-14');

    const prodBusiness = calculateProductionDueAt(friday, {
      days: 15,
      dayType: 'BUSINESS_DAYS',
    });
    assert.strictEqual(
      prodBusiness.toISOString().slice(0, 10),
      '2026-11-20',
      'Sexta + 15 dias úteis deve cair em 3 semanas úteis (2026-11-20)'
    );

    const batchEnd = new Date('2027-04-30T12:00:00.000Z');
    const secondBatchPrep = calculateSecondBatchPrepDueAt(batchEnd, 30);
    assert.strictEqual(secondBatchPrep.toISOString().slice(0, 10), '2027-03-31');

    console.log('  ✅ PASS: Cálculos de SLA útil, corrido e gatilho T-30d validados.\n');

    // ========================================================================
    // 2. Provisionamento das Personas Reais (Ortodontista, Felipe, Dr. Adriano, Laís, Dr. Paulo)
    // ========================================================================
    const fyOrg = await prisma.organization.create({
      data: {
        type: 'FYALIGN',
        tradeName: 'FyAlign Matriz FaseB',
        legalName: 'FyAlign Tecnologia Ortodôntica Ltda',
        taxId: '77.111.222/0001-01',
        status: 'ACTIVE',
      },
    });

    const clinicA = await prisma.organization.create({
      data: {
        type: 'CLINIC',
        tradeName: 'Clínica Sorriso A FaseB',
        legalName: 'Clínica A Ltda',
        taxId: '77.111.222/0001-02',
        status: 'ACTIVE',
      },
    });

    const clinicB = await prisma.organization.create({
      data: {
        type: 'CLINIC',
        tradeName: 'Clínica Externa B FaseB',
        legalName: 'Clínica B Ltda',
        taxId: '77.111.222/0001-03',
        status: 'ACTIVE',
      },
    });

    const ortodontista = await provisionActor({
      email: 'ortodontista@test-faseb.com',
      fullName: 'Dr. Marcos Ortodontista',
      organizationId: clinicA.id,
      organizationType: 'CLINIC',
      role: ROLES.DOCTOR,
      croStatus: 'VERIFIED',
    });

    const ortodontistaClinicaB = await provisionActor({
      email: 'externo@test-faseb.com',
      fullName: 'Dra. Carla Outra Clínica',
      organizationId: clinicB.id,
      organizationType: 'CLINIC',
      role: ROLES.DOCTOR,
      croStatus: 'VERIFIED',
    });

    const felipeLab = await provisionActor({
      email: 'felipe.lab@test-faseb.com',
      fullName: 'Felipe Laboratório',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.PRODUCTION_QC,
    });

    const drAdriano = await provisionActor({
      email: 'adriano.setup@test-faseb.com',
      fullName: 'Dr. Adriano Planejamento',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.PLANNER_3D,
    });

    const laisComercial = await provisionActor({
      email: 'lais.vendas@test-faseb.com',
      fullName: 'Laís Comercial',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.SUPPORT,
    });

    const drPauloFinanceiro = await provisionActor({
      email: 'paulo.financas@test-faseb.com',
      fullName: 'Dr. Paulo Financeiro',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.FINANCE,
    });

    const patient = await prisma.patient.create({
      data: {
        clinicId: clinicA.id,
        fullName: 'João da Silva FaseB',
        birthDate: new Date('1992-07-15'),
        gender: 'Masculino',
        phone: '(11) 98888-7777',
        email: 'joao.paciente@test-faseb.com',
        tcleSigned: true,
      },
    });

    const treatmentCase = await prisma.case.create({
      data: {
        caseCode: `FY-FASEB-${Date.now()}`,
        patientId: patient.id,
        doctorId: ortodontista.user.id,
        doctorMembershipId: ortodontista.membership.id,
        clinicId: clinicA.id,
        status: 'SUBMITTED',
        treatedArches: 'BOTH',
        chiefComplaint: 'Apinhamento anterior moderado',
        submittedAt: new Date(),
      },
    });

    // ========================================================================
    // 3. B-INT01: Vínculo Prontuário Clínica (Clinicorp) + Bloqueios RBAC
    // ========================================================================
    console.log('▶ Bloco 2: Vínculo Externo de Prontuário (Clinicorp) e Isolamento RBAC');

    const linkRes = await upsertExternalLink(
      makeReq('/api/external-links', 'POST', ortodontista.token, {
        entityType: 'PATIENT',
        provider: 'CLINICORP',
        patientId: patient.id,
        externalId: '4821',
        secondaryCode: 'PR-900',
        externalUrl: 'https://app.clinicorp.com/patients/4821',
        metadata: { nextAppointmentDate: '2026-11-20' },
      })
    );
    assert.strictEqual(linkRes.status, 201, 'Ortodontista deve conseguir vincular prontuário Clinicorp');

    const finLinkAttempt = await upsertExternalLink(
      makeReq('/api/external-links', 'POST', drPauloFinanceiro.token, {
        entityType: 'PATIENT',
        provider: 'CLINICORP',
        patientId: patient.id,
        externalId: 'HACK',
      })
    );
    assert.strictEqual(finLinkAttempt.status, 403, 'Financeiro jamais deve alterar vínculo de prontuário');
    console.log('  ✅ PASS: Prontuário Clinicorp #4821 vinculado e protegido por RBAC.\n');

    // ========================================================================
    // 4. Fluxo Operacional Completo: Pedido Inicial -> Felipe (Docs + Nemo) -> Laís (Proposta + WhatsApp) -> Dr. Paulo (Fechamento)
    // ========================================================================
    console.log('▶ Bloco 3: Fluxo Real — Pedido Inicial, Nemo, WhatsApp e Gatilho Duplo com SLA Configurável');

    // 4.1 Criação da OS #1 (Pedido Inicial)
    const os1Res = await createServiceOrder(
      makeReq(`/api/cases/${treatmentCase.id}/service-orders`, 'POST', ortodontista.token, {
        type: 'INITIAL',
        alignerRangeStart: 1,
        alignerRangeEnd: 12,
      }),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(os1Res.status, 201);
    const os1Body = await os1Res.json();
    const initialOrderId = os1Body.serviceOrder.id;
    assert(os1Body.serviceOrder.setupDueAt, 'OS inicial deve calcular setupDueAt (3 dias úteis)');
    assert.strictEqual(os1Body.serviceOrder.nemoStatus, 'PENDING');

    // 4.2 Doutor tenta atualizar Nemo -> 403
    const docNemoAttempt = await patchServiceOrder(
      makeReq(
        `/api/cases/${treatmentCase.id}/service-orders/${initialOrderId}`,
        'PATCH',
        ortodontista.token,
        { action: 'UPDATE_NEMO', nemoStatus: 'INSERTED', nemoCaseId: 'ILLEGAL' }
      ),
      { params: { id: treatmentCase.id, orderId: initialOrderId } }
    );
    assert.strictEqual(docNemoAttempt.status, 403, 'Doutor da clínica não pode operar Nemo interno');

    // 4.3 Felipe confere documentação e insere no Nemo
    const verifyRes = await patchServiceOrder(
      makeReq(
        `/api/cases/${treatmentCase.id}/service-orders/${initialOrderId}`,
        'PATCH',
        felipeLab.token,
        { action: 'VERIFY_DOCS', notes: 'Escaneamentos superior/inferior validados' }
      ),
      { params: { id: treatmentCase.id, orderId: initialOrderId } }
    );
    assert.strictEqual(verifyRes.status, 200);

    const nemoRes = await patchServiceOrder(
      makeReq(
        `/api/cases/${treatmentCase.id}/service-orders/${initialOrderId}`,
        'PATCH',
        felipeLab.token,
        {
          action: 'UPDATE_NEMO',
          nemoStatus: 'INSERTED',
          nemoCaseId: 'NEMO-2026-777',
          nemoNotes: 'Segmentação pronta para Dr. Adriano',
        }
      ),
      { params: { id: treatmentCase.id, orderId: initialOrderId } }
    );
    assert.strictEqual(nemoRes.status, 200);
    const nemoBody = await nemoRes.json();
    assert.strictEqual(nemoBody.serviceOrder.status, 'IN_PLANNING');
    assert.strictEqual(nemoBody.serviceOrder.nemoCaseId, 'NEMO-2026-777');

    // 4.4 Setup publicado + Laís (SUPPORT) cria proposta contratual DRAFT (24 pares, SLA de 15 dias ÚTEIS) e envia via WhatsApp
    const publishedSetup = await prisma.setup.create({
      data: {
        caseId: treatmentCase.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        upperAlignersCount: 24,
        lowerAlignersCount: 24,
        plannerComments: 'Planejamento em 2 levas de 12 pares',
      },
    });

    const laisContractRes = await createContract(
      makeReq(`/api/cases/${treatmentCase.id}/contract`, 'POST', laisComercial.token, {
        packageName: 'Plano 12 Meses (24 Pares)',
        contractedAligners: 24,
        totalPriceCents: 360000,
        productionModel: 'PHASED_BATCHES',
        deliveryModel: 'BATCHED',
        includedRefinements: 2,
        setupSlaBusinessDays: 3,
        productionSlaDays: 15,
        productionSlaDayType: 'BUSINESS_DAYS',
      }),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(laisContractRes.status, 201, 'Laís (SUPPORT) deve emitir proposta contratual DRAFT');

    // Laís NÃO pode confirmar o fechamento financeiro (exclusivo Dr. Paulo / FINANCE)
    const laisConfirmAttempt = await confirmContract(
      makeReq(`/api/cases/${treatmentCase.id}/contract`, 'PATCH', laisComercial.token),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(laisConfirmAttempt.status, 403, 'Laís não pode confirmar contrato (autoridade exclusiva FINANCE/SUPER_ADMIN)');

    // Laís registra envio do Setup via WhatsApp
    const whatsappRes = await patchServiceOrder(
      makeReq(
        `/api/cases/${treatmentCase.id}/service-orders/${initialOrderId}`,
        'PATCH',
        laisComercial.token,
        {
          action: 'RECORD_COMMUNICATION',
          eventType: 'SETUP_SENT',
          channel: 'WHATSAPP',
          summary: 'Setup v1 e orçamento enviados via WhatsApp para Dr. Marcos',
        }
      ),
      { params: { id: treatmentCase.id, orderId: initialOrderId } }
    );
    assert.strictEqual(whatsappRes.status, 200);
    const whatsappBody = await whatsappRes.json();
    assert.strictEqual(whatsappBody.serviceOrder.status, 'WAITING_APPROVAL');

    // 4.5 Ortodontista aprova o Setup -> OS fica em WAITING_PAYMENT até Dr. Paulo confirmar o pagamento/contrato
    const setupApproveRes = await approveSetup(
      makeReq(
        `/api/cases/${treatmentCase.id}/setups/${publishedSetup.id}/approve`,
        'POST',
        ortodontista.token,
        { professionalAcceptance: true }
      ),
      { params: { id: treatmentCase.id, setupId: publishedSetup.id } }
    );
    assert.strictEqual(setupApproveRes.status, 200);

    const orderWaitingPayment = await prisma.serviceOrder.findUnique({
      where: { id: initialOrderId },
    });
    assert.strictEqual(orderWaitingPayment?.status, 'WAITING_PAYMENT');
    assert.strictEqual(orderWaitingPayment?.productionDueAt, null);

    // 4.6 Dr. Paulo (FINANCE) confirma contrato -> libera produção e calcula productionDueAt (15 dias úteis!)
    const pauloConfirmRes = await confirmContract(
      makeReq(`/api/cases/${treatmentCase.id}/contract`, 'PATCH', drPauloFinanceiro.token),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(pauloConfirmRes.status, 200);

    const orderReleased = await prisma.serviceOrder.findUnique({
      where: { id: initialOrderId },
    });
    assert.strictEqual(orderReleased?.status, 'RELEASED_FOR_PRODUCTION');
    assert(orderReleased?.productionDueAt !== null, 'productionDueAt deve ser calculado após gatilho duplo');

    // Cria 1ª Leva física (Pares 1–12) para validar o radar da 2ª Leva
    await prisma.productionUnit.create({
      data: {
        caseId: treatmentCase.id,
        contractId: (await prisma.caseCommercialContract.findUnique({ where: { caseId: treatmentCase.id } }))!.id,
        unitCode: 'LOTE-01',
        type: 'BATCH',
        quantityPairs: 12,
        stagesDescription: '1ª Leva: Alinhadores 1 a 12',
        status: 'QC_PASSED',
      },
    });

    console.log('  ✅ PASS: Fluxo completo do Pedido Inicial, Nemo, WhatsApp e Gatilho Duplo validado.\n');

    // ========================================================================
    // 5. Segunda Leva & Refinamento dentro do Mesmo Tratamento
    // ========================================================================
    console.log('▶ Bloco 4: Segunda Leva (Pares 13–24 sem orçamento/Nemo) e Refinamento Coberto');

    // Antes de disparar a 2ª leva, verifica que o radar na Ficha 360° detecta automaticamente os pares 13–24!
    const preRadarRes = await getPatient360(
      makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', ortodontista.token),
      { params: { id: patient.id } }
    );
    const preRadarBody = await preRadarRes.json();
    assert.strictEqual(preRadarBody.treatments[0].secondBatchRadar?.eligible, true);
    assert.strictEqual(preRadarBody.treatments[0].secondBatchRadar?.nextRangeStart, 13);
    assert.strictEqual(preRadarBody.treatments[0].secondBatchRadar?.nextRangeEnd, 24);

    // Felipe dispara preparação da Segunda Leva (13–24)
    const secondBatchRes = await createServiceOrder(
      makeReq(`/api/cases/${treatmentCase.id}/service-orders`, 'POST', felipeLab.token, {
        type: 'SECOND_BATCH',
        alignerRangeStart: 13,
        alignerRangeEnd: 24,
        mode: 'IMMEDIATE',
      }),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(secondBatchRes.status, 201);
    const secondBatchBody = await secondBatchRes.json();
    assert.strictEqual(secondBatchBody.serviceOrder.requiresNewBudget, false);
    assert.strictEqual(secondBatchBody.serviceOrder.nemoStatus, 'NOT_REQUIRED');
    assert(secondBatchBody.productionUnit, 'Deve gerar automaticamente o LOTE-02 para os pares 13–24');

    // Ortodontista abre Refinamento #1 (coberto pela franquia de 2 refinamentos)
    const refOrderRes = await createServiceOrder(
      makeReq(`/api/cases/${treatmentCase.id}/service-orders`, 'POST', ortodontista.token, {
        type: 'REFINEMENT',
        clinicalReason: 'Refinamento de rotação final do elemento 22',
      }),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(refOrderRes.status, 201);
    const refOrderBody = await refOrderRes.json();
    assert.strictEqual(refOrderBody.serviceOrder.requiresNewBudget, false, 'Refinamento na franquia não gera novo orçamento');
    assert.strictEqual(refOrderBody.serviceOrder.nemoStatus, 'PENDING');
    assert(refOrderBody.serviceOrder.setupDueAt, 'Refinamento calcula setupDueAt');

    const allOrdersRes = await getServiceOrders(
      makeReq(`/api/cases/${treatmentCase.id}/service-orders`, 'GET', drAdriano.token),
      { params: { id: treatmentCase.id } }
    );
    const allOrdersBody = await allOrdersRes.json();
    assert.strictEqual(allOrdersBody.serviceOrders.length, 3, 'Tratamento deve acumular as 3 solicitações (Inicial, 2ª Leva, Refinamento)');
    console.log('  ✅ PASS: Segunda Leva e Refinamento operam como ciclos distintos sob o mesmo Tratamento.\n');

    // ========================================================================
    // 6. Requisito B-P01: Ficha 360° Filtrada por Permissão + LGPD + Anti-IDOR
    // ========================================================================
    console.log('▶ Bloco 5: Ficha 360° Adaptativa por Perfil (Ortodontista × Laís × Felipe × Dr. Paulo × Clínica B)');

    // 6.1 Ortodontista: vê tudo da clínica + prontuário Clinicorp + contrato, mas NÃO vê ID interno do Nemo nem eventos internos
    const doc360Res = await getPatient360(
      makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', ortodontista.token),
      { params: { id: patient.id } }
    );
    assert.strictEqual(doc360Res.status, 200);
    const doc360 = await doc360Res.json();
    assert.strictEqual(doc360.patient.externalLinks.length, 1);
    assert.strictEqual(doc360.patient.externalLinks[0].provider, 'CLINICORP');
    assert(doc360.treatments[0].commercialContract !== null, 'Ortodontista vê resumo do plano contratado');
    assert.strictEqual(
      doc360.treatments[0].serviceOrders[0].nemo.nemoCaseId,
      null,
      'ID interno do Nemo fica oculto para clínica externa'
    );
    assert(
      doc360.treatments[0].operationalEvents.every((ev: any) => !ev.isInternalOnly),
      'Eventos internos de laboratório não vazam para a clínica'
    );

    // 6.2 Laís (SUPPORT): vê Ficha 360°, contrato e eventos WhatsApp, mas NÃO recebe exames/arquivos sensíveis
    const lais360Res = await getPatient360(
      makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', laisComercial.token),
      { params: { id: patient.id } }
    );
    assert.strictEqual(lais360Res.status, 200);
    const lais360 = await lais360Res.json();
    assert(lais360.treatments[0].commercialContract !== null, 'Laís vê status contratual');
    assert.strictEqual(lais360.treatments[0].documentation.files.length, 0, 'Laís não recebe arquivos radiográficos/STLs');
    assert.strictEqual(lais360.treatments[0].clinical, null, 'Laís não acessa anamnese oclusal detalhada');

    // 6.3 Felipe (PRODUCTION_QC): bloqueado em /api/patients/[id]/overview-360 (403), autorizado em /api/cases/[id]/overview-360 com PII minimizada, Nemo visível e contrato oculto!
    const felipePatientAttempt = await getPatient360(
      makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', felipeLab.token),
      { params: { id: patient.id } }
    );
    assert.strictEqual(felipePatientAttempt.status, 403);

    const felipeCase360Res = await getCase360(
      makeReq(`/api/cases/${treatmentCase.id}/overview-360`, 'GET', felipeLab.token),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(felipeCase360Res.status, 200);
    const felipeCase360 = await felipeCase360Res.json();
    assert.strictEqual(felipeCase360.patient.piiMinimized, true);
    assert.strictEqual(felipeCase360.patient.phone, null, 'Telefone pessoal oculto para QC (LGPD)');
    assert.strictEqual(felipeCase360.treatments[0].commercialContract, null, 'Contrato financeiro oculto para QC');
    assert.strictEqual(
      felipeCase360.treatments[0].serviceOrders[0].nemo.nemoCaseId,
      'NEMO-2026-777',
      'Felipe vê detalhes completos do caso no Nemo'
    );

    // 6.4 Dr. Paulo (FINANCE): bloqueado de prontuário e caso clínico (403 LGPD)
    const pauloPatientAttempt = await getPatient360(
      makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', drPauloFinanceiro.token),
      { params: { id: patient.id } }
    );
    const pauloCaseAttempt = await getCase360(
      makeReq(`/api/cases/${treatmentCase.id}/overview-360`, 'GET', drPauloFinanceiro.token),
      { params: { id: treatmentCase.id } }
    );
    assert.strictEqual(pauloPatientAttempt.status, 403);
    assert.strictEqual(pauloCaseAttempt.status, 403);

    // 6.5 Anti-IDOR Cross-Tenant: Clínica B recebe 404
    const clinicBAttempt = await getPatient360(
      makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', ortodontistaClinicaB.token),
      { params: { id: patient.id } }
    );
    assert.strictEqual(clinicBAttempt.status, 404, 'Clínica B deve receber 404 (Anti-IDOR)');

    console.log('  ✅ PASS: Ficha 360° adaptativa, LGPD Data Minimization e proteção Anti-IDOR 100% validados.\n');

    console.log('========================================================================');
    console.log('🏁 SUÍTE FASE B CONCLUÍDA COM 100% DE SUCESSO!');
    console.log('========================================================================\n');
  } finally {
    await cleanupPhaseBTestData();
  }
}

runPhaseBTests()
  .catch((err) => {
    console.error('❌ Falha nos testes da Fase B:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

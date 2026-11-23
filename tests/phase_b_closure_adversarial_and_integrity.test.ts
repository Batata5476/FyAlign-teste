/**
 * FyAlign B2B — Suíte de Fechamento B3/B4 (Adversarial RBAC, Máquina de Estados,
 * Bloqueio Categórico Sem Contrato, Auditoria Imutável, Idempotência e Integridade Comercial Retroativa)
 */

import assert from 'assert';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { ROLE_DEFAULT_PERMISSIONS, ROLES, UserRole } from '../src/lib/auth/rbac';

// Rotas testadas diretamente (sem depender de UI)
import { GET as getPatient360 } from '../src/app/api/patients/[id]/overview-360/route';
import { GET as getCase360 } from '../src/app/api/cases/[id]/overview-360/route';
import { GET as getContractsList } from '../src/app/api/contracts/route';
import { GET as getCaseDetail } from '../src/app/api/cases/[id]/route';
import { GET as getCaseFiles } from '../src/app/api/cases/[id]/files/route';
import { GET as getCasePrescription } from '../src/app/api/cases/[id]/prescription/route';
import { GET as getClinicalCondition } from '../src/app/api/cases/[id]/clinical-condition/route';
import { GET as getTreatmentPlan } from '../src/app/api/cases/[id]/treatment-plan/route';
import { GET as getCaseConsent } from '../src/app/api/cases/[id]/consent/route';
import { GET as getCaseSetups } from '../src/app/api/cases/[id]/setups/route';
import {
  GET as getCaseMessages,
  POST as postCaseMessage,
} from '../src/app/api/cases/[id]/messages/route';
import { GET as getOrders } from '../src/app/api/orders/route';
import { GET as getCasesExport } from '../src/app/api/reports/cases-export/route';
import {
  GET as getServiceOrders,
  POST as createServiceOrder,
} from '../src/app/api/cases/[id]/service-orders/route';
import { PATCH as patchServiceOrder } from '../src/app/api/cases/[id]/service-orders/[orderId]/route';
import { POST as createRefinementV2 } from '../src/app/api/cases/[id]/refinements/v2/route';
import { POST as approveRefinementCommercial } from '../src/app/api/cases/[id]/refinements/v2/[refinementId]/commercial-approve/route';
import {
  POST as createContract,
  PATCH as confirmContract,
} from '../src/app/api/cases/[id]/contract/route';
import { POST as amendContract } from '../src/app/api/cases/[id]/contract/amend/route';
import { POST as recordCommercialEvent } from '../src/app/api/cases/[id]/contract/events/route';
import { POST as approveSetup } from '../src/app/api/cases/[id]/setups/[setupId]/approve/route';

function makeReq(
  url: string,
  method: string,
  token: string,
  body?: any,
  extraHeaders?: Record<string, string>
): NextRequest {
  const headers = new Headers();
  headers.set('Cookie', `fyalign_access_token=${token}`);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function cleanupClosureTestData() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Case" WHERE "caseCode" LIKE 'FY-CLOSE-%'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Patient" WHERE "email" LIKE '%@test-closure-b3b4.com'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "MembershipPermission" WHERE "membershipId" IN (SELECT id FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-closure-b3b4.com'))`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-closure-b3b4.com')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-closure-b3b4.com')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "User" WHERE email LIKE '%@test-closure-b3b4.com'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Organization" WHERE "taxId" IN ('88.222.333/0001-01', '88.222.333/0001-02', '88.222.333/0001-03')`
  );
}

async function provisionActor(params: {
  email: string;
  fullName: string;
  organizationId: string;
  organizationType: 'FYALIGN' | 'CLINIC';
  role: UserRole;
  croStatus?: 'NOT_REQUIRED' | 'VERIFIED' | 'PENDING';
}) {
  const user = await prisma.user.create({
    data: {
      email: params.email,
      fullName: params.fullName,
      passwordHash: 'hash-closure-b3b4',
      role: params.role,
      professionalIdCro: params.role === ROLES.DOCTOR ? 'CRO-SP-88110' : null,
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

async function runClosureTests() {
  console.log('\n========================================================================');
  console.log('🛡️  SUÍTE DE FECHAMENTO B3/B4 — ADVERSARIAL RBAC, CICLO DE VIDA & INTEGRIDADE');
  console.log('========================================================================\n');

  await cleanupClosureTestData();

  try {
    const fyOrg = await prisma.organization.create({
      data: {
        type: 'FYALIGN',
        tradeName: 'FyAlign Matriz Closure Test',
        legalName: 'FyAlign Matriz Closure Test S/A',
        taxId: '88.222.333/0001-01',
        status: 'ACTIVE',
      },
    });

    const clinicA = await prisma.organization.create({
      data: {
        type: 'CLINIC',
        tradeName: 'Clínica Alpha Closure',
        legalName: 'Clínica Alpha Closure Ltda',
        taxId: '88.222.333/0001-02',
        status: 'ACTIVE',
      },
    });

    const clinicB = await prisma.organization.create({
      data: {
        type: 'CLINIC',
        tradeName: 'Clínica Beta Closure',
        legalName: 'Clínica Beta Closure Ltda',
        taxId: '88.222.333/0001-03',
        status: 'ACTIVE',
      },
    });

    const felipeQc = await provisionActor({
      email: 'felipe@test-closure-b3b4.com',
      fullName: 'Felipe Conferência',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.PRODUCTION_QC,
    });
    const drAdriano = await provisionActor({
      email: 'adriano@test-closure-b3b4.com',
      fullName: 'Dr. Adriano Planejador',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.PLANNER_3D,
    });
    const laisSupport = await provisionActor({
      email: 'lais@test-closure-b3b4.com',
      fullName: 'Laís Comercial',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.SUPPORT,
    });
    const drPauloFinance = await provisionActor({
      email: 'paulo@test-closure-b3b4.com',
      fullName: 'Dr. Paulo Financeiro',
      organizationId: fyOrg.id,
      organizationType: 'FYALIGN',
      role: ROLES.FINANCE,
    });
    const doctorVerified = await provisionActor({
      email: 'roberto@test-closure-b3b4.com',
      fullName: 'Dr. Roberto Ortodontista',
      organizationId: clinicA.id,
      organizationType: 'CLINIC',
      role: ROLES.DOCTOR,
      croStatus: 'VERIFIED',
    });
    const doctorPendingCro = await provisionActor({
      email: 'rafael.pendente@test-closure-b3b4.com',
      fullName: 'Dr. Rafael CRO Pendente',
      organizationId: clinicA.id,
      organizationType: 'CLINIC',
      role: ROLES.DOCTOR,
      croStatus: 'PENDING',
    });
    const clinicAssistant = await provisionActor({
      email: 'larissa@test-closure-b3b4.com',
      fullName: 'Larissa Assistente',
      organizationId: clinicA.id,
      organizationType: 'CLINIC',
      role: ROLES.CLINIC_ASSISTANT,
    });
    const doctorClinicB = await provisionActor({
      email: 'camila@test-closure-b3b4.com',
      fullName: 'Dra. Camila Clínica B',
      organizationId: clinicB.id,
      organizationType: 'CLINIC',
      role: ROLES.DOCTOR,
      croStatus: 'VERIFIED',
    });

    const patientSecretName = 'Helena Vasconcelos Sigilosa';
    const patient = await prisma.patient.create({
      data: {
        clinicId: clinicA.id,
        fullName: patientSecretName,
        birthDate: new Date('1991-06-15'),
        gender: 'Feminino',
        phone: '(11) 99988-7766',
        email: 'helena.sigilosa@test-closure-b3b4.com',
        tcleSigned: true,
      },
    });

    const trt = await prisma.case.create({
      data: {
        caseCode: 'FY-CLOSE-001',
        patientId: patient.id,
        doctorId: doctorVerified.user.id,
        doctorMembershipId: doctorVerified.membership.id,
        clinicId: clinicA.id,
        status: 'WAITING_DOCTOR_APPROVAL',
        treatedArches: 'BOTH',
        chiefComplaint: 'Queixa clínica confidencial de sobremordida profunda',
        doctorNotes: 'Nota médica estritamente confidencial',
        submittedAt: new Date(),
      },
    });

    await prisma.clinicalCondition.create({
      data: {
        caseId: trt.id,
        upperMidline: 'CENTERED',
        lowerMidline: 'DEVIATED_LEFT',
        canineRight: 'CLASS_II',
        canineLeft: 'CLASS_I',
        molarRight: 'CLASS_II',
        molarLeft: 'CLASS_I',
      },
    });

    await prisma.treatmentPlan.create({
      data: {
        caseId: trt.id,
        upperMidline: 'MAINTAIN',
        lowerMidline: 'IMPROVE',
        overjet: 'IMPROVE',
        overbite: 'IMPROVE',
        archForm: 'MAINTAIN',
        expansion: 'IMPROVE',
        canineRelationship: 'IMPROVE',
        molarRelationship: 'MAINTAIN',
        ipr: true,
        attachment: true,
        intermaxillaryElastic: 'NO',
        classIICorrection: 'CORRECT',
        classIIICorrection: 'DO_NOT_CORRECT',
        diastemas: 'NONE',
      },
    });

    await prisma.caseConsent.create({
      data: {
        caseId: trt.id,
        policyVersion: 'v1.0',
        policyHash: 'hash-close-001',
        acceptedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'TestSuite',
        scrollCompleted: true,
        signatureKey: 'sig-close-001',
        signatureHash: 'sighash-close-001',
      },
    });

    await prisma.caseFile.create({
      data: {
        caseId: trt.id,
        slotNumber: 11,
        category: 'SCAN_3D',
        type: 'STL_MAXILLA',
        originalFileName: 'arcada_superior_confidencial.stl',
        storageKey: `clinics/${clinicA.id}/cases/${trt.id}/slot_11.stl`,
        mimeType: 'application/octet-stream',
        fileSizeBytes: 2048,
        status: 'UPLOADED',
        uploadedById: doctorVerified.user.id,
      },
    });

    const initialOrder = await prisma.serviceOrder.create({
      data: {
        caseId: trt.id,
        orderNumber: 'FY-CLOSE-001-OS-01',
        sequenceNumber: 1,
        type: 'INITIAL',
        status: 'AWAITING_APPROVAL',
        title: 'Pedido Inicial — Alinhadores 1 a 12',
        alignerRangeStart: 1,
        alignerRangeEnd: 12,
        requiresNewBudget: false,
        nemoStatus: 'INSERTED',
        nemoCaseId: 'NEMO-CLOSE-001',
        receivedAt: new Date(),
        setupDueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        setupSentAt: new Date(),
        requestedById: doctorVerified.user.id,
      },
    });

    const setupV1 = await prisma.setup.create({
      data: {
        caseId: trt.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        upperAlignersCount: 24,
        lowerAlignersCount: 24,
        plannerComments: 'Comentário clínico do Setup 3D',
      },
    });

    await prisma.order.create({
      data: {
        caseId: trt.id,
        orderCode: 'PED-CLOSE-001',
        planType: 'FULL',
        amount: 4200,
        paymentStatus: 'PENDING',
      },
    });

    // ========================================================================
    // REQUISITO 1 & 2: BLOQUEIO CATEGÓRICO SEM SETUP APROVADO E SEM CONTRATO CONFIRMADO
    // ========================================================================
    console.log('▶ Requisito 1: Bloqueio categórico (409) de Segunda Leva e Refinamento sem Setup aprovado / Contrato confirmado');

    // 1.1 Sem Setup aprovado e sem Contrato -> 409
    const sbNoSetup = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'SECOND_BATCH',
        alignerRangeStart: 13,
        alignerRangeEnd: 24,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(sbNoSetup.status, 409, 'Segunda Leva bloqueada sem Setup inicial aprovado');

    const refNoSetup = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'REFINEMENT',
        clinicalReason: 'Tentativa prematura sem setup aprovado',
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(refNoSetup.status, 409, 'Refinamento OS bloqueado sem Setup inicial aprovado');

    const refV2NoSetup = await createRefinementV2(
      makeReq(`/api/cases/${trt.id}/refinements/v2`, 'POST', doctorVerified.token, {
        clinicalReason: 'Tentativa prematura v2',
        extraAlignersCount: 4,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(refV2NoSetup.status, 409, 'Refinamento v2 bloqueado sem Setup inicial aprovado');

    // 1.2 Aprova clinicamente o Setup Inicial, mas ainda SEM contrato -> continua bloqueado (409)!
    const approveSetupRes = await approveSetup(
      makeReq(`/api/cases/${trt.id}/setups/${setupV1.id}/approve`, 'POST', doctorVerified.token, {
        professionalAcceptance: true,
      }),
      { params: { id: trt.id, setupId: setupV1.id } }
    );
    assert.strictEqual(approveSetupRes.status, 200);

    const sbNoContract = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'SECOND_BATCH',
        alignerRangeStart: 13,
        alignerRangeEnd: 24,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(sbNoContract.status, 409, 'Segunda Leva bloqueada quando não há contrato');

    // 1.3 Laís cria proposta contratual em DRAFT -> ainda NÃO confirmado -> continua bloqueado (409)!
    const createDraftRes = await createContract(
      makeReq(
        `/api/cases/${trt.id}/contract`,
        'POST',
        laisSupport.token,
        {
          packageName: 'Pacote Closure 24 Pares',
          contractedAligners: 24,
          totalPriceCents: 420000,
          productionModel: 'HYBRID',
          deliveryModel: 'BATCHED',
          includedRefinements: 1,
          refinementWindowDays: 180,
          extraAlignerPriceCents: 15000,
          setupSlaBusinessDays: 3,
          productionSlaDays: 10,
          productionSlaDayType: 'BUSINESS_DAYS',
        },
        { 'Idempotency-Key': 'idem-contract-draft-001' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(createDraftRes.status, 201);

    const sbDraftContract = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'SECOND_BATCH',
        alignerRangeStart: 13,
        alignerRangeEnd: 24,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(sbDraftContract.status, 409, 'Segunda Leva bloqueada enquanto contrato está em DRAFT');

    const refDraftContract = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'REFINEMENT',
        clinicalReason: 'Tentativa com contrato ainda em DRAFT',
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(refDraftContract.status, 409, 'Refinamento bloqueado enquanto contrato está em DRAFT');

    // Mensagens preliminares (CaseMessage) e ocorrências comerciais permanecem liberadas!
    const prelimMsgRes = await postCaseMessage(
      makeReq(`/api/cases/${trt.id}/messages`, 'POST', doctorVerified.token, {
        content: 'Dúvida preliminar sobre cronograma antes do fechamento comercial.',
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(prelimMsgRes.status, 201, 'Mensagem preliminar permitida');

    const prelimCommEvRes = await recordCommercialEvent(
      makeReq(
        `/api/cases/${trt.id}/contract/events`,
        'POST',
        drPauloFinance.token,
        {
          eventType: 'BUDGET_SENT',
          channel: 'WHATSAPP',
          summary: 'Proposta R$ 4.200,00 enviada para assinatura',
        },
        { 'Idempotency-Key': 'idem-comm-ev-001' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(prelimCommEvRes.status, 201, 'Ocorrência comercial permitida');

    // 1.4 Dr. Paulo confirma o contrato -> Duplo Gatilho completo!
    const confirmRes = await confirmContract(
      makeReq(`/api/cases/${trt.id}/contract`, 'PATCH', drPauloFinance.token, {}),
      { params: { id: trt.id } }
    );
    assert.strictEqual(confirmRes.status, 200);

    // Aloca LOTE-01 inicial (12 pares) para representar 1ª leva física comprometida
    const confirmedContract = await prisma.caseCommercialContract.findUniqueOrThrow({
      where: { caseId: trt.id },
    });
    await prisma.productionUnit.create({
      data: {
        caseId: trt.id,
        contractId: confirmedContract.id,
        unitCode: 'LOTE-01',
        type: 'BATCH',
        quantityPairs: 12,
        shippedQuantity: 12,
        stagesDescription: 'Alinhadores 01 a 12',
        status: 'SHIPPED',
      },
    });

    console.log('  ✅ PASS: Bloqueio categórico sem Setup/Contrato e liberação pós-confirmação validados.\n');

    // ========================================================================
    // REQUISITO 2 & 3: MÁQUINA DE ESTADOS DA SEGUNDA LEVA + TRILHA DE AUDITORIA IMUTÁVEL
    // ========================================================================
    console.log('▶ Requisito 2: Autorização exclusiva DOCTOR CRO VERIFIED, 3 estados da 2ª Leva e Auditoria Imutável');

    // Tentativas negadas (403) de abertura direta da Segunda Leva
    for (const deniedActor of [
      { label: 'CLINIC_ASSISTANT', actor: clinicAssistant },
      { label: 'DOCTOR CRO PENDING', actor: doctorPendingCro },
      { label: 'PRODUCTION_QC', actor: felipeQc },
      { label: 'PLANNER_3D', actor: drAdriano },
      { label: 'SUPPORT', actor: laisSupport },
      { label: 'FINANCE', actor: drPauloFinance },
    ]) {
      const deniedRes = await createServiceOrder(
        makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', deniedActor.actor.token, {
          type: 'SECOND_BATCH',
          alignerRangeStart: 13,
          alignerRangeEnd: 24,
        }),
        { params: { id: trt.id } }
      );
      assert.strictEqual(
        deniedRes.status,
        403,
        `${deniedActor.label} deve receber 403 ao tentar disparar Segunda Leva`
      );
    }

    // Passo 1: DOCTOR CRO VERIFIED abre Segunda Leva -> estritamente RECEIVED
    const openSbRes = await createServiceOrder(
      makeReq(
        `/api/cases/${trt.id}/service-orders`,
        'POST',
        doctorVerified.token,
        {
          type: 'SECOND_BATCH',
          alignerRangeStart: 13,
          alignerRangeEnd: 24,
          notes: 'Solicitação formal pelo ortodontista',
        },
        { 'Idempotency-Key': 'idem-sb-open-001' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(openSbRes.status, 201);
    const openSbBody = await openSbRes.json();
    const sbOrderId = openSbBody.serviceOrder.id;
    assert.strictEqual(openSbBody.serviceOrder.status, 'RECEIVED');
    assert.strictEqual(openSbBody.productionUnit, null);

    // Tentativa de pular conferência/programação (RECEIVED -> RELEASE_PRODUCTION direto) -> 409!
    const prematureRelease = await patchServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders/${sbOrderId}`, 'PATCH', felipeQc.token, {
        action: 'RELEASE_PRODUCTION',
      }),
      { params: { id: trt.id, orderId: sbOrderId } }
    );
    assert.strictEqual(
      prematureRelease.status,
      409,
      'Não pode liberar produção de Segunda Leva sem passar por SCHEDULED'
    );

    // Tentativa de clínica programar Segunda Leva -> 403!
    const clinicScheduleAttempt = await patchServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders/${sbOrderId}`, 'PATCH', doctorVerified.token, {
        action: 'SCHEDULE_SECOND_BATCH',
      }),
      { params: { id: trt.id, orderId: sbOrderId } }
    );
    assert.strictEqual(clinicScheduleAttempt.status, 403);

    // Passo 2: Felipe confere e programa (RECEIVED -> SCHEDULED)
    const scheduleSbRes = await patchServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders/${sbOrderId}`, 'PATCH', felipeQc.token, {
        action: 'SCHEDULE_SECOND_BATCH',
        scheduledPrepAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Modelos base conferidos internamente',
      }),
      { params: { id: trt.id, orderId: sbOrderId } }
    );
    assert.strictEqual(scheduleSbRes.status, 200);
    const scheduleSbBody = await scheduleSbRes.json();
    assert.strictEqual(scheduleSbBody.serviceOrder.status, 'SCHEDULED');

    // Tentativa de clínica liberar produção -> 403!
    const clinicReleaseAttempt = await patchServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders/${sbOrderId}`, 'PATCH', doctorVerified.token, {
        action: 'RELEASE_PRODUCTION',
      }),
      { params: { id: trt.id, orderId: sbOrderId } }
    );
    assert.strictEqual(clinicReleaseAttempt.status, 403);

    // Passo 3: Dr. Adriano (ou Felipe) libera para produção (SCHEDULED -> RELEASED_FOR_PRODUCTION + LOTE-02)
    const releaseSbRes = await patchServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders/${sbOrderId}`, 'PATCH', drAdriano.token, {
        action: 'RELEASE_PRODUCTION',
      }),
      { params: { id: trt.id, orderId: sbOrderId } }
    );
    assert.strictEqual(releaseSbRes.status, 200);
    const releaseSbBody = await releaseSbRes.json();
    assert.strictEqual(releaseSbBody.serviceOrder.status, 'RELEASED_FOR_PRODUCTION');
    assert.strictEqual(releaseSbBody.productionUnit?.unitCode, 'LOTE-02');
    assert.strictEqual(releaseSbBody.productionUnit?.quantityPairs, 12);

    // Verifica carimbos no banco + trilha AuditLog imutável (solicitante, conferente, liberador e timestamps)
    const persistedSb = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: sbOrderId } });
    assert.strictEqual(persistedSb.requestedById, doctorVerified.user.id);
    assert.strictEqual(persistedSb.docsVerifiedById, felipeQc.user.id);
    assert.strictEqual(persistedSb.productionReleasedById, drAdriano.user.id);
    assert(persistedSb.receivedAt && persistedSb.docsVerifiedAt && persistedSb.productionReleasedAt);

    const sbAuditLogs = await prisma.auditLog.findMany({
      where: {
        caseId: trt.id,
        action: {
          in: [
            'SERVICE_ORDER_SECOND_BATCH_CREATED',
            'SERVICE_ORDER_SECOND_BATCH_SCHEDULED',
            'SERVICE_ORDER_PRODUCTION_RELEASED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    assert.strictEqual(sbAuditLogs.length, 3, 'Deve existir 1 AuditLog imutável para cada transição da 2ª Leva');
    assert.strictEqual(sbAuditLogs[0].userId, doctorVerified.user.id, 'AuditLog 1 grava ortodontista solicitante');
    assert.strictEqual(sbAuditLogs[1].userId, felipeQc.user.id, 'AuditLog 2 grava responsável pela conferência/programação');
    assert.strictEqual(sbAuditLogs[2].userId, drAdriano.user.id, 'AuditLog 3 grava responsável pela liberação fabril');
    console.log('  ✅ PASS: Máquina de 3 estados da Segunda Leva e Auditoria Imutável 100% validadas.\n');

    // ========================================================================
    // REQUISITO 4: IDEMPOTÊNCIA E PROTEÇÃO CONTRA DUPLICAÇÃO
    // ========================================================================
    console.log('▶ Requisito 3: Idempotência (Replay seguro com Idempotency-Key e bloqueio de duplicatas)');

    // Replay da abertura da 2ª Leva com mesma Idempotency-Key retorna 200 sem criar nova OS
    const replaySbRes = await createServiceOrder(
      makeReq(
        `/api/cases/${trt.id}/service-orders`,
        'POST',
        doctorVerified.token,
        {
          type: 'SECOND_BATCH',
          alignerRangeStart: 13,
          alignerRangeEnd: 24,
        },
        { 'Idempotency-Key': 'idem-sb-open-001' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(replaySbRes.status, 200);
    const replaySbBody = await replaySbRes.json();
    assert.strictEqual(replaySbBody.idempotentReplay, true);
    assert.strictEqual(replaySbBody.serviceOrder.id, sbOrderId);

    // Nova tentativa sem Idempotency-Key para os mesmos pares já alocados no LOTE-02 -> 409 (saldo 0 pares disponíveis!)
    const duplicateSbNoKey = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'SECOND_BATCH',
        alignerRangeStart: 13,
        alignerRangeEnd: 24,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(duplicateSbNoKey.status, 409);

    // Replay de ocorrência comercial com mesma Idempotency-Key -> 200 sem duplicar evento
    const replayCommEv = await recordCommercialEvent(
      makeReq(
        `/api/cases/${trt.id}/contract/events`,
        'POST',
        drPauloFinance.token,
        {
          eventType: 'BUDGET_SENT',
          channel: 'WHATSAPP',
          summary: 'Proposta R$ 4.200,00 enviada para assinatura',
        },
        { 'Idempotency-Key': 'idem-comm-ev-001' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(replayCommEv.status, 200);
    assert.strictEqual((await replayCommEv.json()).idempotentReplay, true);

    console.log('  ✅ PASS: Idempotência e bloqueio de duplicidade validados.\n');

    // ========================================================================
    // REQUISITO 5: INTEGRIDADE COMERCIAL RETROATIVA FRENTE A ADITIVOS CONTRATUAIS
    // ========================================================================
    console.log('▶ Requisito 4: Integridade Comercial Retroativa (Aditivo v2 jamais altera solicitações v1 já abertas)');

    // Contrato v1 tem includedRefinements = 1 e extraAlignerPriceCents = 15000 (R$ 150,00).
    // Abre RF-01 (Coberto pela franquia de 1 refinamento!)
    const rf1Res = await createServiceOrder(
      makeReq(
        `/api/cases/${trt.id}/service-orders`,
        'POST',
        doctorVerified.token,
        {
          type: 'REFINEMENT',
          clinicalReason: 'Refinamento coberto pela franquia original v1',
          extraAlignersCount: 4,
        },
        { 'Idempotency-Key': 'idem-rf1-v1' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(rf1Res.status, 201);
    const rf1Body = await rf1Res.json();
    assert.strictEqual(rf1Body.refinement.isCoveredByContract, true);
    assert.strictEqual(rf1Body.refinement.contractVersionUsed, 1);
    assert.strictEqual(rf1Body.refinement.extraAmountChargedCents, 0);
    assert.strictEqual(rf1Body.serviceOrder.requiresNewBudget, false);

    // Duplicata acidental idêntica do mesmo refinamento em aberto sem Idempotency-Key -> 409!
    const dupRf1Res = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'REFINEMENT',
        clinicalReason: 'Refinamento coberto pela franquia original v1',
        extraAlignersCount: 4,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(dupRf1Res.status, 409, 'Duplo clique em refinamento idêntico aberto bloqueado com 409');

    // Abre RF-02 (Excede a franquia de 1 -> 4 pares * R$ 150,00 = R$ 600,00 / 60000 centavos na v1)
    const rf2Res = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'REFINEMENT',
        clinicalReason: 'Segundo refinamento extra-franquia sob regra v1',
        extraAlignersCount: 4,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(rf2Res.status, 201);
    const rf2Body = await rf2Res.json();
    assert.strictEqual(rf2Body.refinement.isCoveredByContract, false);
    assert.strictEqual(rf2Body.refinement.contractVersionUsed, 1);
    assert.strictEqual(rf2Body.refinement.extraAmountChargedCents, 60000);
    assert.strictEqual(rf2Body.serviceOrder.requiresNewBudget, true);

    // Agora Dr. Paulo registra Aditivo Contratual v2 zerando franquia (includedRefinements: 0)
    // e elevando preço do par extra para R$ 250,00 (25000 centavos)!
    const amendV2Res = await amendContract(
      makeReq(
        `/api/cases/${trt.id}/contract/amend`,
        'POST',
        drPauloFinance.token,
        {
          changeReason: 'Revisão de política comercial para solicitações futuras (v2)',
          contractedAligners: 30,
          totalPriceCents: 500000,
          includedRefinements: 0,
          extraAlignerPriceCents: 25000,
        },
        { 'Idempotency-Key': 'idem-amend-v2' }
      ),
      { params: { id: trt.id } }
    );
    assert.strictEqual(amendV2Res.status, 200);

    // Verifica que RF-01 e RF-02 permanecem 100% INTACTOS no banco!
    const rf1AfterAmend = await prisma.refinementRequest.findUniqueOrThrow({
      where: { id: rf1Body.refinement.id },
    });
    const rf1OrderAfterAmend = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id: rf1Body.serviceOrder.id },
    });
    assert.strictEqual(rf1AfterAmend.isCoveredByContract, true, 'RF-01 continua coberto apesar do aditivo v2');
    assert.strictEqual(rf1AfterAmend.contractVersionUsed, 1, 'RF-01 preserva contractVersionUsed = 1');
    assert.strictEqual(rf1AfterAmend.extraAmountChargedCents, 0, 'RF-01 preserva custo zero');
    assert.strictEqual(rf1OrderAfterAmend.requiresNewBudget, false, 'OS do RF-01 continua sem novo orçamento');

    const rf2AfterAmend = await prisma.refinementRequest.findUniqueOrThrow({
      where: { id: rf2Body.refinement.id },
    });
    assert.strictEqual(rf2AfterAmend.contractVersionUsed, 1, 'RF-02 preserva contractVersionUsed = 1');
    assert.strictEqual(
      rf2AfterAmend.extraAmountChargedCents,
      60000,
      'RF-02 preserva valor de R$ 600,00 da v1 (não reprecificado para R$ 1.000,00 da v2)'
    );

    // E um NOVO RF-03 aberto APÓS o aditivo aplica a v2 (25000 * 4 = 100000)!
    const rf3Res = await createServiceOrder(
      makeReq(`/api/cases/${trt.id}/service-orders`, 'POST', doctorVerified.token, {
        type: 'REFINEMENT',
        clinicalReason: 'Terceiro refinamento já na vigência do aditivo v2',
        extraAlignersCount: 4,
      }),
      { params: { id: trt.id } }
    );
    assert.strictEqual(rf3Res.status, 201);
    const rf3Body = await rf3Res.json();
    assert.strictEqual(rf3Body.refinement.contractVersionUsed, 2);
    assert.strictEqual(rf3Body.refinement.extraAmountChargedCents, 100000);

    // Dr. Paulo aprova comercialmente o RF-02 pela sua superfície comercial
    const approveRf2Res = await approveRefinementCommercial(
      makeReq(
        `/api/cases/${trt.id}/refinements/v2/${rf2Body.refinement.id}/commercial-approve`,
        'POST',
        drPauloFinance.token,
        {
          approved: true,
          isCoveredByContract: false,
          extraAmountChargedCents: 60000,
          commercialNotes: 'Pagamento extra aprovado pelo Financeiro.',
        }
      ),
      { params: { id: trt.id, refinementId: rf2Body.refinement.id } }
    );
    assert.strictEqual(approveRf2Res.status, 200);

    console.log('  ✅ PASS: Integridade comercial retroativa frente a aditivos validada com perfeição.\n');

    // ========================================================================
    // REQUISITO 1 (COMPLETO): TESTES ADVERSARIAIS DE RBAC E ANTI-VAZAMENTO EM ENDPOINTS DIRETOS
    // ========================================================================
    console.log('▶ Requisito 5: Matriz Adversarial de RBAC em Endpoints Diretos (Zero Vazamento Clínico/Financeiro)');

    // 5.1 Dr. Paulo (FINANCE):
    // - 403 em TODAS as rotas clínicas/prontuário/arquivos/setup/chat/OS
    assert.strictEqual(
      (await getPatient360(makeReq(`/api/patients/${patient.id}/overview-360`, 'GET', drPauloFinance.token), { params: { id: patient.id } })).status,
      403,
      'FINANCE 403 em /api/patients/[id]/overview-360'
    );
    assert.strictEqual(
      (await getCaseDetail(makeReq(`/api/cases/${trt.id}`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]'
    );
    assert.strictEqual(
      (await getCaseFiles(makeReq(`/api/cases/${trt.id}/files`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/files'
    );
    assert.strictEqual(
      (await getCasePrescription(makeReq(`/api/cases/${trt.id}/prescription`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/prescription'
    );
    assert.strictEqual(
      (await getClinicalCondition(makeReq(`/api/cases/${trt.id}/clinical-condition`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/clinical-condition'
    );
    assert.strictEqual(
      (await getTreatmentPlan(makeReq(`/api/cases/${trt.id}/treatment-plan`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/treatment-plan'
    );
    assert.strictEqual(
      (await getCaseConsent(makeReq(`/api/cases/${trt.id}/consent`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/consent'
    );
    assert.strictEqual(
      (await getCaseSetups(makeReq(`/api/cases/${trt.id}/setups`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/setups'
    );
    assert.strictEqual(
      (await getCaseMessages(makeReq(`/api/cases/${trt.id}/messages`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/messages'
    );
    assert.strictEqual(
      (await getServiceOrders(makeReq(`/api/cases/${trt.id}/service-orders`, 'GET', drPauloFinance.token), { params: { id: trt.id } })).status,
      403,
      'FINANCE 403 em /api/cases/[id]/service-orders'
    );

    // - 200 em /api/contracts com pseudonimização PAC-XXXX e anti-oracle contra busca por nome civil!
    const pauloContractsRes = await getContractsList(
      makeReq('/api/contracts', 'GET', drPauloFinance.token)
    );
    assert.strictEqual(pauloContractsRes.status, 200);
    const pauloContractsRaw = JSON.stringify(await pauloContractsRes.json());
    assert(!pauloContractsRaw.includes(patientSecretName), 'Nome civil jamais vaza em /api/contracts para FINANCE');
    assert(!pauloContractsRaw.includes('sobremordida'), 'Queixa clínica jamais vaza em /api/contracts');

    const oracleAttemptRes = await getContractsList(
      makeReq(`/api/contracts?search=${encodeURIComponent('Helena Vasconcelos')}`, 'GET', drPauloFinance.token)
    );
    const oracleAttemptBody = await oracleAttemptRes.json();
    assert.strictEqual(
      oracleAttemptBody.items.length,
      0,
      'FINANCE não pode descobrir paciente buscando pelo nome real (anti-oracle)'
    );

    // - 200 em /api/cases/[id]/overview-360 em modo COMMERCIAL_ONLY com zero dado clínico no JSON bruto!
    const paulo360Res = await getCase360(
      makeReq(`/api/cases/${trt.id}/overview-360`, 'GET', drPauloFinance.token),
      { params: { id: trt.id } }
    );
    assert.strictEqual(paulo360Res.status, 200);
    const paulo360RawText = await paulo360Res.text();
    assert(!paulo360RawText.includes(patientSecretName), 'Nome civil ausente do JSON de overview-360 para FINANCE');
    assert(!paulo360RawText.includes('arcada_superior_confidencial'), 'Arquivos STL ausentes para FINANCE');
    assert(!paulo360RawText.includes('sobremordida'), 'Queixa clínica ausente para FINANCE');
    assert(!paulo360RawText.includes('Comentário clínico do Setup'), 'Setup 3D ausente para FINANCE');
    assert(!paulo360RawText.includes('franquia original v1'), 'Motivo clínico do refinamento redigido para FINANCE');

    // - /api/orders pseudonimiza paciente para FINANCE
    const pauloOrdersRes = await getOrders(makeReq('/api/orders', 'GET', drPauloFinance.token));
    const pauloOrdersRaw = await pauloOrdersRes.text();
    assert(!pauloOrdersRaw.includes(patientSecretName), 'Nome civil pseudonimizado em /api/orders para FINANCE');

    // 5.2 Laís (SUPPORT): bloqueada de prescrição, arquivos, condição oclusal, plano e termo clínico!
    assert.strictEqual(
      (await getCaseFiles(makeReq(`/api/cases/${trt.id}/files`, 'GET', laisSupport.token), { params: { id: trt.id } })).status,
      403,
      'SUPPORT 403 em /api/cases/[id]/files'
    );
    assert.strictEqual(
      (await getCasePrescription(makeReq(`/api/cases/${trt.id}/prescription`, 'GET', laisSupport.token), { params: { id: trt.id } })).status,
      403,
      'SUPPORT 403 em /api/cases/[id]/prescription'
    );
    assert.strictEqual(
      (await getClinicalCondition(makeReq(`/api/cases/${trt.id}/clinical-condition`, 'GET', laisSupport.token), { params: { id: trt.id } })).status,
      403,
      'SUPPORT 403 em /api/cases/[id]/clinical-condition'
    );
    assert.strictEqual(
      (await getTreatmentPlan(makeReq(`/api/cases/${trt.id}/treatment-plan`, 'GET', laisSupport.token), { params: { id: trt.id } })).status,
      403,
      'SUPPORT 403 em /api/cases/[id]/treatment-plan'
    );
    assert.strictEqual(
      (await getCaseConsent(makeReq(`/api/cases/${trt.id}/consent`, 'GET', laisSupport.token), { params: { id: trt.id } })).status,
      403,
      'SUPPORT 403 em /api/cases/[id]/consent'
    );
    assert.strictEqual(
      (await confirmContract(makeReq(`/api/cases/${trt.id}/contract`, 'PATCH', laisSupport.token, {}), { params: { id: trt.id } })).status,
      403,
      'SUPPORT 403 ao tentar confirmar contrato (exclusivo Financeiro/Admin)'
    );

    // 5.3 Felipe (PRODUCTION_QC) & Dr. Adriano (PLANNER_3D): bloqueados de /api/contracts e sem vazamento de R$ na timeline ou CSV!
    assert.strictEqual(
      (await getContractsList(makeReq('/api/contracts', 'GET', felipeQc.token))).status,
      403,
      'PRODUCTION_QC 403 em /api/contracts'
    );
    assert.strictEqual(
      (await getContractsList(makeReq('/api/contracts', 'GET', drAdriano.token))).status,
      403,
      'PLANNER_3D 403 em /api/contracts'
    );

    const adriano360Res = await getCase360(
      makeReq(`/api/cases/${trt.id}/overview-360`, 'GET', drAdriano.token),
      { params: { id: trt.id } }
    );
    const adriano360Text = await adriano360Res.text();
    assert(!adriano360Text.includes('R$ 4.200,00'), 'Dr. Adriano não vê valores comerciais R$ na timeline');

    const felipeCsvRes = await getCasesExport(
      makeReq('/api/reports/cases-export', 'GET', felipeQc.token)
    );
    assert.strictEqual(felipeCsvRes.status, 200);
    const felipeCsvText = await felipeCsvRes.text();
    assert(!felipeCsvText.includes(patientSecretName), 'CSV pseudonimiza nome para PRODUCTION_QC (!PATIENT_READ)');
    assert(!felipeCsvText.includes('4200.00'), 'CSV mascara valor financeiro para PRODUCTION_QC (!CONTRACT_READ)');

    // 5.4 Cross-Tenant Anti-IDOR (Clínica B):
    assert.strictEqual(
      (await getCase360(makeReq(`/api/cases/${trt.id}/overview-360`, 'GET', doctorClinicB.token), { params: { id: trt.id } })).status,
      404,
      'Clínica B recebe 404 em /api/cases/[id]/overview-360 de outra clínica'
    );
    const clinicBContractsRes = await getContractsList(
      makeReq('/api/contracts', 'GET', doctorClinicB.token)
    );
    const clinicBContractsBody = await clinicBContractsRes.json();
    assert.strictEqual(
      clinicBContractsBody.items.some((c: any) => c.caseId === trt.id),
      false,
      'Clínica B jamais enxerga contratos da Clínica A em /api/contracts'
    );

    console.log('  ✅ PASS: Matriz adversarial de endpoints diretos e proteção Anti-IDOR 100% validados!\n');

    console.log('========================================================================');
    console.log('🏆 SUÍTE DE FECHAMENTO B3/B4 CONCLUÍDA COM 100% DE APROVAÇÃO!');
    console.log('========================================================================\n');
  } finally {
    await cleanupClosureTestData();
  }
}

runClosureTests()
  .catch((err) => {
    console.error('❌ Falha na suíte de fechamento B3/B4:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

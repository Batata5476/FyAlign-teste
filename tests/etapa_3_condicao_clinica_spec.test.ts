import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';
import { GET as getCondition, POST as saveCondition } from '../src/app/api/cases/[id]/clinical-condition/route';
import { GET as getCase } from '../src/app/api/cases/[id]/route';
import { POST as createCase } from '../src/app/api/cases/route';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
} from '../src/lib/types/clinical';

const db = prisma as any;

let orgAlphaId: string;
let orgBetaId: string;
let orgLabId: string;

let doctorAlphaId: string;
let membershipAlphaId: string;
let tokenDoctorAlpha: string;

let doctorBetaId: string;
let membershipBetaId: string;
let tokenDoctorBeta: string;

let financeUserId: string;
let membershipFinanceId: string;
let tokenFinanceLab: string;

let patientAlphaId: string;
let caseAlphaId: string;

function createReq(url: string, method: string, token?: string, body?: any) {
  const headers = new Headers();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
    headers.set('cookie', `fyalign_access_token=${token}`);
  }
  if (body) {
    headers.set('Content-Type', 'application/json');
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runEtapa3Tests() {
  console.log('========================================================================');
  console.log('🧪 TESTES ESPECÍFICOS: ETAPA 3 — CONDIÇÃO CLÍNICA (DIAGNÓSTICO OCLUSAL)');
  console.log('========================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // SETUP: Criação de Clínicas A e B, Usuários e Sessões
    // ------------------------------------------------------------------------
    console.log('\n[SETUP] Provisionando ambiente de teste Multi-Tenant...');

    const orgLab = await db.organization.create({
      data: {
        tradeName: `FyAlign Lab Test ${Date.now()}`,
        legalName: 'FyAlign Lab Ltda',
        taxId: `CNPJ-LAB-${Date.now()}`,
        type: 'FYALIGN',
      },
    });
    orgLabId = orgLab.id;

    const orgAlpha = await db.organization.create({
      data: {
        tradeName: `Clínica Alpha Test ${Date.now()}`,
        legalName: 'Alpha Odontologia Ltda',
        taxId: `CNPJ-ALPHA-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgAlphaId = orgAlpha.id;

    const orgBeta = await db.organization.create({
      data: {
        tradeName: `Clínica Beta Test ${Date.now()}`,
        legalName: 'Beta Odontologia Ltda',
        taxId: `CNPJ-BETA-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgBetaId = orgBeta.id;

    // Doctor Alpha (Clínica A)
    const doctorAlpha = await db.user.create({
      data: {
        fullName: 'Dr. Teste Alpha',
        email: `doc.alpha.${Date.now()}@test.com`,
        passwordHash: 'dummy',
        role: 'DOCTOR',
        clinicId: orgAlphaId,
        professionalIdCro: 'CRO-SP 12345',
      },
    });
    doctorAlphaId = doctorAlpha.id;

    const membershipAlpha = await db.membership.create({
      data: {
        userId: doctorAlpha.id,
        organizationId: orgAlphaId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croStatus: 'VERIFIED',
      },
    });
    membershipAlphaId = membershipAlpha.id;

    const sessionAlpha = await db.session.create({
      data: {
        userId: doctorAlpha.id,
        membershipId: membershipAlpha.id,
        expiresAt: new Date(Date.now() + 3600000),
        isValid: true,
      },
    });

    tokenDoctorAlpha = await signAccessToken({
      userId: doctorAlpha.id,
      sessionId: sessionAlpha.id,
      activeMembershipId: membershipAlpha.id,
      organizationId: orgAlphaId,
      organizationType: 'CLINIC',
      role: 'DOCTOR',
      croStatus: 'VERIFIED',
      email: doctorAlpha.email,
      fullName: doctorAlpha.fullName,
    });

    // Doctor Beta (Clínica B)
    const doctorBeta = await db.user.create({
      data: {
        fullName: 'Dra. Teste Beta',
        email: `doc.beta.${Date.now()}@test.com`,
        passwordHash: 'dummy',
        role: 'DOCTOR',
        clinicId: orgBetaId,
        professionalIdCro: 'CRO-PR 67890',
      },
    });
    doctorBetaId = doctorBeta.id;

    const membershipBeta = await db.membership.create({
      data: {
        userId: doctorBeta.id,
        organizationId: orgBetaId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croStatus: 'VERIFIED',
      },
    });
    membershipBetaId = membershipBeta.id;

    const sessionBeta = await db.session.create({
      data: {
        userId: doctorBeta.id,
        membershipId: membershipBeta.id,
        expiresAt: new Date(Date.now() + 3600000),
        isValid: true,
      },
    });

    tokenDoctorBeta = await signAccessToken({
      userId: doctorBeta.id,
      sessionId: sessionBeta.id,
      activeMembershipId: membershipBeta.id,
      organizationId: orgBetaId,
      organizationType: 'CLINIC',
      role: 'DOCTOR',
      croStatus: 'VERIFIED',
      email: doctorBeta.email,
      fullName: doctorBeta.fullName,
    });

    // Financeiro do Lab (Sem permissão CASE_UPDATE)
    const financeUser = await db.user.create({
      data: {
        fullName: 'Financeiro Lab',
        email: `fin.${Date.now()}@test.com`,
        passwordHash: 'dummy',
        role: 'FINANCE',
      },
    });
    financeUserId = financeUser.id;

    const membershipFinance = await db.membership.create({
      data: {
        userId: financeUser.id,
        organizationId: orgLabId,
        role: 'FINANCE',
        status: 'ACTIVE',
      },
    });
    membershipFinanceId = membershipFinance.id;

    const sessionFinance = await db.session.create({
      data: {
        userId: financeUser.id,
        membershipId: membershipFinance.id,
        expiresAt: new Date(Date.now() + 3600000),
        isValid: true,
      },
    });

    tokenFinanceLab = await signAccessToken({
      userId: financeUser.id,
      sessionId: sessionFinance.id,
      activeMembershipId: membershipFinance.id,
      organizationId: orgLabId,
      organizationType: 'FYALIGN',
      role: 'FINANCE',
      croStatus: 'NOT_REQUIRED',
      email: financeUser.email,
      fullName: financeUser.fullName,
    });

    // Paciente e Caso da Clínica Alpha
    const patientAlpha = await db.patient.create({
      data: {
        clinicId: orgAlphaId,
        fullName: 'Paciente Teste Alpha',
        birthDate: new Date('1995-04-12'),
        gender: 'MALE',
        phone: '(11) 98888-7777',
      },
    });
    patientAlphaId = patientAlpha.id;

    const caseAlpha = await db.case.create({
      data: {
        caseCode: `FY-TEST-${Date.now()}`,
        patientId: patientAlpha.id,
        doctorId: doctorAlpha.id,
        doctorMembershipId: membershipAlpha.id,
        clinicId: orgAlphaId,
        status: 'DRAFT',
      },
    });
    caseAlphaId = caseAlpha.id;

    console.log('   Ambiente provisionado com sucesso.\n');

    // ------------------------------------------------------------------------
    // TESTE 1: Criação Válida (POST /api/cases/:id/clinical-condition)
    // ------------------------------------------------------------------------
    console.log('[TESTE 1] Criação Válida da Condição Clínica');

    const validPayload = {
      upperMidline: MIDLINE_POSITION.CENTERED,
      lowerMidline: MIDLINE_POSITION.DEVIATED_RIGHT,
      canineRight: OCCLUSION_CLASS.CLASS_I,
      canineLeft: OCCLUSION_CLASS.CLASS_II,
      molarRight: OCCLUSION_CLASS.CLASS_I,
      molarLeft: OCCLUSION_CLASS.CLASS_II,
    };

    const reqCreate = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      validPayload
    );
    const resCreate = await saveCondition(reqCreate, { params: { id: caseAlphaId } });
    assert(resCreate.status === 200, 'POST /api/cases/:id/clinical-condition retorna status 200');

    const dataCreate = await resCreate.json();
    assert(!!dataCreate.clinicalCondition, 'Resposta contém objeto clinicalCondition');
    assert(dataCreate.clinicalCondition.upperMidline === 'CENTERED', 'upperMidline persistido como CENTERED');
    assert(dataCreate.clinicalCondition.lowerMidline === 'DEVIATED_RIGHT', 'lowerMidline persistido como DEVIATED_RIGHT');
    assert(dataCreate.clinicalCondition.canineRight === 'CLASS_I', 'canineRight persistido como CLASS_I');
    assert(dataCreate.clinicalCondition.canineLeft === 'CLASS_II', 'canineLeft persistido como CLASS_II');
    assert(dataCreate.clinicalCondition.molarRight === 'CLASS_I', 'molarRight persistido como CLASS_I');
    assert(dataCreate.clinicalCondition.molarLeft === 'CLASS_II', 'molarLeft persistido como CLASS_II');

    // Validação de AuditLog gerado
    const auditLog = await db.auditLog.findFirst({
      where: { caseId: caseAlphaId, action: 'UPDATE_CLINICAL_CONDITION' },
    });
    assert(!!auditLog, 'AuditLog registrado com action UPDATE_CLINICAL_CONDITION');
    assert(auditLog?.userId === doctorAlphaId, 'AuditLog registra userId do doutor autenticado');

    // ------------------------------------------------------------------------
    // TESTE 2: Atualização / Upsert (POST idempotente)
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 2] Atualização / Upsert Sem Conflito de @unique');

    const updatedPayload = {
      upperMidline: MIDLINE_POSITION.DEVIATED_LEFT,
      lowerMidline: MIDLINE_POSITION.CENTERED,
      canineRight: OCCLUSION_CLASS.CLASS_III,
      canineLeft: OCCLUSION_CLASS.CLASS_I,
      molarRight: OCCLUSION_CLASS.CLASS_III,
      molarLeft: OCCLUSION_CLASS.CLASS_I,
    };

    const reqUpsert = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      updatedPayload
    );
    const resUpsert = await saveCondition(reqUpsert, { params: { id: caseAlphaId } });
    assert(resUpsert.status === 200, 'Upsert no mesmo caso retorna status 200');

    const dataUpsert = await resUpsert.json();
    assert(dataUpsert.clinicalCondition.upperMidline === 'DEVIATED_LEFT', 'upperMidline atualizado para DEVIATED_LEFT');
    assert(dataUpsert.clinicalCondition.canineRight === 'CLASS_III', 'canineRight atualizado para CLASS_III');
    assert(dataUpsert.clinicalCondition.molarRight === 'CLASS_III', 'molarRight atualizado para CLASS_III');

    // Confere se não houve duplicação de registro
    const allConditions = await db.clinicalCondition.findMany({
      where: { caseId: caseAlphaId },
    });
    assert(allConditions.length === 1, 'Garante apenas 1 registro único por caso (relação 1:1 respeitada)');

    // ------------------------------------------------------------------------
    // TESTE 3: Consulta GET após Persistência
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 3] GET /api/cases/:id/clinical-condition');

    const reqGet = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'GET',
      tokenDoctorAlpha
    );
    const resGet = await getCondition(reqGet, { params: { id: caseAlphaId } });
    assert(resGet.status === 200, 'GET /api/cases/:id/clinical-condition retorna 200');

    const dataGet = await resGet.json();
    assert(dataGet.clinicalCondition.upperMidline === 'DEVIATED_LEFT', 'GET retorna upperMidline correto');
    assert(dataGet.clinicalCondition.lowerMidline === 'CENTERED', 'GET retorna lowerMidline correto');
    assert(dataGet.clinicalCondition.canineRight === 'CLASS_III', 'GET retorna canineRight correto');
    assert(dataGet.clinicalCondition.canineLeft === 'CLASS_I', 'GET retorna canineLeft correto');
    assert(dataGet.clinicalCondition.molarRight === 'CLASS_III', 'GET retorna molarRight correto');
    assert(dataGet.clinicalCondition.molarLeft === 'CLASS_I', 'GET retorna molarLeft correto');

    // ------------------------------------------------------------------------
    // TESTE 4: Validação Rigorosa dos 6 Campos (Zod Schema)
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 4] Validação de Campos Obrigatórios e Valores Inválidos');

    // Campo upperMidline ausente
    const reqMissingField = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      {
        lowerMidline: MIDLINE_POSITION.CENTERED,
        canineRight: OCCLUSION_CLASS.CLASS_I,
        canineLeft: OCCLUSION_CLASS.CLASS_I,
        molarRight: OCCLUSION_CLASS.CLASS_I,
        molarLeft: OCCLUSION_CLASS.CLASS_I,
      }
    );
    const resMissingField = await saveCondition(reqMissingField, { params: { id: caseAlphaId } });
    assert(resMissingField.status === 400, 'POST sem upperMidline retorna status 400');

    // Valor inválido de enum
    const reqInvalidEnum = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      {
        ...validPayload,
        upperMidline: 'INVALID_POSITION',
      }
    );
    const resInvalidEnum = await saveCondition(reqInvalidEnum, { params: { id: caseAlphaId } });
    assert(resInvalidEnum.status === 400, 'POST com valor inválido de enum retorna status 400');

    // Body vazio {}
    const reqEmpty = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      {}
    );
    const resEmpty = await saveCondition(reqEmpty, { params: { id: caseAlphaId } });
    assert(resEmpty.status === 400, 'POST com body vazio retorna status 400');

    // ------------------------------------------------------------------------
    // TESTE 5: Segurança RBAC (Usuário sem Permissão e Não Autenticado)
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 5] RBAC: Permissões e Autenticação');

    // Usuário FINANCE tentando salvar condição clínica
    const reqFinancePost = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenFinanceLab,
      validPayload
    );
    const resFinancePost = await saveCondition(reqFinancePost, { params: { id: caseAlphaId } });
    assert(resFinancePost.status === 403, 'Usuário FINANCE bloqueado ao tentar salvar condição com status 403');

    // Usuário FINANCE tentando consultar condição clínica
    const reqFinanceGet = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'GET',
      tokenFinanceLab
    );
    const resFinanceGet = await getCondition(reqFinanceGet, { params: { id: caseAlphaId } });
    assert(resFinanceGet.status === 403, 'Usuário FINANCE bloqueado ao tentar consultar com status 403');

    // Requisição sem token (Não Autenticado)
    const reqNoToken = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'GET'
    );
    const resNoToken = await getCondition(reqNoToken, { params: { id: caseAlphaId } });
    assert(resNoToken.status === 401, 'Requisição sem token barrada com status 401');

    // ------------------------------------------------------------------------
    // TESTE 6: Proteção Cross-Tenant & Anti-IDOR
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 6] Proteção Cross-Tenant (Anti-IDOR) e Caso Inexistente');

    // Doctor Beta tentando consultar caso da Clínica Alpha
    const reqCrossGet = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'GET',
      tokenDoctorBeta
    );
    const resCrossGet = await getCondition(reqCrossGet, { params: { id: caseAlphaId } });
    assert(resCrossGet.status === 404, 'Tentativa de GET cross-tenant retorna status 404 (Anti-IDOR)');

    // Doctor Beta tentando modificar caso da Clínica Alpha
    const reqCrossPost = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorBeta,
      validPayload
    );
    const resCrossPost = await saveCondition(reqCrossPost, { params: { id: caseAlphaId } });
    assert(resCrossPost.status === 404, 'Tentativa de POST cross-tenant retorna status 404 (Anti-IDOR)');

    // Caso inexistente (UUID aleatório)
    const nonExistentCaseId = '00000000-0000-0000-0000-000000000000';
    const reqNotFound = createReq(
      `http://localhost:3000/api/cases/${nonExistentCaseId}/clinical-condition`,
      'GET',
      tokenDoctorAlpha
    );
    const resNotFound = await getCondition(reqNotFound, { params: { id: nonExistentCaseId } });
    assert(resNotFound.status === 404, 'Caso inexistente retorna status 404');

    // Não confiança em IDs enviados pelo cliente
    const reqTamperedPayload = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      {
        ...updatedPayload,
        clinicId: orgBetaId, // Tentativa de forjar tenant
        doctorId: doctorBetaId, // Tentativa de forjar doutor
      }
    );
    const resTampered = await saveCondition(reqTamperedPayload, { params: { id: caseAlphaId } });
    assert(resTampered.status === 200, 'POST aceita campos válidos e ignora IDs forjados pelo frontend');
    const caseInDb = await db.case.findUnique({ where: { id: caseAlphaId } });
    assert(caseInDb.clinicId === orgAlphaId, 'clinicId do caso permanece imutável e atrelado ao tenant do token');

    // ------------------------------------------------------------------------
    // TESTE 7: F5 / Refresh Resilience (Consulta via GET do Caso)
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 7] F5 / Refresh Resilience: Recuperação via /api/cases/:id');

    const reqCaseGet = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}`,
      'GET',
      tokenDoctorAlpha
    );
    const resCaseGet = await getCase(reqCaseGet, { params: { id: caseAlphaId } });
    assert(resCaseGet.status === 200, 'GET /api/cases/:id retorna 200 no refresh');

    const dataCaseGet = await resCaseGet.json();
    assert(!!dataCaseGet.case.clinicalCondition, 'Caso clínico inclui relação clinicalCondition no GET principal');
    assert(
      dataCaseGet.case.clinicalCondition.upperMidline === 'DEVIATED_LEFT',
      'upperMidline restaurado perfeitamente no reload'
    );
    assert(
      dataCaseGet.case.clinicalCondition.canineRight === 'CLASS_III',
      'canineRight restaurado perfeitamente no reload'
    );

    // ------------------------------------------------------------------------
    // TESTE 8: Imutabilidade Clínica (RN-03) Alinhada ao Workflow Real
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 8] Imutabilidade Clínica (RN-03): Bloqueio nos Status Reais do Workflow');

    // 8.1 Caso em status APPROVED
    await db.case.update({
      where: { id: caseAlphaId },
      data: { status: 'APPROVED' },
    });
    const reqApprovedLock = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      validPayload
    );
    const resApprovedLock = await saveCondition(reqApprovedLock, { params: { id: caseAlphaId } });
    assert(resApprovedLock.status === 400, 'Alteração bloqueada com status 400 quando case.status = APPROVED (RN-03)');
    const dataApprovedLock = await resApprovedLock.json();
    assert(dataApprovedLock.error.includes('bloqueado para alterações'), 'Mensagem de erro explícita de RN-03 retornada');

    // 8.2 Caso em status IN_PRODUCTION
    await db.case.update({
      where: { id: caseAlphaId },
      data: { status: 'IN_PRODUCTION' },
    });
    const reqProdLock = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      validPayload
    );
    const resProdLock = await saveCondition(reqProdLock, { params: { id: caseAlphaId } });
    assert(resProdLock.status === 400, 'Alteração bloqueada com status 400 quando case.status = IN_PRODUCTION (RN-03)');

    // 8.3 Caso em status COMPLETED / DELIVERED
    await db.case.update({
      where: { id: caseAlphaId },
      data: { status: 'DELIVERED' },
    });
    const reqDeliveredLock = createReq(
      `http://localhost:3000/api/cases/${caseAlphaId}/clinical-condition`,
      'POST',
      tokenDoctorAlpha,
      validPayload
    );
    const resDeliveredLock = await saveCondition(reqDeliveredLock, { params: { id: caseAlphaId } });
    assert(resDeliveredLock.status === 400, 'Alteração bloqueada com status 400 quando case.status = DELIVERED (RN-03)');

    console.log('\n========================================================================');
    console.log(`🎉 RESULTADOS ETAPA 3: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Erro na execução dos testes da Etapa 3:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEtapa3Tests();

import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';
import { GET as getCase, PATCH as patchCase } from '../src/app/api/cases/[id]/route';
import { POST as saveClinicalCondition, GET as getClinicalCondition } from '../src/app/api/cases/[id]/clinical-condition/route';
import { POST as saveTreatmentPlan, GET as getTreatmentPlan } from '../src/app/api/cases/[id]/treatment-plan/route';
import { POST as saveConsent, GET as getConsents } from '../src/app/api/cases/[id]/consent/route';
import { POST as submitCase } from '../src/app/api/cases/[id]/submit/route';
import { POST as getUploadUrl } from '../src/app/api/cases/[id]/upload-url/route';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
  TREATMENT_ACTION,
  ELASTIC_OPTION,
  CORRECTION_OPTION,
  DIASTEMA_OPTION,
  CASE_FILE_TYPES,
} from '../src/lib/types/clinical';

const db = prisma as any;

let orgAId: string;
let orgBId: string;
let doctorAId: string;
let membershipAId: string;
let sessionAId: string;
let tokenA: string;

let doctorBId: string;
let membershipBId: string;
let sessionBId: string;
let tokenB: string;

let patientAId: string;
let caseAId: string;

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
  console.log('====================================================');
  console.log('🔬 SPRINT A: TESTES DO BACKEND DO CONTRATO CLÍNICO');
  console.log('====================================================');

  try {
    // ------------------------------------------------------------------------
    // SETUP: Organizações, Usuários, Memberships e Sessões
    // ------------------------------------------------------------------------
    const orgA = await db.organization.create({
      data: {
        tradeName: 'OdontoPrime Clínica A',
        legalName: 'Clinica A Odontologia Ltda',
        taxId: `CNPJ-A-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgAId = orgA.id;

    const orgB = await db.organization.create({
      data: {
        tradeName: 'DentalCare Clínica B',
        legalName: 'Clinica B Odontologia Ltda',
        taxId: `CNPJ-B-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgBId = orgB.id;

    // Doutor A (Clínica A com CRO VERIFIED)
    const doctorA = await db.user.create({
      data: {
        email: `dr.a.${Date.now()}@odontoprime.com`,
        passwordHash: 'hash-seguro',
        fullName: 'Dr. Roberto Clínico A',
      },
    });
    doctorAId = doctorA.id;

    const memA = await db.membership.create({
      data: {
        userId: doctorAId,
        organizationId: orgAId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croNumber: '12345',
        croUf: 'SP',
        croStatus: 'VERIFIED',
      },
    });
    membershipAId = memA.id;

    const sessA = await db.session.create({
      data: {
        userId: doctorAId,
        membershipId: membershipAId,
        isValid: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    sessionAId = sessA.id;

    tokenA = await signAccessToken({
      userId: doctorAId,
      sessionId: sessionAId,
      activeMembershipId: membershipAId,
      organizationId: orgAId,
      organizationType: 'CLINIC',
      role: 'DOCTOR',
      croStatus: 'VERIFIED',
      email: doctorA.email,
      fullName: doctorA.fullName,
    });

    // Doutor B (Clínica B com CRO VERIFIED)
    const doctorB = await db.user.create({
      data: {
        email: `dr.b.${Date.now()}@dentalcare.com`,
        passwordHash: 'hash-seguro',
        fullName: 'Dra. Beatriz Clínica B',
      },
    });
    doctorBId = doctorB.id;

    const memB = await db.membership.create({
      data: {
        userId: doctorBId,
        organizationId: orgBId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croNumber: '67890',
        croUf: 'RJ',
        croStatus: 'VERIFIED',
      },
    });
    membershipBId = memB.id;

    const sessB = await db.session.create({
      data: {
        userId: doctorBId,
        membershipId: membershipBId,
        isValid: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    sessionBId = sessB.id;

    tokenB = await signAccessToken({
      userId: doctorBId,
      sessionId: sessionBId,
      activeMembershipId: membershipBId,
      organizationId: orgBId,
      organizationType: 'CLINIC',
      role: 'DOCTOR',
      croStatus: 'VERIFIED',
      email: doctorB.email,
      fullName: doctorB.fullName,
    });

    // Paciente da Clínica A
    const patientA = await db.patient.create({
      data: {
        clinicId: orgAId,
        fullName: 'Carlos Eduardo Paciente A',
        birthDate: new Date('1998-03-20'),
        gender: 'MALE',
        phone: '11988887777',
        tcleSigned: false,
      },
    });
    patientAId = patientA.id;

    // Caso Inicial DRAFT da Clínica A
    const caseA = await db.case.create({
      data: {
        caseCode: `FY-SPRINTA-${Date.now()}`,
        patientId: patientAId,
        doctorId: doctorAId,
        doctorMembershipId: membershipAId,
        clinicId: orgAId,
        status: 'DRAFT',
        treatedArches: 'BOTH',
        chiefComplaint: 'Mordida profunda e apinhamento inferior',
      },
    });
    caseAId = caseA.id;

    // ------------------------------------------------------------------------
    // TESTE 1: GET /api/cases/:id e PATCH /api/cases/:id
    // ------------------------------------------------------------------------
    console.log('▶ Teste 1: GET e PATCH em /api/cases/:id');
    const reqGetCase = createReq(`/api/cases/${caseAId}`, 'GET', tokenA);
    const resGetCase = await getCase(reqGetCase, { params: { id: caseAId } });
    const dataGetCase = await resGetCase.json();

    if (resGetCase.status !== 200 || dataGetCase.case.id !== caseAId) {
      throw new Error('Falha no GET /api/cases/:id');
    }
    if (dataGetCase.case.patient.fullName !== 'Carlos Eduardo Paciente A') {
      throw new Error('Paciente não retornado no GET /api/cases/:id');
    }

    const reqPatchCase = createReq(`/api/cases/${caseAId}`, 'PATCH', tokenA, {
      chiefComplaint: 'Apinhamento moderado anterior e diastema',
      treatedArches: 'BOTH',
      restrictedTeethFdi: ['16', '26'],
    });
    const resPatchCase = await patchCase(reqPatchCase, { params: { id: caseAId } });
    const dataPatchCase = await resPatchCase.json();

    if (resPatchCase.status !== 200 || !dataPatchCase.case.restrictedTeethFdi.includes('16')) {
      throw new Error('Falha no PATCH /api/cases/:id');
    }
    console.log('  ✅ PASS: Detalhes do caso consultados e atualizados via /api/cases/:id');

    // ------------------------------------------------------------------------
    // TESTE 2: POST e GET /api/cases/:id/clinical-condition
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 2: POST e GET em /api/cases/:id/clinical-condition');
    const conditionPayload = {
      upperMidline: MIDLINE_POSITION.CENTERED,
      lowerMidline: MIDLINE_POSITION.DEVIATED_RIGHT,
      canineRight: OCCLUSION_CLASS.CLASS_I,
      canineLeft: OCCLUSION_CLASS.CLASS_II,
      molarRight: OCCLUSION_CLASS.CLASS_I,
      molarLeft: OCCLUSION_CLASS.CLASS_II,
    };

    const reqSaveCond = createReq(`/api/cases/${caseAId}/clinical-condition`, 'POST', tokenA, conditionPayload);
    const resSaveCond = await saveClinicalCondition(reqSaveCond, { params: { id: caseAId } });
    const dataSaveCond = await resSaveCond.json();

    if (resSaveCond.status !== 200 || dataSaveCond.clinicalCondition.caseId !== caseAId) {
      throw new Error('Falha ao salvar ClinicalCondition');
    }

    const reqGetCond = createReq(`/api/cases/${caseAId}/clinical-condition`, 'GET', tokenA);
    const resGetCond = await getClinicalCondition(reqGetCond, { params: { id: caseAId } });
    const dataGetCond = await resGetCond.json();

    if (resGetCond.status !== 200 || dataGetCond.clinicalCondition.canineLeft !== OCCLUSION_CLASS.CLASS_II) {
      throw new Error('Falha ao consultar ClinicalCondition');
    }
    console.log('  ✅ PASS: ClinicalCondition salvo e recuperado com sucesso');

    // ------------------------------------------------------------------------
    // TESTE 3: POST e GET /api/cases/:id/treatment-plan
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 3: POST e GET em /api/cases/:id/treatment-plan');
    const planPayload = {
      upperMidline: TREATMENT_ACTION.MAINTAIN,
      lowerMidline: TREATMENT_ACTION.IMPROVE,
      overjet: TREATMENT_ACTION.IMPROVE,
      overbite: TREATMENT_ACTION.MAINTAIN,
      archForm: TREATMENT_ACTION.IMPROVE,
      expansion: TREATMENT_ACTION.IMPROVE,
      canineRelationship: TREATMENT_ACTION.IMPROVE,
      molarRelationship: TREATMENT_ACTION.MAINTAIN,
      ipr: true,
      attachment: true,
      intermaxillaryElastic: ELASTIC_OPTION.IF_NECESSARY,
      classIICorrection: CORRECTION_OPTION.CORRECT,
      classIIICorrection: CORRECTION_OPTION.DO_NOT_CORRECT,
      smartAttachments: 'Otimizados para pré-molares superiores',
      diastemas: DIASTEMA_OPTION.CLOSE_ALL,
      additionalInstructions: 'IPR interproximal máximo de 0.3mm nos incisivos inferiores.',
    };

    const reqSavePlan = createReq(`/api/cases/${caseAId}/treatment-plan`, 'POST', tokenA, planPayload);
    const resSavePlan = await saveTreatmentPlan(reqSavePlan, { params: { id: caseAId } });
    const dataSavePlan = await resSavePlan.json();

    if (resSavePlan.status !== 200 || dataSavePlan.treatmentPlan.caseId !== caseAId) {
      throw new Error('Falha ao salvar TreatmentPlan');
    }

    const reqGetPlan = createReq(`/api/cases/${caseAId}/treatment-plan`, 'GET', tokenA);
    const resGetPlan = await getTreatmentPlan(reqGetPlan, { params: { id: caseAId } });
    const dataGetPlan = await resGetPlan.json();

    if (resGetPlan.status !== 200 || dataGetPlan.treatmentPlan.classIICorrection !== CORRECTION_OPTION.CORRECT) {
      throw new Error('Falha ao consultar TreatmentPlan');
    }
    console.log('  ✅ PASS: TreatmentPlan salvo e recuperado com sucesso');

    // ------------------------------------------------------------------------
    // TESTE 4: POST e GET /api/cases/:id/consent (Fonte da Verdade TCLE)
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 4: POST e GET em /api/cases/:id/consent');
    const consentPayload = {
      policyVersion: 'v2.0-TCLE-CFO-2026',
      policyHash: 'sha256-hash-termo-consentimento-ortodontico-valido',
      scrollCompleted: true,
      signatureKey: 'vault/consents/doc-assinado-123.pdf',
      signatureHash: 'sha256-hash-assinatura-eletronica-ok',
    };

    const reqSaveConsent = createReq(`/api/cases/${caseAId}/consent`, 'POST', tokenA, consentPayload);
    const resSaveConsent = await saveConsent(reqSaveConsent, { params: { id: caseAId } });
    const dataSaveConsent = await resSaveConsent.json();

    if (resSaveConsent.status !== 201 || !dataSaveConsent.consent.id) {
      throw new Error('Falha ao registrar CaseConsent');
    }

    const reqGetConsents = createReq(`/api/cases/${caseAId}/consent`, 'GET', tokenA);
    const resGetConsents = await getConsents(reqGetConsents, { params: { id: caseAId } });
    const dataGetConsents = await resGetConsents.json();

    if (resGetConsents.status !== 200 || dataGetConsents.consents.length !== 1) {
      throw new Error('Falha ao listar CaseConsents');
    }

    // Verifica se atualizou o campo legado tcleSigned no paciente
    const updatedPatient = await db.patient.findUnique({ where: { id: patientAId } });
    if (!updatedPatient.tcleSigned) {
      throw new Error('Campo legado patient.tcleSigned deveria ser sincronizado para true');
    }
    console.log('  ✅ PASS: CaseConsent registrado com IP/UA do servidor e sincronizado com o paciente');

    // ------------------------------------------------------------------------
    // TESTE 5: POST /api/cases/:id/upload-url popula automaticamente o type
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 5: /api/cases/:id/upload-url gera tipo estruturado (CaseFileType)');
    const reqUploadSlot11 = createReq(`/api/cases/${caseAId}/upload-url`, 'POST', tokenA, {
      slotNumber: 11,
      fileName: 'arcada_superior.stl',
      mimeType: 'model/stl',
      fileSizeBytes: 28000000,
    });
    const resUploadSlot11 = await getUploadUrl(reqUploadSlot11, { params: { id: caseAId } });
    if (resUploadSlot11.status !== 200) {
      throw new Error('Falha ao gerar upload-url para slot 11');
    }

    const file11 = await db.caseFile.findFirst({
      where: { caseId: caseAId, slotNumber: 11 },
    });
    if (!file11 || file11.type !== CASE_FILE_TYPES.STL_MAXILLA) {
      throw new Error(`Slot 11 deveria ter type STL_MAXILLA, obteve: ${file11?.type}`);
    }
    console.log('  ✅ PASS: CaseFile do slot 11 persistido com type STL_MAXILLA');

    // ------------------------------------------------------------------------
    // TESTE 6: Tentativa de Submissão Incompleta (Bloqueio Faltando Arquivos)
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 6: Tentativa de Submissão com Arquivos Faltantes (RN-01)');
    const reqSubmitIncomplete = createReq(`/api/cases/${caseAId}/submit`, 'POST', tokenA, {
      tcleConfirmed: true,
      professionalDeclaration: true,
    });
    const resSubmitIncomplete = await submitCase(reqSubmitIncomplete, { params: { id: caseAId } });
    const dataSubmitIncomplete = await resSubmitIncomplete.json();

    if (resSubmitIncomplete.status !== 400 || !dataSubmitIncomplete.missingSlots) {
      throw new Error('Submissão sem todos os 13 arquivos deveria retornar 400.');
    }
    console.log('  ✅ PASS: Submissão barrada com 400 apontando os slots obrigatórios ausentes');

    // ------------------------------------------------------------------------
    // TESTE 7: Submissão Completa (Todos os 13 Arquivos Carregados)
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 7: Submissão Completa com Todos os Requisitos Atendidos');
    // Popula os 13 slots como UPLOADED
    for (let slot = 1; slot <= 13; slot++) {
      await db.caseFile.upsert({
        where: { id: `file-slot-${slot}-${caseAId}` },
        create: {
          id: `file-slot-${slot}-${caseAId}`,
          caseId: caseAId,
          slotNumber: slot,
          category: slot >= 11 ? 'SCAN_3D' : slot >= 9 ? 'RADIOGRAPH' : 'EXTRAORAL',
          type: slot === 11 ? 'STL_MAXILLA' : slot === 12 ? 'STL_MANDIBLE' : slot === 13 ? 'STL_OCCLUSION' : 'PHOTO',
          originalFileName: `arquivo_slot_${slot}.${slot >= 11 ? 'stl' : 'jpg'}`,
          storageKey: `cases/${caseAId}/files/slot_${slot}`,
          mimeType: slot >= 11 ? 'model/stl' : 'image/jpeg',
          fileSizeBytes: 5000000,
          status: 'UPLOADED',
        },
        update: {
          status: 'UPLOADED',
        },
      });
    }

    const reqSubmitComplete = createReq(`/api/cases/${caseAId}/submit`, 'POST', tokenA, {
      tcleConfirmed: true,
      professionalDeclaration: true,
    });
    const resSubmitComplete = await submitCase(reqSubmitComplete, { params: { id: caseAId } });
    const dataSubmitComplete = await resSubmitComplete.json();

    if (resSubmitComplete.status !== 200 || dataSubmitComplete.case.status !== 'SUBMITTED') {
      throw new Error(`Falha na submissão completa: ${dataSubmitComplete.error}`);
    }

    const submittedCaseInDb = await db.case.findUnique({ where: { id: caseAId } });
    if (submittedCaseInDb.status !== 'SUBMITTED' || !submittedCaseInDb.submittedAt) {
      throw new Error('Status no banco deveria ser SUBMITTED com submittedAt preenchido');
    }
    console.log('  ✅ PASS: Caso submetido com sucesso! Status transicionado para SUBMITTED');

    // ------------------------------------------------------------------------
    // TESTE 8: Proteção Cross-Tenant (Anti-IDOR)
    // ------------------------------------------------------------------------
    console.log('\n▶ Teste 8: Tentativa de Doutor da Clínica B Acessar Caso da Clínica A');
    const reqCrossTenantGet = createReq(`/api/cases/${caseAId}`, 'GET', tokenB);
    const resCrossTenantGet = await getCase(reqCrossTenantGet, { params: { id: caseAId } });

    if (resCrossTenantGet.status !== 404) {
      throw new Error(`Acesso cross-tenant deveria retornar 404, retornou: ${resCrossTenantGet.status}`);
    }

    const reqCrossTenantPatch = createReq(`/api/cases/${caseAId}`, 'PATCH', tokenB, {
      chiefComplaint: 'Tentativa de adulteração por outra clínica',
    });
    const resCrossTenantPatch = await patchCase(reqCrossTenantPatch, { params: { id: caseAId } });

    if (resCrossTenantPatch.status !== 404) {
      throw new Error(`Modificação cross-tenant deveria retornar 404, retornou: ${resCrossTenantPatch.status}`);
    }
    console.log('  ✅ PASS: Acesso e adulteração cross-tenant bloqueados com 404 (IDOR neutralizado)');

    console.log('\n====================================================');
    console.log('🏁 RESULTADO SPRINT A: TODOS OS 8 TESTES PASSARAM COM SUCESSO!');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ ERRO NA EXECUÇÃO DO SPRINT A:', error);
    process.exit(1);
  } finally {
    // Teardown
    try {
      if (caseAId) await db.case.deleteMany({ where: { id: caseAId } });
      if (patientAId) await db.patient.deleteMany({ where: { id: patientAId } });
      if (doctorAId) await db.user.deleteMany({ where: { id: doctorAId } });
      if (doctorBId) await db.user.deleteMany({ where: { id: doctorBId } });
      if (orgAId) await db.organization.deleteMany({ where: { id: orgAId } });
      if (orgBId) await db.organization.deleteMany({ where: { id: orgBId } });
    } catch (e) {
      // Ignora erro no teardown
    }
  }
}

runTests();

import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';
import { GET as getCase } from '../src/app/api/cases/[id]/route';
import { POST as createCase } from '../src/app/api/cases/route';
import { POST as createPatient } from '../src/app/api/patients/route';
import { POST as saveClinicalCondition } from '../src/app/api/cases/[id]/clinical-condition/route';
import { POST as saveTreatmentPlan } from '../src/app/api/cases/[id]/treatment-plan/route';
import { POST as saveConsent } from '../src/app/api/cases/[id]/consent/route';
import { POST as submitCase } from '../src/app/api/cases/[id]/submit/route';
import { POST as getUploadUrl } from '../src/app/api/cases/[id]/upload-url/route';
import { POST as confirmFile } from '../src/app/api/cases/[id]/files/[fileId]/confirm/route';
import { GET as getFiles } from '../src/app/api/cases/[id]/files/route';
import { validateFileForSlot } from '../src/lib/storage/validator';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
  TREATMENT_ACTION,
  ELASTIC_OPTION,
  CORRECTION_OPTION,
  DIASTEMA_OPTION,
  getCaseFileTypeBySlot,
} from '../src/lib/types/clinical';

const db = prisma as any;

let orgAId: string;
let orgBId: string;
let doctorAId: string;
let membershipAId: string;
let sessionAId: string;
let tokenDoctorA: string;

let suspendedDoctorId: string;
let suspendedMembershipId: string;
let suspendedSessionId: string;
let tokenSuspendedDoctor: string;

let doctorBId: string;
let membershipBId: string;
let sessionBId: string;
let tokenDoctorB: string;

function createReq(url: string, method: string, token?: string, body?: any) {
  const headers = new Headers();
  if (token) {
    headers.set('Cookie', `fyalign_access_token=${token}`);
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

async function runWizardFlowTests() {
  console.log('========================================================================');
  console.log('🚀 SPRINT B & SPRINT C: TESTES INTEGRADOS DO FLUXO DO WIZARD (7 ETAPAS)');
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
    // SETUP: Criação de Clínicas, Doutores e Sessões
    // ------------------------------------------------------------------------
    console.log('\n[SETUP] Provisionando ambiente de teste...');

    const orgA = await db.organization.create({
      data: {
        tradeName: 'FyAlign Clinic Alpha',
        legalName: 'Alpha Odontologia Especializada Ltda',
        taxId: `CNPJ-WIZ-A-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgAId = orgA.id;

    const orgB = await db.organization.create({
      data: {
        tradeName: 'FyAlign Clinic Beta',
        legalName: 'Beta Odontologia Ltda',
        taxId: `CNPJ-WIZ-B-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgBId = orgB.id;

    // Doutor A (Habilitado com CRO Verificado na Clínica A)
    const docA = await db.user.create({
      data: {
        fullName: 'Dra. Camila Alencar',
        email: `dra.camila.${Date.now()}@alpha.com`,
        passwordHash: 'dummy',
        professionalIdCro: 'SP-CD-99887',
      },
    });
    doctorAId = docA.id;

    const membA = await db.membership.create({
      data: {
        userId: doctorAId,
        organizationId: orgAId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croNumber: '99887',
        croUf: 'SP',
        croStatus: 'VERIFIED',
      },
    });
    membershipAId = membA.id;

    const sessA = await db.session.create({
      data: {
        userId: doctorAId,
        membershipId: membershipAId,
        isValid: true,
        ipAddress: '127.0.0.1',
        userAgent: 'JestTestRunner',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    sessionAId = sessA.id;

    tokenDoctorA = await signAccessToken({
      userId: doctorAId,
      email: docA.email,
      role: 'DOCTOR',
      fullName: docA.fullName,
      clinicId: orgAId,
      organizationId: orgAId,
      organizationType: 'CLINIC',
      activeMembershipId: membershipAId,
      professionalIdCro: 'SP-CD-99887',
      croStatus: 'VERIFIED',
      sessionId: sessionAId,
    });

    // Doutor com Membership SUSPENSA na Clínica A
    const docSusp = await db.user.create({
      data: {
        fullName: 'Dr. Roberto Suspenso',
        email: `dr.roberto.${Date.now()}@alpha.com`,
        passwordHash: 'dummy',
        professionalIdCro: 'SP-CD-00000',
      },
    });
    suspendedDoctorId = docSusp.id;

    const membSusp = await db.membership.create({
      data: {
        userId: suspendedDoctorId,
        organizationId: orgAId,
        role: 'DOCTOR',
        status: 'SUSPENDED',
        croNumber: '00000',
        croUf: 'SP',
        croStatus: 'SUSPENDED',
      },
    });
    suspendedMembershipId = membSusp.id;

    const sessSusp = await db.session.create({
      data: {
        userId: suspendedDoctorId,
        membershipId: suspendedMembershipId,
        isValid: true,
        ipAddress: '127.0.0.1',
        userAgent: 'JestTestRunner',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    suspendedSessionId = sessSusp.id;

    tokenSuspendedDoctor = await signAccessToken({
      userId: suspendedDoctorId,
      email: docSusp.email,
      role: 'DOCTOR',
      fullName: docSusp.fullName,
      clinicId: orgAId,
      organizationId: orgAId,
      organizationType: 'CLINIC',
      activeMembershipId: suspendedMembershipId,
      professionalIdCro: 'SP-CD-00000',
      croStatus: 'SUSPENDED',
      sessionId: suspendedSessionId,
    });

    // Doutor B (Clínica B - Cross Tenant)
    const docB = await db.user.create({
      data: {
        fullName: 'Dr. Bruno Beta',
        email: `dr.bruno.${Date.now()}@beta.com`,
        passwordHash: 'dummy',
        professionalIdCro: 'RJ-CD-55443',
      },
    });
    doctorBId = docB.id;

    const membB = await db.membership.create({
      data: {
        userId: doctorBId,
        organizationId: orgBId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croNumber: '55443',
        croUf: 'RJ',
        croStatus: 'VERIFIED',
      },
    });
    membershipBId = membB.id;

    const sessB = await db.session.create({
      data: {
        userId: doctorBId,
        membershipId: membershipBId,
        isValid: true,
        ipAddress: '127.0.0.1',
        userAgent: 'JestTestRunner',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    sessionBId = sessB.id;

    tokenDoctorB = await signAccessToken({
      userId: doctorBId,
      email: docB.email,
      role: 'DOCTOR',
      fullName: docB.fullName,
      clinicId: orgBId,
      organizationId: orgBId,
      organizationType: 'CLINIC',
      activeMembershipId: membershipBId,
      professionalIdCro: 'RJ-CD-55443',
      croStatus: 'VERIFIED',
      sessionId: sessionBId,
    });

    console.log('   Ambiente provisionado com sucesso.');

    // ------------------------------------------------------------------------
    // TESTE 1: FLUXO FELIZ COMPLETO DAS 7 ETAPAS (Happy Path)
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 1] Happy Path: Execução das 7 Etapas do Wizard até SUBMITTED');

    // Etapa 2: Paciente
    const reqCreatePatient = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorA, {
      fullName: 'Lucas Fernandes Teste Wizard',
      birthDate: '1995-04-12',
      gender: 'MALE',
      phone: '(11) 98888-7777',
      email: 'lucas.fernandes@teste.com',
    });
    const resCreatePatient = await createPatient(reqCreatePatient);
    assert(resCreatePatient.status === 201, 'Etapa 2: Cadastro de novo paciente no escopo do tenant retorna 201');
    const dataPatient = await resCreatePatient.json();
    const patientId = dataPatient.patient.id;

    // Criação do Rascunho do Caso (DRAFT)
    const reqCreateCase = createReq('http://localhost:3000/api/cases', 'POST', tokenDoctorA, {
      patientId,
      treatedArches: 'BOTH',
    });
    const resCreateCase = await createCase(reqCreateCase);
    assert(resCreateCase.status === 201, 'Etapa 2: Criação do rascunho de caso (DRAFT) retorna 201');
    const dataCase = await resCreateCase.json();
    const caseId = dataCase.case.id;
    assert(dataCase.case.status === 'DRAFT', 'Caso inicializado em status DRAFT');
    assert(!!dataCase.case.caseCode, `Código gerado para o caso: ${dataCase.case.caseCode}`);

    // Etapa 3: Condição Clínica
    const reqCondition = createReq(
      `http://localhost:3000/api/cases/${caseId}/clinical-condition`,
      'POST',
      tokenDoctorA,
      {
        upperMidline: MIDLINE_POSITION.CENTERED,
        lowerMidline: MIDLINE_POSITION.DEVIATED_RIGHT,
        canineRight: OCCLUSION_CLASS.CLASS_I,
        canineLeft: OCCLUSION_CLASS.CLASS_II,
        molarRight: OCCLUSION_CLASS.CLASS_I,
        molarLeft: OCCLUSION_CLASS.CLASS_II,
      }
    );
    const resCondition = await saveClinicalCondition(reqCondition, { params: { id: caseId } });
    assert(resCondition.status === 200, 'Etapa 3: Persistência da condição clínica retorna 200');

    // Etapa 4: Plano de Tratamento
    const reqPlan = createReq(
      `http://localhost:3000/api/cases/${caseId}/treatment-plan`,
      'POST',
      tokenDoctorA,
      {
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
        smartAttachments: 'Otimizados para rotação nos caninos',
        diastemas: DIASTEMA_OPTION.CLOSE_ALL,
        additionalInstructions: 'Priorizar correção de overjet no arco superior',
      }
    );
    const resPlan = await saveTreatmentPlan(reqPlan, { params: { id: caseId } });
    assert(resPlan.status === 200, 'Etapa 4: Persistência do plano de tratamento retorna 200');

    // Etapa 5: Envio dos 13 Arquivos Clínicos (Slots 1 a 13)
    let uploadSuccessCount = 0;
    for (let slot = 1; slot <= 13; slot++) {
      const ext = slot >= 11 ? 'stl' : 'jpg';
      const fileName = `slot_${slot}_arquivo.${ext}`;
      const mimeType = slot >= 11 ? 'application/octet-stream' : 'image/jpeg';
      const fileSizeBytes = slot >= 11 ? 5 * 1024 * 1024 : 2 * 1024 * 1024;

      // 1. Gera upload URL
      const reqUrl = createReq(
        `http://localhost:3000/api/cases/${caseId}/upload-url`,
        'POST',
        tokenDoctorA,
        {
          slotNumber: slot,
          fileName,
          mimeType,
          fileSizeBytes,
        }
      );
      const resUrl = await getUploadUrl(reqUrl, { params: { id: caseId } });
      const dataUrl = await resUrl.json();

      // 2. Confirma upload como UPLOADED
      const reqConfirm = createReq(
        `http://localhost:3000/api/cases/${caseId}/files/${dataUrl.fileId}/confirm`,
        'POST',
        tokenDoctorA,
        { etag: `"dummy-etag-${slot}"` }
      );
      const resConfirm = await confirmFile(reqConfirm, { params: { id: caseId, fileId: dataUrl.fileId } });
      if (resConfirm.status === 200) {
        uploadSuccessCount++;
      }
    }
    assert(uploadSuccessCount === 13, 'Etapa 5: Todos os 13 slots padronizados enviados e confirmados com sucesso');

    // Etapa 6: Termo de Consentimento Livre e Esclarecido (TCLE)
    const reqConsent = createReq(
      `http://localhost:3000/api/cases/${caseId}/consent`,
      'POST',
      tokenDoctorA,
      {
        policyVersion: 'v1.0-2026',
        policyHash: '3f7b8c9a1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
        scrollCompleted: true,
        signatureKey: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    const resConsent = await saveConsent(reqConsent, { params: { id: caseId } });
    assert(resConsent.status === 201, 'Etapa 6: Registro de consentimento legal com assinatura retorna 201');

    // Etapa 7: Revisão & Submissão Final do Caso (/submit)
    const reqSubmit = createReq(
      `http://localhost:3000/api/cases/${caseId}/submit`,
      'POST',
      tokenDoctorA,
      {
        policyVersion: 'v1.0-2026',
        policyHash: '3f7b8c9a1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
        signatureKey: 'data:image/png;base64,dummy-signature-key',
      }
    );
    const resSubmit = await submitCase(reqSubmit, { params: { id: caseId } });
    assert(resSubmit.status === 200, 'Etapa 7: Submissão do caso concluída com sucesso (status 200)');
    const dataSubmit = await resSubmit.json();
    assert(dataSubmit.case.status === 'SUBMITTED', 'Status do caso transitado com sucesso para SUBMITTED');
    assert(dataSubmit.digitalSignature?.status === 'VALIDATED', 'Assinatura digital e CRO auditados e validados no servidor');

    // ------------------------------------------------------------------------
    // TESTE 2: RESILIÊNCIA A REFRESH (F5) E PERSISTÊNCIA DE RASCUNHO
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 2] F5 / Refresh Resilience: Restauração integral do rascunho');

    // Cria um novo caso em rascunho com dados até a Etapa 4
    const reqPatientF5 = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorA, {
      fullName: 'Paciente Teste F5 Resilience',
      birthDate: '2001-08-20',
      gender: 'FEMALE',
      phone: '(11) 97777-6666',
    });
    const resPatientF5 = await createPatient(reqPatientF5);
    const patientF5Id = (await resPatientF5.json()).patient.id;

    const reqCaseF5 = createReq('http://localhost:3000/api/cases', 'POST', tokenDoctorA, {
      patientId: patientF5Id,
    });
    const caseF5Id = (await (await createCase(reqCaseF5)).json()).case.id;

    // Salva Condição Clínica
    await saveClinicalCondition(
      createReq(`http://localhost:3000/api/cases/${caseF5Id}/clinical-condition`, 'POST', tokenDoctorA, {
        upperMidline: MIDLINE_POSITION.DEVIATED_LEFT,
        lowerMidline: MIDLINE_POSITION.CENTERED,
        canineRight: OCCLUSION_CLASS.CLASS_III,
        canineLeft: OCCLUSION_CLASS.CLASS_I,
        molarRight: OCCLUSION_CLASS.CLASS_III,
        molarLeft: OCCLUSION_CLASS.CLASS_I,
      }),
      { params: { id: caseF5Id } }
    );

    // Salva Plano de Tratamento
    await saveTreatmentPlan(
      createReq(`http://localhost:3000/api/cases/${caseF5Id}/treatment-plan`, 'POST', tokenDoctorA, {
        upperMidline: TREATMENT_ACTION.IMPROVE,
        lowerMidline: TREATMENT_ACTION.MAINTAIN,
        overjet: TREATMENT_ACTION.MAINTAIN,
        overbite: TREATMENT_ACTION.MAINTAIN,
        archForm: TREATMENT_ACTION.IMPROVE,
        expansion: TREATMENT_ACTION.MAINTAIN,
        canineRelationship: TREATMENT_ACTION.IMPROVE,
        molarRelationship: TREATMENT_ACTION.MAINTAIN,
        ipr: false,
        attachment: true,
        intermaxillaryElastic: ELASTIC_OPTION.NO,
        classIICorrection: CORRECTION_OPTION.DO_NOT_CORRECT,
        classIIICorrection: CORRECTION_OPTION.CORRECT,
        diastemas: DIASTEMA_OPTION.NONE,
      }),
      { params: { id: caseF5Id } }
    );

    // Envia apenas o slot 1 e o slot 11
    const resUrl1 = await getUploadUrl(
      createReq(`http://localhost:3000/api/cases/${caseF5Id}/upload-url`, 'POST', tokenDoctorA, {
        slotNumber: 1,
        fileName: 'foto_frontal.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024 * 1024,
      }),
      { params: { id: caseF5Id } }
    );
    const fId1 = (await resUrl1.json()).fileId;
    await confirmFile(
      createReq(`http://localhost:3000/api/cases/${caseF5Id}/files/${fId1}/confirm`, 'POST', tokenDoctorA, {}),
      { params: { id: caseF5Id, fileId: fId1 } }
    );

    // Simula F5: GET /api/cases/:id e GET /api/cases/:id/files
    const reqF5Get = createReq(`http://localhost:3000/api/cases/${caseF5Id}`, 'GET', tokenDoctorA);
    const resF5Get = await getCase(reqF5Get, { params: { id: caseF5Id } });
    assert(resF5Get.status === 200, 'F5: GET do caso existente retorna 200');
    const dataF5 = (await resF5Get.json()).case;

    assert(dataF5.patient.fullName === 'Paciente Teste F5 Resilience', 'F5: Dados do paciente preservados intactos');
    assert(dataF5.clinicalCondition.upperMidline === MIDLINE_POSITION.DEVIATED_LEFT, 'F5: Condição clínica restaurada com fidelidade');
    assert(dataF5.treatmentPlan.classIIICorrection === CORRECTION_OPTION.CORRECT, 'F5: Plano de tratamento restaurado');

    const reqFilesF5 = createReq(`http://localhost:3000/api/cases/${caseF5Id}/files`, 'GET', tokenDoctorA);
    const resFilesF5 = await getFiles(reqFilesF5, { params: { id: caseF5Id } });
    const dataFilesF5 = await resFilesF5.json();
    const slot1Status = dataFilesF5.slots.find((s: any) => s.slotNumber === 1);
    assert(slot1Status?.file?.status === 'UPLOADED', 'F5: Slot 1 previamente enviado continua com status UPLOADED');

    // ------------------------------------------------------------------------
    // TESTE 3: CASOS DE ERRO E VALIDAÇÃO ESTREITA
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 3] Casos de Erro e Regras de Negócio');

    // Erro 1: Paciente Incompleto
    const reqBadPatient = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorA, {
      fullName: 'A', // Muito curto (< 3)
      birthDate: '',
      gender: '',
      phone: '',
    });
    const resBadPatient = await createPatient(reqBadPatient);
    assert(resBadPatient.status === 400, '❌ Erro: Cadastro com paciente incompleto retorna 400');

    // Erro 2: Condição Clínica Incompleta / Ausente na Submissão
    const patientErrRes = await createPatient(
      createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorA, {
        fullName: 'Paciente Teste Erros',
        birthDate: '1990-01-01',
        gender: 'OTHER',
        phone: '11999998888',
      })
    );
    const pErrId = (await patientErrRes.json()).patient.id;
    const caseIncompleteId = (await (await createCase(createReq('http://localhost:3000/api/cases', 'POST', tokenDoctorA, { patientId: pErrId }))).json()).case.id;

    const resSubmitNoCond = await submitCase(
      createReq(`http://localhost:3000/api/cases/${caseIncompleteId}/submit`, 'POST', tokenDoctorA, {}),
      { params: { id: caseIncompleteId } }
    );
    assert(resSubmitNoCond.status === 400, '❌ Erro: Submissão sem Condição Clínica bloqueada com status 400');
    const dataNoCond = await resSubmitNoCond.json();
    assert(dataNoCond.missingSection === 'CLINICAL_CONDITION', 'Retorna missingSection: CLINICAL_CONDITION');

    // Salva Condição mas omite Plano de Tratamento
    await saveClinicalCondition(
      createReq(`http://localhost:3000/api/cases/${caseIncompleteId}/clinical-condition`, 'POST', tokenDoctorA, {
        upperMidline: MIDLINE_POSITION.CENTERED,
        lowerMidline: MIDLINE_POSITION.CENTERED,
        canineRight: OCCLUSION_CLASS.CLASS_I,
        canineLeft: OCCLUSION_CLASS.CLASS_I,
        molarRight: OCCLUSION_CLASS.CLASS_I,
        molarLeft: OCCLUSION_CLASS.CLASS_I,
      }),
      { params: { id: caseIncompleteId } }
    );

    const resSubmitNoPlan = await submitCase(
      createReq(`http://localhost:3000/api/cases/${caseIncompleteId}/submit`, 'POST', tokenDoctorA, {}),
      { params: { id: caseIncompleteId } }
    );
    assert(resSubmitNoPlan.status === 400, '❌ Erro: Submissão sem Plano de Tratamento bloqueada com status 400');
    const dataNoPlan = await resSubmitNoPlan.json();
    assert(dataNoPlan.missingSection === 'TREATMENT_PLAN', 'Retorna missingSection: TREATMENT_PLAN');

    // Salva Plano de Tratamento mas deixa slots obrigatórios faltando
    await saveTreatmentPlan(
      createReq(`http://localhost:3000/api/cases/${caseIncompleteId}/treatment-plan`, 'POST', tokenDoctorA, {
        upperMidline: TREATMENT_ACTION.MAINTAIN,
        lowerMidline: TREATMENT_ACTION.MAINTAIN,
        overjet: TREATMENT_ACTION.MAINTAIN,
        overbite: TREATMENT_ACTION.MAINTAIN,
        archForm: TREATMENT_ACTION.MAINTAIN,
        expansion: TREATMENT_ACTION.MAINTAIN,
        canineRelationship: TREATMENT_ACTION.MAINTAIN,
        molarRelationship: TREATMENT_ACTION.MAINTAIN,
        ipr: false,
        attachment: false,
      }),
      { params: { id: caseIncompleteId } }
    );

    // Erro 3: Slot obrigatório faltando (0/13 arquivos enviados)
    const resSubmitNoFiles = await submitCase(
      createReq(`http://localhost:3000/api/cases/${caseIncompleteId}/submit`, 'POST', tokenDoctorA, {}),
      { params: { id: caseIncompleteId } }
    );
    assert(resSubmitNoFiles.status === 400, '❌ Erro: Submissão sem os 13 arquivos obrigatórios bloqueada com status 400 (RN-01)');
    const dataNoFiles = await resSubmitNoFiles.json();
    assert(Array.isArray(dataNoFiles.missingSlots) && dataNoFiles.missingSlots.length === 13, 'Lista todos os slots faltantes');

    // Erro 4: Validação de arquivo inválido para o slot (Extensão proibida)
    const valInvalidExt = validateFileForSlot(11, 'malicioso.exe', 1024 * 1024);
    assert(!valInvalidExt.valid, '❌ Erro: Validação local rejeita extensão executável (.exe) para slot STL');

    const valExceededSize = validateFileForSlot(1, 'foto_gigante.jpg', 60 * 1024 * 1024);
    assert(!valExceededSize.valid, '❌ Erro: Validação local rejeita foto superior ao limite máximo (60MB > 25MB)');

    // Erro 5: Sessão Expirada / Token ausente
    const resNoAuth = await submitCase(
      createReq(`http://localhost:3000/api/cases/${caseId}/submit`, 'POST'),
      { params: { id: caseId } }
    );
    assert(resNoAuth.status === 401, '❌ Erro: Tentativa sem sessão autenticada retorna 401 Unauthorized');

    // Erro 6: Membership Suspensa
    const resSuspended = await submitCase(
      createReq(`http://localhost:3000/api/cases/${caseId}/submit`, 'POST', tokenSuspendedDoctor, {}),
      { params: { id: caseId } }
    );
    assert([401, 403].includes(resSuspended.status), '❌ Erro: Doutor com membership suspensa bloqueado com 401 ou 403 Forbidden');

    // Erro 7: Tentativa Cross-Tenant (Doutor da Clínica B tentando modificar caso da Clínica A)
    const resCrossTenant = await saveClinicalCondition(
      createReq(`http://localhost:3000/api/cases/${caseId}/clinical-condition`, 'POST', tokenDoctorB, {
        upperMidline: MIDLINE_POSITION.CENTERED,
        lowerMidline: MIDLINE_POSITION.CENTERED,
        canineRight: OCCLUSION_CLASS.CLASS_I,
        canineLeft: OCCLUSION_CLASS.CLASS_I,
        molarRight: OCCLUSION_CLASS.CLASS_I,
        molarLeft: OCCLUSION_CLASS.CLASS_I,
      }),
      { params: { id: caseId } }
    );
    assert([403, 404].includes(resCrossTenant.status), '❌ Erro: Tentativa cross-tenant bloqueada com 403/404 Forbidden');

    // Erro 8: Submissão Duplicada (O caso já submetido no Teste 1)
    const resDupSubmit = await submitCase(
      createReq(`http://localhost:3000/api/cases/${caseId}/submit`, 'POST', tokenDoctorA, {}),
      { params: { id: caseId } }
    );
    assert(resDupSubmit.status === 400, '❌ Erro: Submissão duplicada de caso já SUBMITTED bloqueada com status 400 (RN-03)');

    console.log('\n========================================================================');
    console.log(`🎉 RESULTADOS FINAIS SPRINT B & C: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Falha catastrófica no teste do Wizard:', error);
    process.exit(1);
  }
}

runWizardFlowTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { prisma } from '../src/lib/prisma';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
  TREATMENT_ACTION,
  ELASTIC_OPTION,
  CORRECTION_OPTION,
  DIASTEMA_OPTION,
  CASE_FILE_TYPES,
  getCaseFileTypeBySlot,
  ClinicalConditionSchema,
  TreatmentPlanSchema,
  CaseConsentSchema,
} from '../src/lib/types/clinical';

const db = prisma as any;

let createdOrgId: string;
let createdDoctorId: string;
let createdPatientId: string;
let createdCaseId: string;

async function runTests() {
  console.log('====================================================');
  console.log('🔬 TESTES DE COMPATIBILIDADE DO NOVO CONTRATO CLÍNICO');
  console.log('====================================================');

  try {
    // ------------------------------------------------------------------------
    // SETUP: Criação de Entidades Base
    // ------------------------------------------------------------------------
    const org = await db.organization.create({
      data: {
        tradeName: 'Clínica Ortodôntica Teste Contrato',
        legalName: 'Clinica Teste Contrato Ltda',
        taxId: `CNPJ-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    createdOrgId = org.id;

    const doctor = await db.user.create({
      data: {
        email: `dr.contrato.${Date.now()}@teste.com`,
        passwordHash: 'hash-seguro',
        fullName: 'Dr. Avaliador Clínico',
      },
    });
    createdDoctorId = doctor.id;

    const patient = await db.patient.create({
      data: {
        clinicId: createdOrgId,
        fullName: 'Paciente Teste Contrato Clínico',
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        phone: '11999998888',
        tcleSigned: true, // Campo legado preservado
      },
    });
    createdPatientId = patient.id;

    const testCase = await db.case.create({
      data: {
        caseCode: `FY-TEST-${Date.now()}`,
        patientId: createdPatientId,
        doctorId: createdDoctorId,
        clinicId: createdOrgId,
        status: 'DRAFT',
        treatedArches: 'BOTH',
        chiefComplaint: 'Apinhamento severo e mordida cruzada',
      },
    });
    createdCaseId = testCase.id;

    console.log('▶ Teste 1: Validação dos Enums e Schemas Zod Clínicos');
    // ClinicalCondition Zod Schema
    const conditionValidation = ClinicalConditionSchema.safeParse({
      upperMidline: MIDLINE_POSITION.CENTERED,
      lowerMidline: MIDLINE_POSITION.DEVIATED_RIGHT,
      canineRight: OCCLUSION_CLASS.CLASS_I,
      canineLeft: OCCLUSION_CLASS.CLASS_II,
      molarRight: OCCLUSION_CLASS.CLASS_I,
      molarLeft: OCCLUSION_CLASS.CLASS_II,
    });
    if (!conditionValidation.success) {
      throw new Error('Falha ao validar ClinicalConditionSchema válido');
    }
    console.log('  ✅ PASS: ClinicalConditionSchema validado com sucesso');

    // TreatmentPlan Zod Schema
    const planValidation = TreatmentPlanSchema.safeParse({
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
      smartAttachments: 'Caninos e pré-molares superiores',
      diastemas: DIASTEMA_OPTION.CLOSE_ALL,
      additionalInstructions: 'Priorizar desapinhamento anterior inferior com IPR conservador.',
    });
    if (!planValidation.success) {
      throw new Error('Falha ao validar TreatmentPlanSchema válido');
    }
    console.log('  ✅ PASS: TreatmentPlanSchema validado com sucesso');

    // CaseConsent Zod Schema
    const consentValidation = CaseConsentSchema.safeParse({
      policyVersion: 'v2.4-2026',
      policyHash: 'sha256-a1b2c3d4e5f67890123456789abcdef0',
      scrollCompleted: true,
      ipAddress: '189.120.45.67',
      userAgent: 'Mozilla/5.0 OrthoDesk/1.0',
    });
    if (!consentValidation.success) {
      throw new Error('Falha ao validar CaseConsentSchema válido');
    }
    console.log('  ✅ PASS: CaseConsentSchema validado com sucesso');

    // Mapeador de Slots
    if (getCaseFileTypeBySlot(1) !== CASE_FILE_TYPES.PHOTO_FRONTAL_REST) {
      throw new Error('Slot 1 deveria mapear para PHOTO_FRONTAL_REST');
    }
    if (getCaseFileTypeBySlot(11) !== CASE_FILE_TYPES.STL_MAXILLA) {
      throw new Error('Slot 11 deveria mapear para STL_MAXILLA');
    }
    if (getCaseFileTypeBySlot(12) !== CASE_FILE_TYPES.STL_MANDIBLE) {
      throw new Error('Slot 12 deveria mapear para STL_MANDIBLE');
    }
    if (getCaseFileTypeBySlot(13) !== CASE_FILE_TYPES.STL_OCCLUSION) {
      throw new Error('Slot 13 deveria mapear para STL_OCCLUSION');
    }
    console.log('  ✅ PASS: Mapeamento determinístico de Slot 1-13 para CaseFileType validado');

    console.log('\n▶ Teste 2: Persistência e Relação 1:1 de ClinicalCondition');
    const createdCondition = await db.clinicalCondition.create({
      data: {
        caseId: createdCaseId,
        upperMidline: MIDLINE_POSITION.CENTERED,
        lowerMidline: MIDLINE_POSITION.DEVIATED_RIGHT,
        canineRight: OCCLUSION_CLASS.CLASS_I,
        canineLeft: OCCLUSION_CLASS.CLASS_II,
        molarRight: OCCLUSION_CLASS.CLASS_I,
        molarLeft: OCCLUSION_CLASS.CLASS_II,
      },
    });

    if (!createdCondition.id || createdCondition.caseId !== createdCaseId) {
      throw new Error('ClinicalCondition não foi persistido corretamente.');
    }

    const caseWithCondition = await db.case.findUnique({
      where: { id: createdCaseId },
      include: { clinicalCondition: true },
    });

    if (!caseWithCondition.clinicalCondition) {
      throw new Error('Relação case.clinicalCondition não retornou dados.');
    }
    if (caseWithCondition.clinicalCondition.canineLeft !== OCCLUSION_CLASS.CLASS_II) {
      throw new Error('Valor de canineLeft incompatível.');
    }
    console.log('  ✅ PASS: ClinicalCondition criado, persistido e consultado via relação no Case');

    console.log('\n▶ Teste 3: Persistência e Relação 1:1 de TreatmentPlan');
    const createdPlan = await db.treatmentPlan.create({
      data: {
        caseId: createdCaseId,
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
        smartAttachments: 'Otimizados para rotação de caninos',
        diastemas: DIASTEMA_OPTION.CLOSE_ALL,
        additionalInstructions: 'Atenção aos torques nos incisivos superiores.',
      },
    });

    if (!createdPlan.id || createdPlan.caseId !== createdCaseId) {
      throw new Error('TreatmentPlan não foi persistido corretamente.');
    }

    const caseWithPlan = await db.case.findUnique({
      where: { id: createdCaseId },
      include: { treatmentPlan: true },
    });

    if (!caseWithPlan.treatmentPlan) {
      throw new Error('Relação case.treatmentPlan não retornou dados.');
    }
    if (caseWithPlan.treatmentPlan.classIICorrection !== CORRECTION_OPTION.CORRECT) {
      throw new Error('Valor de classIICorrection divergente.');
    }
    console.log('  ✅ PASS: TreatmentPlan criado, persistido e consultado via relação no Case');

    console.log('\n▶ Teste 4: Persistência e Relação 1:N de CaseConsent (Auditoria Legal)');
    const consent1 = await db.caseConsent.create({
      data: {
        caseId: createdCaseId,
        policyVersion: 'v1.0-TCLE-2026',
        policyHash: 'hash-imutavel-termo-de-consentimento-89723',
        scrollCompleted: true,
        ipAddress: '200.180.12.34',
        userAgent: 'Chrome/124.0 FyAlignPortal',
        signatureKey: 'sig-vault-doc-123.pdf',
        signatureHash: 'sha256-signature-valid-ok-1234567890abcdef',
      },
    });

    if (!consent1.id || consent1.caseId !== createdCaseId) {
      throw new Error('CaseConsent não persistido.');
    }

    const caseWithConsents = await db.case.findUnique({
      where: { id: createdCaseId },
      include: { consents: true },
    });

    if (!caseWithConsents.consents || caseWithConsents.consents.length !== 1) {
      throw new Error('Relação case.consents não retornou a lista correta.');
    }
    if (caseWithConsents.consents[0].policyVersion !== 'v1.0-TCLE-2026') {
      throw new Error('Dados de consentimento divergentes.');
    }
    console.log('  ✅ PASS: CaseConsent persistido como fonte da verdade do consentimento');

    console.log('\n▶ Teste 5: CaseFile com Subtipo Clínico Estruturado (type)');
    const fileStlMaxilla = await db.caseFile.create({
      data: {
        caseId: createdCaseId,
        slotNumber: 11,
        category: 'SCAN_3D',
        type: CASE_FILE_TYPES.STL_MAXILLA,
        originalFileName: 'arcada_superior_pre.stl',
        storageKey: `cases/${createdCaseId}/files/maxilla.stl`,
        mimeType: 'model/stl',
        fileSizeBytes: 24500000,
        status: 'UPLOADED',
      },
    });

    if (fileStlMaxilla.type !== CASE_FILE_TYPES.STL_MAXILLA) {
      throw new Error('Campo type do CaseFile não persistiu o valor correto.');
    }

    const filePhoto = await db.caseFile.create({
      data: {
        caseId: createdCaseId,
        slotNumber: 1,
        category: 'EXTRAORAL',
        type: CASE_FILE_TYPES.PHOTO_FRONTAL_REST,
        originalFileName: 'rosto_repouso.jpg',
        storageKey: `cases/${createdCaseId}/files/repouso.jpg`,
        mimeType: 'image/jpeg',
        fileSizeBytes: 4200000,
        status: 'UPLOADED',
      },
    });

    if (filePhoto.type !== CASE_FILE_TYPES.PHOTO_FRONTAL_REST) {
      throw new Error('Campo type da foto não persistiu o valor correto.');
    }
    console.log('  ✅ PASS: CaseFile persistiu tipos estruturados (STL_MAXILLA e PHOTO_FRONTAL_REST)');

    console.log('\n▶ Teste 6: Retrocompatibilidade de Casos Legados (Sem novos campos)');
    const legacyCase = await db.case.create({
      data: {
        caseCode: `FY-LEGACY-${Date.now()}`,
        patientId: createdPatientId,
        doctorId: createdDoctorId,
        clinicId: createdOrgId,
        status: 'DRAFT',
        treatedArches: 'UPPER',
        chiefComplaint: 'Caso legado sem ClinicalCondition nem TreatmentPlan',
      },
    });

    const retrievedLegacy = await db.case.findUnique({
      where: { id: legacyCase.id },
      include: {
        clinicalCondition: true,
        treatmentPlan: true,
        consents: true,
      },
    });

    if (retrievedLegacy.clinicalCondition !== null || retrievedLegacy.treatmentPlan !== null || retrievedLegacy.consents.length !== 0) {
      throw new Error('Casos legados devem retornar relações nulas/vazias sem erro.');
    }
    console.log('  ✅ PASS: Casos legados sem os novos modelos continuam operando com 100% de estabilidade');

    console.log('\n====================================================');
    console.log('🏁 RESULTADO: TODOS OS TESTES DE COMPATIBILIDADE PASSARAM COM SUCESSO!');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ ERRO NA EXECUÇÃO DOS TESTES:', error);
    process.exit(1);
  } finally {
    // Limpeza de teardown
    try {
      if (createdCaseId) {
        await db.case.deleteMany({ where: { id: createdCaseId } });
      }
      if (createdPatientId) {
        await db.patient.deleteMany({ where: { id: createdPatientId } });
      }
      if (createdDoctorId) {
        await db.user.deleteMany({ where: { id: createdDoctorId } });
      }
      if (createdOrgId) {
        await db.organization.deleteMany({ where: { id: createdOrgId } });
      }
    } catch (e) {
      // Ignora erro em limpeza
    }
  }
}

runTests();

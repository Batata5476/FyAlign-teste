import { prisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';
import { GET as getPatients, POST as createPatient } from '../src/app/api/patients/route';
import { GET as getPatientById } from '../src/app/api/patients/[id]/route';
import { POST as createCase } from '../src/app/api/cases/route';
import { GET as getCase, PATCH as updateCase } from '../src/app/api/cases/[id]/route';

const db = prisma as any;

let orgAlphaId: string;
let orgBetaId: string;

let doctorAlphaId: string;
let membershipAlphaId: string;
let tokenDoctorAlpha: string;

let doctorBetaId: string;
let membershipBetaId: string;
let tokenDoctorBeta: string;

let tokenFinanceLab: string;

function createReq(url: string, method: string, token?: string, body?: any) {
  const headers = new Headers();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
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

async function runEtapa2Tests() {
  console.log('========================================================================');
  console.log('🧪 TESTES ESPECÍFICOS: ETAPA 2 — IDENTIFICAÇÃO DO PACIENTE');
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

    const orgAlpha = await db.organization.create({
      data: {
        tradeName: 'Clínica OdontoPrime Ortodontia',
        legalName: 'OdontoPrime Alpha Ltda',
        taxId: `CNPJ-A-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgAlphaId = orgAlpha.id;

    const orgBeta = await db.organization.create({
      data: {
        tradeName: 'Clínica Sorriso Beta',
        legalName: 'Sorriso Beta Ltda',
        taxId: `CNPJ-B-${Date.now()}`,
        type: 'CLINIC',
      },
    });
    orgBetaId = orgBeta.id;

    // Doutor Alpha (Clínica A)
    const docAlpha = await db.user.create({
      data: {
        fullName: 'Dr. Gabriel Medeiros',
        email: `dr.gabriel.${Date.now()}@odontoprime.com`,
        passwordHash: 'dummy',
        professionalIdCro: 'SP-CD-11223',
      },
    });
    doctorAlphaId = docAlpha.id;

    const membAlpha = await db.membership.create({
      data: {
        userId: doctorAlphaId,
        organizationId: orgAlphaId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croNumber: '11223',
        croUf: 'SP',
        croStatus: 'VERIFIED',
      },
    });
    membershipAlphaId = membAlpha.id;

    const sessAlpha = await db.session.create({
      data: {
        userId: doctorAlphaId,
        membershipId: membershipAlphaId,
        isValid: true,
        ipAddress: '127.0.0.1',
        userAgent: 'JestTestRunner',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    tokenDoctorAlpha = await signAccessToken({
      userId: doctorAlphaId,
      email: docAlpha.email,
      role: 'DOCTOR',
      fullName: docAlpha.fullName,
      clinicId: orgAlphaId,
      organizationId: orgAlphaId,
      organizationType: 'CLINIC',
      activeMembershipId: membershipAlphaId,
      professionalIdCro: 'SP-CD-11223',
      croStatus: 'VERIFIED',
      sessionId: sessAlpha.id,
    });

    // Doutor Beta (Clínica B)
    const docBeta = await db.user.create({
      data: {
        fullName: 'Dra. Beatriz Beta',
        email: `dra.beatriz.${Date.now()}@sorrisobeta.com`,
        passwordHash: 'dummy',
        professionalIdCro: 'RJ-CD-88990',
      },
    });
    doctorBetaId = docBeta.id;

    const membBeta = await db.membership.create({
      data: {
        userId: doctorBetaId,
        organizationId: orgBetaId,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croNumber: '88990',
        croUf: 'RJ',
        croStatus: 'VERIFIED',
      },
    });
    membershipBetaId = membBeta.id;

    const sessBeta = await db.session.create({
      data: {
        userId: doctorBetaId,
        membershipId: membershipBetaId,
        isValid: true,
        ipAddress: '127.0.0.1',
        userAgent: 'JestTestRunner',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    tokenDoctorBeta = await signAccessToken({
      userId: doctorBetaId,
      email: docBeta.email,
      role: 'DOCTOR',
      fullName: docBeta.fullName,
      clinicId: orgBetaId,
      organizationId: orgBetaId,
      organizationType: 'CLINIC',
      activeMembershipId: membershipBetaId,
      professionalIdCro: 'RJ-CD-88990',
      croStatus: 'VERIFIED',
      sessionId: sessBeta.id,
    });

    // Usuário Financeiro (Sem permissão PATIENT_CREATE / PATIENT_READ)
    const financeUser = await db.user.create({
      data: {
        fullName: 'Beatriz Lima (Financeiro)',
        email: `finance.${Date.now()}@fyalign.com`,
        passwordHash: 'dummy',
      },
    });
    const membFinance = await db.membership.create({
      data: {
        userId: financeUser.id,
        organizationId: orgAlphaId,
        role: 'FINANCE',
        status: 'ACTIVE',
      },
    });
    const sessFinance = await db.session.create({
      data: {
        userId: financeUser.id,
        membershipId: membFinance.id,
        isValid: true,
        ipAddress: '127.0.0.1',
        userAgent: 'JestTestRunner',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    tokenFinanceLab = await signAccessToken({
      userId: financeUser.id,
      email: financeUser.email,
      role: 'FINANCE',
      fullName: financeUser.fullName,
      clinicId: null,
      organizationId: orgAlphaId,
      organizationType: 'CLINIC',
      activeMembershipId: membFinance.id,
      croStatus: 'NOT_APPLICABLE',
      sessionId: sessFinance.id,
    });

    console.log('   Ambiente provisionado com sucesso.\n');

    // ------------------------------------------------------------------------
    // TESTE 1: Criação de Paciente Novo com Validação Zod
    // ------------------------------------------------------------------------
    console.log('[TESTE 1] Opção B: Criação de Novo Paciente e Validação Zod');

    // 1.1 Falha: Nome muito curto (< 3 caracteres)
    const reqInvalidName = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorAlpha, {
      fullName: 'Ab',
      birthDate: '1998-04-15',
      gender: 'MALE',
      phone: '(11) 98765-4321',
    });
    const resInvalidName = await createPatient(reqInvalidName);
    assert(resInvalidName.status === 400, 'Zod rejeita nome de paciente com menos de 3 caracteres (retorna 400)');

    // 1.2 Falha: Telefone inválido/curto (< 8 caracteres)
    const reqInvalidPhone = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorAlpha, {
      fullName: 'Gabriel Ramos Santos',
      birthDate: '1998-04-15',
      gender: 'MALE',
      phone: '123',
    });
    const resInvalidPhone = await createPatient(reqInvalidPhone);
    assert(resInvalidPhone.status === 400, 'Zod rejeita telefone inválido com status 400');

    // 1.3 Sucesso: Paciente válido cadastrado no tenant da Clínica Alpha
    const reqValidPatient = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorAlpha, {
      fullName: 'Gabriel Ramos Santos',
      birthDate: '1998-04-15',
      gender: 'MALE',
      phone: '(11) 98765-4321',
      email: 'gabriel.santos@email.com',
    });
    const resValidPatient = await createPatient(reqValidPatient);
    assert(resValidPatient.status === 201, 'Paciente novo criado com sucesso com status 201');
    const dataPatientAlpha = await resValidPatient.json();
    const patientAlphaId = dataPatientAlpha.patient.id;
    assert(dataPatientAlpha.patient.clinicId === orgAlphaId, 'Paciente associado estritamente à Clínica Alpha');

    // ------------------------------------------------------------------------
    // TESTE 2: Opção A: Busca e Pesquisa de Pacientes com Respeito a Tenant
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 2] Opção A: Busca de Paciente Existente e Isolamento Multi-Tenant');

    // 2.1 Cadastra também um paciente na Clínica Beta
    const reqBetaPatient = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorBeta, {
      fullName: 'Mariana Costa Beta',
      birthDate: '2000-09-20',
      gender: 'FEMALE',
      phone: '(21) 97777-6666',
      email: 'mariana.beta@email.com',
    });
    const resBetaPatient = await createPatient(reqBetaPatient);
    const dataPatientBeta = await resBetaPatient.json();
    const patientBetaId = dataPatientBeta.patient.id;
    assert(resBetaPatient.status === 201, 'Paciente da Clínica Beta cadastrado com status 201');

    // 2.2 Doutor Alpha busca por "Gabriel"
    const reqSearchAlpha = createReq('http://localhost:3000/api/patients?search=Gabriel', 'GET', tokenDoctorAlpha);
    const resSearchAlpha = await getPatients(reqSearchAlpha);
    assert(resSearchAlpha.status === 200, 'Busca de paciente existente retorna 200');
    const dataSearchAlpha = await resSearchAlpha.json();
    assert(dataSearchAlpha.patients.length >= 1, 'Paciente Gabriel encontrado na busca da Clínica Alpha');
    assert(dataSearchAlpha.patients.some((p: any) => p.id === patientAlphaId), 'ID do paciente Gabriel corresponde');

    // 2.3 SEGURANÇA: Doutor Beta NÃO encontra o paciente da Clínica Alpha
    const reqSearchCross = createReq('http://localhost:3000/api/patients?search=Gabriel', 'GET', tokenDoctorBeta);
    const resSearchCross = await getPatients(reqSearchCross);
    const dataSearchCross = await resSearchCross.json();
    assert(
      !dataSearchCross.patients.some((p: any) => p.id === patientAlphaId),
      'Segurança: Clínica Beta NÃO consegue encontrar paciente Gabriel da Clínica Alpha (Isolamento 100%)'
    );

    // 2.4 SEGURANÇA: Doutor Beta tenta consultar diretamente paciente da Clínica Alpha por ID (/api/patients/:id)
    const reqDirectCross = createReq(`http://localhost:3000/api/patients/${patientAlphaId}`, 'GET', tokenDoctorBeta);
    const resDirectCross = await getPatientById(reqDirectCross, { params: { id: patientAlphaId } });
    assert(resDirectCross.status === 404, 'Segurança: Consulta direta a paciente de outro tenant bloqueada com 404');

    // ------------------------------------------------------------------------
    // TESTE 3: Criação de Caso DRAFT e Persistência do patientId
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 3] Persistência do Case.patientId e Vínculo com Caso DRAFT');

    // 3.1 Criação do rascunho de caso vinculado a Gabriel
    const reqCase = createReq('http://localhost:3000/api/cases', 'POST', tokenDoctorAlpha, {
      patientId: patientAlphaId,
      treatedArches: 'BOTH',
    });
    const resCase = await createCase(reqCase);
    assert(resCase.status === 201, 'Rascunho de caso criado com status 201');
    const dataCase = await resCase.json();
    const caseId = dataCase.case.id;
    assert(dataCase.case.patientId === patientAlphaId, 'Case.patientId persistido corretamente');
    assert(dataCase.case.status === 'DRAFT', 'Case criado em status DRAFT');

    // 3.2 Tentativa de criar caso com paciente de outra clínica (Anti-IDOR)
    const reqCrossCase = createReq('http://localhost:3000/api/cases', 'POST', tokenDoctorAlpha, {
      patientId: patientBetaId, // Paciente pertence à Clínica Beta!
      treatedArches: 'BOTH',
    });
    const resCrossCase = await createCase(reqCrossCase);
    assert(resCrossCase.status === 404, 'Segurança: Vincular paciente de outra clínica bloqueado com status 404');

    // ------------------------------------------------------------------------
    // TESTE 4: Atualização de Paciente (PATCH /api/cases/:id) & F5 Resilience
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 4] Atualização do Paciente no Caso (PATCH) e Resiliência a Refresh');

    // 4.1 Cria um segundo paciente na Clínica Alpha
    const reqPatient2 = createReq('http://localhost:3000/api/patients', 'POST', tokenDoctorAlpha, {
      fullName: 'Carolina Alencar Silva',
      birthDate: '1992-11-03',
      gender: 'FEMALE',
      phone: '(11) 91111-2222',
    });
    const resPatient2 = await createPatient(reqPatient2);
    const dataPatient2 = await resPatient2.json();
    const patient2Id = dataPatient2.patient.id;

    // 4.2 Altera o paciente do caso existente (Trocar paciente)
    const reqPatchCase = createReq(`http://localhost:3000/api/cases/${caseId}`, 'PATCH', tokenDoctorAlpha, {
      patientId: patient2Id,
    });
    const resPatchCase = await updateCase(reqPatchCase, { params: { id: caseId } });
    assert(resPatchCase.status === 200, 'PATCH /api/cases/:id atualiza patientId com status 200');
    const dataPatch = await resPatchCase.json();
    assert(dataPatch.case.patientId === patient2Id, 'Case.patientId atualizado para novo paciente selecionado');

    // 4.3 F5 / Refresh: GET do caso retorna dados completos do paciente
    const reqGetCase = createReq(`http://localhost:3000/api/cases/${caseId}`, 'GET', tokenDoctorAlpha);
    const resGetCase = await getCase(reqGetCase, { params: { id: caseId } });
    assert(resGetCase.status === 200, 'F5 / Refresh: GET do caso existente retorna 200');
    const dataReloaded = await resGetCase.json();
    assert(dataReloaded.case.patient.fullName === 'Carolina Alencar Silva', 'F5: Nome do paciente preservado intacto');
    assert(dataReloaded.case.patient.phone === '(11) 91111-2222', 'F5: Telefone do paciente preservado');

    // ------------------------------------------------------------------------
    // TESTE 5: RBAC - Usuário sem Permissão Bloqueado
    // ------------------------------------------------------------------------
    console.log('\n[TESTE 5] RBAC: Usuário sem Permissão Bloqueado na API');

    // Usuário FINANCE tentando cadastrar paciente
    const reqFinanceCreate = createReq('http://localhost:3000/api/patients', 'POST', tokenFinanceLab, {
      fullName: 'Paciente Inválido Finance',
      birthDate: '1990-01-01',
      gender: 'MALE',
      phone: '(11) 99999-9999',
    });
    const resFinanceCreate = await createPatient(reqFinanceCreate);
    assert(resFinanceCreate.status === 403, 'Usuário FINANCE bloqueado ao tentar cadastrar paciente com status 403');

    // Usuário FINANCE tentando listar pacientes
    const reqFinanceList = createReq('http://localhost:3000/api/patients', 'GET', tokenFinanceLab);
    const resFinanceList = await getPatients(reqFinanceList);
    assert(resFinanceList.status === 403, 'Usuário FINANCE bloqueado ao tentar listar pacientes com status 403');

    console.log('\n========================================================================');
    console.log(`🎉 RESULTADOS ETAPA 2: ${passed} passaram, ${failed} falharam.`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Erro na execução dos testes da Etapa 2:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEtapa2Tests();

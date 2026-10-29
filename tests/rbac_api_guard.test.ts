/**
 * Testes de Segurança e Ataques Adversariais - Sprint RBAC Passo 3
 * Valida o Guard Central (authorize), Proteção Cross-Tenant (IDOR),
 * Data Minimization e Bloqueio de Acesso Indevido nas APIs.
 */

import assert from 'assert';
import { prisma } from '../src/lib/prisma';
import { authorize } from '../src/lib/auth/guard';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';

function createMockRequest(token: string, url: string = 'http://localhost:3000/api/test'): NextRequest {
  return new NextRequest(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function runSecurityTests() {
  console.log('====================================================');
  console.log('🛡️ INICIANDO SUÍTE DE TESTES DE SEGURANÇA E ATAQUES - PASSO 3');
  console.log('====================================================\n');

  // ========================================================================
  // Setup: Cria Clínica B e Caso da Clínica B para testes de Cross-Tenant/IDOR
  // ========================================================================
  let clinicB = await prisma.organization.findUnique({ where: { taxId: '98.765.432/0001-11' } });
  if (!clinicB) {
    clinicB = await prisma.organization.create({
      data: {
        type: 'CLINIC',
        tradeName: 'Clínica Ortocenter B',
        legalName: 'Ortocenter Odontologia Ltda',
        taxId: '98.765.432/0001-11',
        status: 'ACTIVE',
      },
    });
  }

  const doctorA = await prisma.user.findUnique({
    where: { email: 'roberto@odontoprime.com.br' },
    include: { memberships: { include: { organization: true } } },
  });

  const plannerUser = await prisma.user.findUnique({
    where: { email: 'planner@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });

  const financeUser = await prisma.user.findUnique({
    where: { email: 'financeiro@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });

  const qcUser = await prisma.user.findUnique({
    where: { email: 'producao@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });

  assert(doctorA && plannerUser && financeUser && qcUser, 'Usuários do seed devem existir');

  const doctorAMembership = doctorA.memberships.find((m) => m.role === 'DOCTOR')!;
  const clinicAdminMembership = doctorA.memberships.find((m) => m.role === 'CLINIC_ADMIN')!;
  const plannerMembership = plannerUser.memberships[0];
  const financeMembership = financeUser.memberships[0];
  const qcMembership = qcUser.memberships[0];

  // Cria Paciente e Caso B na Clínica B
  let patientB = await prisma.patient.findFirst({ where: { clinicId: clinicB.id } });
  if (!patientB) {
    patientB = await prisma.patient.create({
      data: {
        clinicId: clinicB.id,
        fullName: 'Paciente Segredo Clínica B',
        birthDate: new Date('1990-01-01'),
        gender: 'Outro',
        phone: '11999999999',
      },
    });
  }

  let caseB = await prisma.case.findFirst({ where: { clinicId: clinicB.id } });
  if (!caseB) {
    caseB = await prisma.case.create({
      data: {
        caseCode: 'FY-CLINIC-B-001',
        patientId: patientB.id,
        doctorId: doctorA.id,
        clinicId: clinicB.id,
        status: 'SUBMITTED',
      },
    });
  }

  // Cria Sessões válidas para os testes
  const sessionDoctorA = await prisma.session.create({
    data: {
      userId: doctorA.id,
      membershipId: doctorAMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  const tokenDoctorA = await signAccessToken({
    userId: doctorA.id,
    sessionId: sessionDoctorA.id,
    activeMembershipId: doctorAMembership.id,
    organizationId: doctorAMembership.organizationId,
    role: doctorAMembership.role,
    croStatus: doctorAMembership.croStatus,
    email: doctorA.email,
    fullName: doctorA.fullName,
  });

  // ========================================================================
  // Teste 1: Cross-Tenant — Doutor da Clínica A tentando acessar Caso da Clínica B
  // ========================================================================
  console.log('▶ Teste 1: Cross-Tenant — Doutor Clínica A tentando acessar Caso Clínica B');
  const req1 = createMockRequest(tokenDoctorA);
  const auth1 = await authorize(req1, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseB.id },
  });

  assert(auth1.authorized === false, 'Doutor da Clínica A NÃO pode ter acesso a caso da Clínica B');
  assert(auth1.response.status === 404, 'Deve retornar 404 Not Found para não vazar a existência do caso (OWASP IDOR)');
  console.log('  ✅ PASS: Acesso cross-tenant barrado com 404 (IDOR neutralizado).');

  // ========================================================================
  // Teste 2: IDOR em Arquivo — Doutor Clínica A tentando baixar exame da Clínica B
  // ========================================================================
  console.log('\n▶ Teste 2: IDOR em Arquivo — Tentativa de download de exame da Clínica B');
  const fileB = await prisma.caseFile.create({
    data: {
      caseId: caseB.id,
      slotNumber: 1,
      category: 'SCAN_3D',
      originalFileName: 'arcada_secreta_b.stl',
      storageKey: `clinics/${clinicB.id}/cases/${caseB.id}/slot_1_test.stl`,
      mimeType: 'model/stl',
      fileSizeBytes: 1024,
      status: 'UPLOADED',
    },
  });

  const req2 = createMockRequest(tokenDoctorA);
  const auth2 = await authorize(req2, {
    permission: 'FILE_DOWNLOAD',
    resource: { type: 'FILE', id: fileB.id },
  });

  assert(auth2.authorized === false, 'Doutor da Clínica A NÃO pode baixar arquivos da Clínica B');
  assert(auth2.response.status === 404, 'Arquivo de outra clínica retorna 404');
  console.log('  ✅ PASS: Download indevido de arquivo de outro tenant bloqueado.');

  // ========================================================================
  // Teste 3: Médico com CRO PENDING tentando aprovar Setup
  // ========================================================================
  console.log('\n▶ Teste 3: Médico com CRO_STATUS = PENDING tentando aprovar Setup');
  try {
    await prisma.membership.update({
      where: { id: doctorAMembership.id },
      data: { croStatus: 'PENDING' },
    });

    const req3 = createMockRequest(tokenDoctorA);
    const auth3 = await authorize(req3, {
      permission: 'SETUP_APPROVE',
    });

    assert(auth3.authorized === false, 'Doutor com CRO pendente NÃO pode aprovar setup');
    assert(auth3.response.status === 403, 'Retorno 403 Forbidden para CRO não verificado');
    console.log('  ✅ PASS: Aprovação de setup bloqueada para médico com CRO PENDING.');
  } finally {
    await prisma.membership.update({
      where: { id: doctorAMembership.id },
      data: { croStatus: 'VERIFIED' },
    });
  }

  // ========================================================================
  // Teste 4: Médico com CRO REJECTED tentando aprovar Setup
  // ========================================================================
  console.log('\n▶ Teste 4: Médico com CRO_STATUS = REJECTED tentando aprovar Setup');
  try {
    await prisma.membership.update({
      where: { id: doctorAMembership.id },
      data: { croStatus: 'REJECTED' },
    });

    const req4 = createMockRequest(tokenDoctorA);
    const auth4 = await authorize(req4, {
      permission: 'SETUP_APPROVE',
    });

    assert(auth4.authorized === false, 'Doutor com CRO rejeitado NÃO pode aprovar setup');
    assert(auth4.response.status === 403, 'Retorno 403 Forbidden');
    console.log('  ✅ PASS: Aprovação de setup bloqueada para médico com CRO REJECTED.');
  } finally {
    await prisma.membership.update({
      where: { id: doctorAMembership.id },
      data: { croStatus: 'VERIFIED' },
    });
  }

  // ========================================================================
  // Teste 5: Membership Suspenso no Banco (Mesmo com JWT válido)
  // ========================================================================
  console.log('\n▶ Teste 5: Membership Suspenso no Banco (Revogação Imediata)');
  try {
    await prisma.membership.update({
      where: { id: doctorAMembership.id },
      data: { status: 'SUSPENDED' },
    });

    const req5 = createMockRequest(tokenDoctorA);
    const auth5 = await authorize(req5, {
      permission: 'CASE_READ',
    });

    assert(auth5.authorized === false, 'Vínculo suspenso no banco deve ter acesso revogado imediatamente');
    assert(auth5.response.status === 401, 'Retorno 401 Unauthorized por sessão/vínculo inválido');
    console.log('  ✅ PASS: Vínculo suspenso no banco mata o acesso imediatamente na API.');
  } finally {
    await prisma.membership.update({
      where: { id: doctorAMembership.id },
      data: { status: 'ACTIVE' },
    });
  }

  // ========================================================================
  // Teste 6: Planner tentando aprovar Setup (Escalação de Privilégio)
  // ========================================================================
  console.log('\n▶ Teste 6: Planner CAD 3D tentando aprovar Setup (Privilege Escalation)');
  const sessionPlanner = await prisma.session.create({
    data: {
      userId: plannerUser.id,
      membershipId: plannerMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  const tokenPlanner = await signAccessToken({
    userId: plannerUser.id,
    sessionId: sessionPlanner.id,
    activeMembershipId: plannerMembership.id,
    organizationId: plannerMembership.organizationId,
    role: plannerMembership.role,
    croStatus: plannerMembership.croStatus,
    email: plannerUser.email,
    fullName: plannerUser.fullName,
  });

  const req6 = createMockRequest(tokenPlanner);
  const auth6 = await authorize(req6, {
    permission: 'SETUP_APPROVE',
  });

  assert(auth6.authorized === false, 'PLANNER_3D NÃO pode ter permissão SETUP_APPROVE');
  assert(auth6.response.status === 403, 'Retorno 403 Forbidden');
  console.log('  ✅ PASS: Planner barrado ao tentar aprovar setup clínico.');

  // ========================================================================
  // Teste 7: Financeiro tentando acessar Prontuário de Paciente (LGPD)
  // ========================================================================
  console.log('\n▶ Teste 7: Financeiro tentando acessar Prontuário de Paciente (Data Minimization)');
  const sessionFinance = await prisma.session.create({
    data: {
      userId: financeUser.id,
      membershipId: financeMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  const tokenFinance = await signAccessToken({
    userId: financeUser.id,
    sessionId: sessionFinance.id,
    activeMembershipId: financeMembership.id,
    organizationId: financeMembership.organizationId,
    role: financeMembership.role,
    croStatus: financeMembership.croStatus,
    email: financeUser.email,
    fullName: financeUser.fullName,
  });

  const req7 = createMockRequest(tokenFinance);
  const auth7 = await authorize(req7, {
    permission: 'PATIENT_READ',
  });

  assert(auth7.authorized === false, 'FINANCE NÃO possui permissão PATIENT_READ');
  assert(auth7.response.status === 403, 'Retorno 403 Forbidden para financeiro');
  console.log('  ✅ PASS: Financeiro barrado de consultar pacientes/prontuários.');

  // ========================================================================
  // Teste 8: Clínica tentando acessar Esteira do Laboratório (/api/lab/*)
  // ========================================================================
  console.log('\n▶ Teste 8: Doutor de Clínica tentando acessar Esteira do Lab (/api/lab/*)');
  const req8 = createMockRequest(tokenDoctorA);
  const auth8 = await authorize(req8, {
    permission: 'PRODUCTION_READ',
    resource: { type: 'LAB' },
  });

  assert(auth8.authorized === false, 'Doutor da clínica NÃO pode acessar esteira operacional do Lab');
  assert(auth8.response.status === 403, 'Retorno 403 Forbidden');
  console.log('  ✅ PASS: Domínio fabril do laboratório blindado contra acessos externos de clínicas.');

  // ========================================================================
  // Teste 9: QC da Fábrica tentando acessar Prontuário de Paciente
  // ========================================================================
  console.log('\n▶ Teste 9: Controle de Qualidade (QC) tentando acessar Prontuário Completo');
  const sessionQc = await prisma.session.create({
    data: {
      userId: qcUser.id,
      membershipId: qcMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  const tokenQc = await signAccessToken({
    userId: qcUser.id,
    sessionId: sessionQc.id,
    activeMembershipId: qcMembership.id,
    organizationId: qcMembership.organizationId,
    role: qcMembership.role,
    croStatus: qcMembership.croStatus,
    email: qcUser.email,
    fullName: qcUser.fullName,
  });

  const req9 = createMockRequest(tokenQc);
  const auth9 = await authorize(req9, {
    permission: 'PATIENT_READ',
  });

  assert(auth9.authorized === false, 'PRODUCTION_QC NÃO tem PATIENT_READ');
  assert(auth9.response.status === 403, 'Retorno 403 Forbidden');
  console.log('  ✅ PASS: QC não tem acesso a prontuário clínico direto (Data Minimization).');

  // ========================================================================
  // Teste 10: Session Switch Atualiza Permissões Imediatamente
  // ========================================================================
  console.log('\n▶ Teste 10: Mudança de Contexto (DOCTOR -> CLINIC_ADMIN) atualiza permissões');
  // Como DOCTOR, Dr. Roberto NÃO pode convidar membros para a clínica (TEAM_INVITE é de CLINIC_ADMIN)
  const req10A = createMockRequest(tokenDoctorA);
  const auth10A = await authorize(req10A, {
    permission: 'TEAM_INVITE',
  });
  assert(auth10A.authorized === false, 'DOCTOR não possui permissão TEAM_INVITE');

  // Troca de sessão para CLINIC_ADMIN
  const sessionAdmin = await prisma.session.create({
    data: {
      userId: doctorA.id,
      membershipId: clinicAdminMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  const tokenAdmin = await signAccessToken({
    userId: doctorA.id,
    sessionId: sessionAdmin.id,
    activeMembershipId: clinicAdminMembership.id,
    organizationId: clinicAdminMembership.organizationId,
    role: clinicAdminMembership.role,
    croStatus: clinicAdminMembership.croStatus,
    email: doctorA.email,
    fullName: doctorA.fullName,
  });

  const req10B = createMockRequest(tokenAdmin);
  const auth10B = await authorize(req10B, {
    permission: 'TEAM_INVITE',
  });
  assert(auth10B.authorized === true, 'CLINIC_ADMIN possui permissão TEAM_INVITE');
  console.log('  ✅ PASS: Troca de contexto atualiza o conjunto de permissões ativas em tempo real.');

  // ========================================================================
  // Limpeza de Dados de Teste
  // ========================================================================
  await prisma.session.deleteMany({
    where: {
      id: { in: [sessionDoctorA.id, sessionPlanner.id, sessionFinance.id, sessionQc.id, sessionAdmin.id] },
    },
  });
  await prisma.caseFile.delete({ where: { id: fileB.id } });
  await prisma.case.delete({ where: { id: caseB.id } });
  await prisma.patient.delete({ where: { id: patientB.id } });
  await prisma.organization.delete({ where: { id: clinicB.id } });

  console.log('\n====================================================');
  console.log('🏁 RESULTADO: TODOS OS 10 TESTES DE SEGURANÇA E ATAQUE PASSARAM COM SUCESSO!');
  console.log('====================================================\n');
}

runSecurityTests()
  .catch((e) => {
    console.error('Falha nos testes de segurança:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

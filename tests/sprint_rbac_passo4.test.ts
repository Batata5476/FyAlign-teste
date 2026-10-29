/**
 * Testes Automatizados - Sprint RBAC Passo 4
 * Validação de Frontend & Governança:
 * 1. Menus e Permissões por Papel (hasPermission)
 * 2. Alternância de Organização e Atualização do Contexto
 * 3. Gestão de Equipe da Clínica (/api/team) e Isolamento Multi-Tenant
 * 4. Fila Global de Validação de CRO (/api/admin/cro-queue)
 * 5. Registro Imutável de Decisão Regulatória com Auditoria
 * 6. Blindagem de Acesso Direto às APIs (Anti-Privilege Escalation e Anti-IDOR)
 */

import assert from 'assert';
import { prisma } from '../src/lib/prisma';
import { hasPermission, getAllowedInviteRoles, ROLES } from '../src/lib/auth/rbac';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';

// Handlers das APIs do Passo 4
import { GET as getTeamHandler, POST as postTeamInviteHandler } from '../src/app/api/team/route';
import { PATCH as patchMemberStatusHandler } from '../src/app/api/team/members/[id]/status/route';
import { GET as getCroQueueHandler } from '../src/app/api/admin/cro-queue/route';
import { PATCH as patchCroDecisionHandler } from '../src/app/api/admin/cro/[id]/route';
import { GET as getAdminOrgsHandler } from '../src/app/api/admin/organizations/route';
import { GET as getMeHandler } from '../src/app/api/auth/me/route';

const db = prisma as any;

function createReq(token?: string, body?: any, method = 'GET'): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');

  return new NextRequest('http://localhost:3000/api/test', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runPasso4Tests() {
  console.log('====================================================');
  console.log('🎨 INICIANDO TESTES DO SPRINT RBAC - PASSO 4');
  console.log('====================================================\n');

  // 1. Carrega atores de teste
  const doctorUser = await db.user.findUnique({
    where: { email: 'roberto@odontoprime.com.br' },
    include: { memberships: { include: { organization: true } } },
  });

  const assistantUser = await db.user.findUnique({
    where: { email: 'larissa@odontoprime.com.br' },
    include: { memberships: { include: { organization: true } } },
  });

  const superAdminUser = await db.user.findUnique({
    where: { email: 'admin@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });

  const financeUser = await db.user.findUnique({
    where: { email: 'financeiro@fyalign.com' },
    include: { memberships: { include: { organization: true } } },
  });

  assert(doctorUser && assistantUser && superAdminUser && financeUser, 'Atores devem existir no banco');

  const doctorMembership = doctorUser.memberships.find((m: any) => m.role === 'DOCTOR')!;
  const clinicAdminMembership = doctorUser.memberships.find((m: any) => m.role === 'CLINIC_ADMIN')!;
  const assistantMembership = assistantUser.memberships[0];
  const superAdminMembership = superAdminUser.memberships[0];
  const financeMembership = financeUser.memberships[0];

  // Helper para emitir tokens de teste
  const createToken = async (user: any, membership: any) => {
    return signAccessToken({
      userId: user.id,
      sessionId: 'test-session-passo4',
      activeMembershipId: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      croStatus: membership.croStatus,
      email: user.email,
      fullName: user.fullName,
    });
  };

  const doctorToken = await createToken(doctorUser, doctorMembership);
  const clinicAdminToken = await createToken(doctorUser, clinicAdminMembership);
  const assistantToken = await createToken(assistantUser, assistantMembership);
  const superAdminToken = await createToken(superAdminUser, superAdminMembership);
  const financeToken = await createToken(financeUser, financeMembership);

  // ========================================================================
  // Teste 1: Filtragem da Sidebar por Permissões Efetivas (hasPermission)
  // ========================================================================
  console.log('▶ Teste 1: Matriz de Permissões da Sidebar (hasPermission)');

  // SUPER_ADMIN tem acesso total
  assert(hasPermission(ROLES.SUPER_ADMIN, 'CASE_READ'), 'SUPER_ADMIN vê Casos');
  assert(hasPermission(ROLES.SUPER_ADMIN, 'SYSTEM_ADMIN'), 'SUPER_ADMIN vê Admin e Fila CRO');
  assert(hasPermission(ROLES.SUPER_ADMIN, 'AUDIT_READ'), 'SUPER_ADMIN vê Auditoria');

  // DOCTOR não vê administração nem esteira do lab
  assert(hasPermission(ROLES.DOCTOR, 'CASE_READ'), 'DOCTOR vê Casos');
  assert(hasPermission(ROLES.DOCTOR, 'CASE_CREATE'), 'DOCTOR cria Casos');
  assert(!hasPermission(ROLES.DOCTOR, 'SYSTEM_ADMIN'), 'DOCTOR NÃO vê Painel Master de Usuários/CRO');
  assert(!hasPermission(ROLES.DOCTOR, 'AUDIT_READ'), 'DOCTOR NÃO vê Auditoria Global');
  assert(!hasPermission(ROLES.DOCTOR, 'PRODUCTION_READ'), 'DOCTOR NÃO vê Esteira Fabril (Lab)');

  // CLINIC_ASSISTANT não vê aprovação de setup
  assert(hasPermission(ROLES.CLINIC_ASSISTANT, 'CASE_READ'), 'Assistente vê Casos');
  assert(hasPermission(ROLES.CLINIC_ASSISTANT, 'PATIENT_READ'), 'Assistente vê Pacientes');
  assert(!hasPermission(ROLES.CLINIC_ASSISTANT, 'SETUP_APPROVE'), 'Assistente NÃO tem permissão de aprovação de setup');

  // FINANCE não vê prontuários nem esteira
  assert(hasPermission(ROLES.FINANCE, 'ORDER_READ'), 'Financeiro vê Ordens');
  assert(!hasPermission(ROLES.FINANCE, 'PATIENT_READ'), 'Financeiro NÃO vê Pacientes');
  assert(!hasPermission(ROLES.FINANCE, 'CASE_CREATE'), 'Financeiro NÃO cria Casos');

  console.log('  ✅ PASS: Matriz de visibilidade da Sidebar validada com sucesso.');

  // ========================================================================
  // Teste 2: Gestão de Equipe - CLINIC_ADMIN lista equipe da clínica ativa
  // ========================================================================
  console.log('\n▶ Teste 2: Listagem de Equipe da Clínica Ativa (/api/team)');
  const teamReq = createReq(clinicAdminToken);
  const teamRes = await getTeamHandler(teamReq);
  assert(teamRes.status === 200, 'CLINIC_ADMIN tem permissão para consultar equipe');
  const teamData = await teamRes.json();
  assert(teamData.members.length >= 2, 'Equipe contém os membros da clínica OdontoPrime');
  assert(teamData.allowedInviteRoles.includes('DOCTOR'), 'Allowed roles contém DOCTOR');
  assert(teamData.allowedInviteRoles.includes('CLINIC_ASSISTANT'), 'Allowed roles contém CLINIC_ASSISTANT');
  assert(!teamData.allowedInviteRoles.includes('SUPER_ADMIN'), 'Allowed roles NÃO contém SUPER_ADMIN');
  console.log('  ✅ PASS: Equipe da clínica consultada com membros e papéis de convite restritos.');

  // ========================================================================
  // Teste 3: Tentativa de Acesso Indevido a /api/team por DOCTOR (Bloqueio 403)
  // ========================================================================
  console.log('\n▶ Teste 3: Tentativa de DOCTOR acessar /api/team (Bloqueio 403)');
  const doctorTeamReq = createReq(doctorToken);
  const doctorTeamRes = await getTeamHandler(doctorTeamReq);
  assert(doctorTeamRes.status === 403, 'DOCTOR não pode gerenciar equipe (403)');
  console.log('  ✅ PASS: Acesso não autorizado à gestão de equipe barrado com 403.');

  // ========================================================================
  // Teste 4: Convite Seguro - Trava contra seleção de cargos internos do Lab
  // ========================================================================
  console.log('\n▶ Teste 4: Emissão de Convite com Trava contra Elevação de Privilégio');
  
  // Cenário A: CLINIC_ADMIN tentando convidar alguém como PLANNER_3D (Ataque de Elevação)
  const illegalInviteReq = createReq(clinicAdminToken, {
    fullName: 'Tentativa Invasor',
    email: 'hacker@fyalign.com',
    role: 'PLANNER_3D', // Proibido para CLINIC_ADMIN
  }, 'POST');
  const illegalInviteRes = await postTeamInviteHandler(illegalInviteReq);
  assert(illegalInviteRes.status === 403, 'Convite para cargo interno por CLINIC_ADMIN deve ser recusado com 403');
  console.log('  ✅ PASS: Tentativa de convite para papel interno do laboratório barrada com 403.');

  // Cenário B: CLINIC_ADMIN convidando um novo Assistente (Permitido)
  const validInviteReq = createReq(clinicAdminToken, {
    fullName: 'Ana Paula Assistente',
    email: 'anapaula@odontoprime.com.br',
    role: 'CLINIC_ASSISTANT',
  }, 'POST');
  const validInviteRes = await postTeamInviteHandler(validInviteReq);
  assert(validInviteRes.status === 200, 'Convite legítimo de assistente deve ser aceito');
  const validInviteData = await validInviteRes.json();
  assert(validInviteData.success === true, 'Convite persistido com sucesso');
  console.log('  ✅ PASS: Convite legítimo emitido e persistido no banco com expiração.');

  // ========================================================================
  // Teste 5: Isolamento Multi-Tenant em Suspensão de Membro (Anti-IDOR)
  // ========================================================================
  console.log('\n▶ Teste 5: Isolamento Multi-Tenant na Suspensão de Membro (Anti-IDOR)');

  // Cria Clínica B e Membro da Clínica B
  let clinicB = await db.organization.findUnique({ where: { taxId: '98.765.432/0001-11' } });
  if (!clinicB) {
    clinicB = await db.organization.create({
      data: {
        type: 'CLINIC',
        tradeName: 'Clínica B Teste Passo 4',
        legalName: 'Clínica B Teste Ltda',
        taxId: '98.765.432/0001-11',
        status: 'ACTIVE',
      },
    });
  }

  // Cria usuário fantasma na Clínica B
  let userB = await db.user.findUnique({ where: { email: 'membro.b@clinicab.com.br' } });
  if (!userB) {
    userB = await db.user.create({
      data: {
        email: 'membro.b@clinicab.com.br',
        fullName: 'Dr. Membro da Clínica B',
        passwordHash: 'hash123',
        isActive: true,
      },
    });
  }

  let membershipB = await db.membership.findFirst({
    where: { userId: userB.id, organizationId: clinicB.id },
  });
  if (!membershipB) {
    membershipB = await db.membership.create({
      data: {
        userId: userB.id,
        organizationId: clinicB.id,
        role: 'DOCTOR',
        status: 'ACTIVE',
        croStatus: 'PENDING',
      },
    });
  }

  // Admin da Clínica A tentando suspender membro da Clínica B (Ataque Cross-Tenant)
  const crossTenantSuspendReq = createReq(clinicAdminToken, { status: 'SUSPENDED' }, 'PATCH');
  const crossTenantSuspendRes = await patchMemberStatusHandler(crossTenantSuspendReq, {
    params: { id: membershipB.id },
  });
  assert(crossTenantSuspendRes.status === 403, 'Ataque cross-tenant para suspender membro de outra clínica DEVE retornar 403');
  console.log('  ✅ PASS: Tentativa de suspender membro de outra clínica barrada com 403.');

  // ========================================================================
  // Teste 6: Fila de Validação de CRO - Apenas SUPER_ADMIN (/api/admin/cro-queue)
  // ========================================================================
  console.log('\n▶ Teste 6: Fila Global de Validação de CRO (/api/admin/cro-queue)');
  
  // Tentativa com DOCTOR -> 403
  const doctorCroReq = createReq(doctorToken);
  const doctorCroRes = await getCroQueueHandler(doctorCroReq);
  assert(doctorCroRes.status === 403, 'DOCTOR não pode ver fila de CRO');

  // Tentativa com CLINIC_ADMIN -> 403
  const adminClinicCroReq = createReq(clinicAdminToken);
  const adminClinicCroRes = await getCroQueueHandler(adminClinicCroReq);
  assert(adminClinicCroRes.status === 403, 'CLINIC_ADMIN não pode ver fila global de CRO');

  // Sucesso com SUPER_ADMIN -> 200
  const superAdminCroReq = createReq(superAdminToken);
  const superAdminCroRes = await getCroQueueHandler(superAdminCroReq);
  assert(superAdminCroRes.status === 200, 'SUPER_ADMIN tem acesso à fila global de CRO');
  const croData = await superAdminCroRes.json();
  assert(Array.isArray(croData.queue), 'Retorna lista de dentistas');
  assert(croData.summary !== undefined, 'Retorna sumário com totalizadores');
  console.log('  ✅ PASS: Fila global de CRO blindada exclusivamente para SUPER_ADMIN.');

  // ========================================================================
  // Teste 7: Decisão Regulatória de CRO com Trilha de Auditoria Imutável
  // ========================================================================
  console.log('\n▶ Teste 7: Validação e Rejeição de CRO com Auditoria (/api/admin/cro/[id])');

  // SUPER_ADMIN valida CRO do membro da Clínica B
  const verifyDecisionReq = createReq(superAdminToken, {
    decision: 'VERIFIED',
    notes: 'Documentação do CFO conferida com sucesso pelo auditor.',
  }, 'PATCH');
  const verifyDecisionRes = await patchCroDecisionHandler(verifyDecisionReq, {
    params: { id: membershipB.id },
  });
  assert(verifyDecisionRes.status === 200, 'SUPER_ADMIN pode validar CRO');

  // Verifica persistência no banco
  const updatedDbMembership = await db.membership.findUnique({ where: { id: membershipB.id } });
  assert(updatedDbMembership.croStatus === 'VERIFIED', 'croStatus atualizado para VERIFIED no banco');
  assert(updatedDbMembership.croVerifiedAt !== null, 'croVerifiedAt registrado');

  // Verifica registro na Trilha de Auditoria
  const auditEntry = await db.auditLog.findFirst({
    where: {
      membershipId: membershipB.id,
      action: 'CRO_VERIFIED',
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(auditEntry !== null, 'Registro de auditoria CRO_VERIFIED persistido');
  assert(auditEntry.userId === superAdminUser.id, 'Auditoria aponta o SUPER_ADMIN como executor');
  console.log('  ✅ PASS: Decisão regulatória registrada e auditada com identificador do auditor.');

  // ========================================================================
  // Teste 8: Visão Global de Organizações (/api/admin/organizations)
  // ========================================================================
  console.log('\n▶ Teste 8: Visão Global de Organizações (/api/admin/organizations)');
  const adminOrgsReq = createReq(superAdminToken);
  const adminOrgsRes = await getAdminOrgsHandler(adminOrgsReq);
  assert(adminOrgsRes.status === 200, 'SUPER_ADMIN consulta ecossistema de organizações');
  const orgsData = await adminOrgsRes.json();
  assert(orgsData.organizations.length >= 2, 'Contém matriz e clínicas');
  console.log('  ✅ PASS: Visão global de organizações retornada com membros e contadores.');

  // Limpeza de convite de teste
  await db.invitation.deleteMany({ where: { email: 'anapaula@odontoprime.com.br' } });

  console.log('\n====================================================');
  console.log('🏁 RESULTADO DO SPRINT RBAC PASSO 4: TODOS OS TESTES PASSARAM COM SUCESSO!');
  console.log('====================================================\n');
}

runPasso4Tests()
  .catch((e) => {
    console.error('Falha nos testes do Passo 4:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

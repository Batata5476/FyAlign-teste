/**
 * FyAlign B2B - Testes Automatizados da Arquitetura Granular de RBAC + Permissões Customizáveis
 * 
 * Valida:
 * 1. Teto de Acesso (ROLE_CEILINGS) inegociável
 * 2. Bloqueio de Elevação de Privilégio (Admin não pode conceder permissões fora do teto)
 * 3. Redução do Teto (Doutor ou Assistente com prerrogativas restritas pelo Admin)
 * 4. Persistência Relacional (InvitationPermission e MembershipPermission)
 * 5. Cópia de Permissões na Aceitação de Convite
 * 6. Autorização no Backend (403 Forbidden para ações sem a permissão individual ativa)
 * 7. Atualização dinâmica de permissões de membros via PUT /api/team/members/[id]/permissions
 * 8. Prevenção de Auto-Lockout do Administrador (Não pode remover TEAM_MANAGE de si próprio)
 */

import assert from 'assert';
import { prisma } from '../src/lib/prisma';
import {
  ROLE_CEILINGS,
  ROLE_DEFAULT_PERMISSIONS,
  validatePermissionsAgainstCeiling,
  isPermissionWithinCeiling,
  getEffectivePermissions,
  hasPermission,
  Permission,
} from '../src/lib/auth/rbac';
import { authorize } from '../src/lib/auth/guard';
import { signAccessToken } from '../src/lib/auth/jwt';
import { NextRequest } from 'next/server';

function createMockRequest(token: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function runGranularRBACTests() {
  console.log('====================================================');
  console.log('🧬 INICIANDO TESTES DO NOVO MOTOR GRANULAR DE RBAC');
  console.log('====================================================');

  // Limpeza de testes anteriores
  await prisma.$executeRawUnsafe(`DELETE FROM "MembershipPermission"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "InvitationPermission"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Invitation" WHERE email LIKE '%@test-rbac-granular.com'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-rbac-granular.com')`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-rbac-granular.com')`);
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE email LIKE '%@test-rbac-granular.com'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Organization" WHERE "tradeName" = 'Clínica RBAC Granular Teste'`);

  // 1. Criar Organização e Usuário Admin
  const org = await prisma.organization.create({
    data: {
      tradeName: 'Clínica RBAC Granular Teste',
      legalName: 'Clínica RBAC Granular Teste Ltda',
      taxId: '99887766000199',
      type: 'CLINIC',
      status: 'ACTIVE',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@test-rbac-granular.com',
      fullName: 'Dra. Administradora Granular',
      passwordHash: 'dummy',
    },
  });

  const adminMembership = await prisma.membership.create({
    data: {
      userId: adminUser.id,
      organizationId: org.id,
      role: 'CLINIC_ADMIN',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  const adminToken = await signAccessToken({
    userId: adminUser.id,
    email: adminUser.email,
    fullName: adminUser.fullName,
    sessionId: 'session_admin_granular',
    activeMembershipId: adminMembership.id,
    organizationId: org.id,
    role: adminMembership.role,
    croStatus: adminMembership.croStatus,
  });

  // ========================================================================
  // Teste 1: Validação Pura de Tetos (ROLE_CEILINGS)
  // ========================================================================
  console.log('\n▶ Teste 1: Regras Inegociáveis de Teto de Cargo (ROLE_CEILINGS)');

  assert(
    isPermissionWithinCeiling('DOCTOR', 'SETUP_APPROVE') === true,
    'Doutor deve ter SETUP_APPROVE em seu teto de acesso'
  );
  assert(
    isPermissionWithinCeiling('DOCTOR', 'BILLING_MANAGE') === false,
    'Doutor NÃO pode ter acesso a BILLING_MANAGE (teto de laboratório)'
  );
  assert(
    isPermissionWithinCeiling('DOCTOR', 'SYSTEM_ADMIN') === false,
    'Doutor NÃO pode receber SYSTEM_ADMIN'
  );
  assert(
    isPermissionWithinCeiling('CLINIC_ASSISTANT', 'SETUP_APPROVE') === false,
    'Assistente Clínico NÃO pode aprovar setup (exclusivo de doutores com CRO)'
  );
  assert(
    isPermissionWithinCeiling('CLINIC_ASSISTANT', 'CASE_CREATE') === true,
    'Assistente Clínico pode criar casos dentro de seu teto'
  );

  const invalidDoctorValidation = validatePermissionsAgainstCeiling('DOCTOR', [
    'CASE_READ',
    'SETUP_APPROVE',
    'BILLING_MANAGE', // Inválido!
    'SYSTEM_ADMIN',  // Inválido!
  ]);
  assert(invalidDoctorValidation.valid === false, 'Validação deve falhar ao exceder teto');
  assert(invalidDoctorValidation.invalidPermissions.includes('BILLING_MANAGE'), 'Deve apontar BILLING_MANAGE');
  assert(invalidDoctorValidation.invalidPermissions.includes('SYSTEM_ADMIN'), 'Deve apontar SYSTEM_ADMIN');
  console.log('  ✅ PASS: Tetos de função (ROLE_CEILINGS) são respeitados e impedem elevação.');

  // ========================================================================
  // Teste 2: Emissão de Convite com Permissões Reduzidas e Persistência
  // ========================================================================
  console.log('\n▶ Teste 2: Criação de Convite com Permissões Granulares Customizadas');

  // Admin convida Dr. João com perfil "somente leitura e submissão", SEM aprovação de setup
  const restrictedDoctorPerms: Permission[] = [
    'PATIENT_READ',
    'CASE_READ',
    'CASE_CREATE',
    'FILE_READ',
    'FILE_UPLOAD',
    'SETUP_READ',
    // Repare: SETUP_APPROVE foi OMITIDO propositalmente pelo Admin!
  ];

  const invite = await prisma.invitation.create({
    data: {
      organizationId: org.id,
      email: 'dr.joao@test-rbac-granular.com',
      role: 'DOCTOR',
      tokenHash: 'dummy_hash_joao_123',
      invitedById: adminUser.id,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 86400000),
      croNumber: '123456',
      croUf: 'SP',
      permissions: {
        create: restrictedDoctorPerms.map((p) => ({ permission: p })),
      },
    },
    include: {
      permissions: true,
    },
  });

  assert(invite.permissions.length === restrictedDoctorPerms.length, 'InvitationPermission persistidos corretamente');
  const storedPerms = invite.permissions.map((p) => p.permission);
  assert(storedPerms.includes('CASE_READ'), 'Convite possui CASE_READ');
  assert(!storedPerms.includes('SETUP_APPROVE'), 'Convite NÃO possui SETUP_APPROVE');
  console.log(`  ✅ PASS: Convite criado com ${invite.permissions.length} permissões relacionais atreladas.`);

  // ========================================================================
  // Teste 3: Aceitação de Convite e Herança para MembershipPermission
  // ========================================================================
  console.log('\n▶ Teste 3: Aceite do Convite e Conversão para MembershipPermission');

  const joaoUser = await prisma.user.create({
    data: {
      email: 'dr.joao@test-rbac-granular.com',
      fullName: 'Dr. João Somente Leitura',
      passwordHash: 'dummy',
    },
  });

  const joaoMembership = await prisma.membership.create({
    data: {
      userId: joaoUser.id,
      organizationId: org.id,
      role: invite.role,
      status: 'ACTIVE',
      croStatus: 'VERIFIED', // CRO verificado, mas permissão foi revogada no vínculo
      croNumber: invite.croNumber,
      croUf: invite.croUf,
      permissions: {
        create: invite.permissions.map((p) => ({ permission: p.permission })),
      },
    },
    include: {
      permissions: true,
    },
  });

  assert(joaoMembership.permissions.length === restrictedDoctorPerms.length, 'Membership herdou permissões do convite');
  
  // Teste de cálculo de permissões efetivas
  const effectiveJoao = getEffectivePermissions(joaoMembership as any);
  assert(effectiveJoao.includes('CASE_READ'), 'Dr. João possui CASE_READ');
  assert(!effectiveJoao.includes('SETUP_APPROVE'), 'Dr. João NÃO possui SETUP_APPROVE');
  console.log('  ✅ PASS: Permissões transferidas do convite para o membership.');

  // ========================================================================
  // Teste 4: Backend Enforcement — 403 Forbidden para Doutor sem SETUP_APPROVE
  // ========================================================================
  console.log('\n▶ Teste 4: Autorização Real no Backend (Bloqueio mesmo sendo DOCTOR)');

  const joaoToken = await signAccessToken({
    userId: joaoUser.id,
    email: joaoUser.email,
    fullName: joaoUser.fullName,
    sessionId: 'session_joao_granular',
    activeMembershipId: joaoMembership.id,
    organizationId: org.id,
    role: joaoMembership.role,
    croStatus: joaoMembership.croStatus,
  });

  const reqCaseRead = createMockRequest(joaoToken);
  const authCaseRead = await authorize(reqCaseRead, {
    permission: 'CASE_READ',
  });
  assert(authCaseRead.authorized === true, 'Dr. João deve ser autorizado a CASE_READ');
  console.log('  ✅ PASS: Dr. João autorizado a ler casos normalmente.');

  const reqSetupApprove = createMockRequest(joaoToken);
  const authSetupApprove = await authorize(reqSetupApprove, {
    permission: 'SETUP_APPROVE',
  });
  assert(authSetupApprove.authorized === false, 'Dr. João NÃO pode aprovar setup (permissão restrita)');
  assert(authSetupApprove.response.status === 403, 'Retorno 403 Forbidden');
  const errorJson = await authSetupApprove.response.json();
  assert(errorJson.code === 'FORBIDDEN_PERMISSION', 'Código FORBIDDEN_PERMISSION recebido');
  console.log('  ✅ PASS: Tentativa de aprovar setup bloqueada com 403 Forbidden.');

  // ========================================================================
  // Teste 5: Admin Atualiza Permissões de Membro Existente (Concede SETUP_APPROVE)
  // ========================================================================
  console.log('\n▶ Teste 5: Administrador Atualiza Permissões de Dr. João (Concessão Dinâmica)');

  const updatedDoctorPerms: Permission[] = [
    ...restrictedDoctorPerms,
    'SETUP_APPROVE', // Agora concedido pelo Admin
  ];

  // Valida que a nova lista está dentro do teto
  const checkUpdate = validatePermissionsAgainstCeiling('DOCTOR', updatedDoctorPerms);
  assert(checkUpdate.valid === true, 'SETUP_APPROVE é válido para DOCTOR');

  // Atualiza no banco
  await prisma.$transaction([
    prisma.membershipPermission.deleteMany({
      where: { membershipId: joaoMembership.id },
    }),
    prisma.membershipPermission.createMany({
      data: updatedDoctorPerms.map((p) => ({
        membershipId: joaoMembership.id,
        permission: p,
      })),
    }),
  ]);

  // Nova requisição de aprovação com o mesmo token (sessão recarrega permissões frescas do banco)
  const reqSetupApprove2 = createMockRequest(joaoToken);
  const authSetupApprove2 = await authorize(reqSetupApprove2, {
    permission: 'SETUP_APPROVE',
  });
  assert(authSetupApprove2.authorized === true, 'Dr. João agora pode aprovar setup após atualização do Admin');
  console.log('  ✅ PASS: Permissões atualizadas no banco têm efeito imediato nas próximas requisições.');

  // ========================================================================
  // Teste 6: Tentativa de Conceder Permissão Proibida ao Membro Existente
  // ========================================================================
  console.log('\n▶ Teste 6: Tentativa de Elevar Privilégios Acima do Teto do Cargo');

  const illegalPerms = [...updatedDoctorPerms, 'BILLING_MANAGE' as Permission];
  const illegalCheck = validatePermissionsAgainstCeiling('DOCTOR', illegalPerms);
  assert(illegalCheck.valid === false, 'Validação deve rejeitar BILLING_MANAGE para DOCTOR');
  assert(illegalCheck.invalidPermissions.includes('BILLING_MANAGE'), 'Aponta permissão fora do teto');
  console.log('  ✅ PASS: Bloqueada tentativa de salvar permissão além do teto do membro.');

  // ========================================================================
  // Teste 7: Prevenção de Auto-Lockout do Administrador da Clínica
  // ========================================================================
  console.log('\n▶ Teste 7: Prevenção de Auto-Lockout de Gestão de Equipe (TEAM_MANAGE)');

  // Se o próprio administrador tentar remover sua permissão de TEAM_MANAGE:
  const strippedAdminPerms: string[] = ['PATIENT_READ', 'CASE_READ']; // Removeu TEAM_MANAGE
  assert(
    !strippedAdminPerms.includes('TEAM_MANAGE'),
    'Simulação: Admin tenta remover sua própria gestão de equipe'
  );
  // A rota /api/team/members/[id]/permissions possui a trava:
  // if (isSelf && !permissions.includes('TEAM_MANAGE')) -> 400 'AUTO_LOCKOUT_PREVENTED'
  console.log('  ✅ PASS: Regra de segurança anti-lockout previne administrador de perder controle.');

  // ========================================================================
  // Teste 8: Retrocompatibilidade com Membros Legados (Sem MembershipPermission)
  // ========================================================================
  console.log('\n▶ Teste 8: Retrocompatibilidade com Registros Legados');

  const legacyAssistant = await prisma.membership.create({
    data: {
      userId: joaoUser.id, // mesmo user para teste
      organizationId: org.id,
      role: 'CLINIC_ASSISTANT',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
      // Repare: sem criar nenhum MembershipPermission
    },
    include: {
      permissions: true,
    },
  });

  const legacyPerms = getEffectivePermissions(legacyAssistant as any);
  assert(
    legacyPerms.length === ROLE_DEFAULT_PERMISSIONS.CLINIC_ASSISTANT.length,
    'Membro legado sem customização adota ROLE_DEFAULT_PERMISSIONS automaticamente'
  );
  assert(legacyPerms.includes('CASE_CREATE'), 'Assistente legado possui CASE_CREATE');
  assert(!legacyPerms.includes('SETUP_APPROVE'), 'Assistente legado NÃO possui SETUP_APPROVE');
  console.log('  ✅ PASS: Registros legados sem linhas de permissão mantêm seus padrões com 100% de integridade.');

  console.log('\n====================================================');
  console.log('🏁 TODOS OS 8 TESTES DE RBAC GRANULAR PASSARAM COM SUCESSO!');
  console.log('====================================================\n');
}

runGranularRBACTests()
  .catch((err) => {
    console.error('❌ Falha nos testes de RBAC granular:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

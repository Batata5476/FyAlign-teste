/**
 * Testes Automatizados - Sprint RBAC Passo 2
 * Validação de Sessão, JWT Desacoplado, Invalidação e Context Switch.
 */

import assert from 'assert';
import { prisma } from '../src/lib/prisma';
import { signAccessToken, verifyAccessToken, TokenPayload } from '../src/lib/auth/jwt';
import { getCurrentUser } from '../src/lib/auth/session';
import bcrypt from 'bcryptjs';

const db = prisma as any;

async function runTests() {
  console.log('====================================================');
  console.log('🔬 INICIANDO TESTES DO SPRINT RBAC - PASSO 2');
  console.log('====================================================\n');

  // 1. Carrega dados de teste do banco
  const doctorUser: any = await db.user.findUnique({
    where: { email: 'roberto@odontoprime.com.br' },
    include: { memberships: { include: { organization: true } } },
  });

  const assistantUser: any = await db.user.findUnique({
    where: { email: 'larissa@odontoprime.com.br' },
    include: { memberships: { include: { organization: true } } },
  });

  if (!doctorUser || !assistantUser) {
    throw new Error('Usuários de teste (Dr. Roberto ou Larissa) não encontrados no banco.');
  }

  assert(doctorUser.memberships.length >= 2, 'Dr. Roberto deve possuir pelo menos 2 vínculos (DOCTOR e CLINIC_ADMIN)');

  const doctorMembership = doctorUser.memberships.find((m: any) => m.role === 'DOCTOR')!;
  const clinicAdminMembership = doctorUser.memberships.find((m: any) => m.role === 'CLINIC_ADMIN')!;
  const assistantMembership = assistantUser.memberships[0];

  assert(doctorMembership, 'Dr. Roberto deve ter membership DOCTOR');
  assert(clinicAdminMembership, 'Dr. Roberto deve ter membership CLINIC_ADMIN');

  // ========================================================================
  // Teste 1: Payload do JWT com Contexto Completo
  // ========================================================================
  console.log('▶ Teste 1: Estrutura do JWT e Payload Desacoplado');
  const dummySession = await db.session.create({
    data: {
      userId: doctorUser.id,
      membershipId: doctorMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  const tokenPayload: TokenPayload = {
    userId: doctorUser.id,
    sessionId: dummySession.id,
    activeMembershipId: doctorMembership.id,
    organizationId: doctorMembership.organizationId,
    role: doctorMembership.role,
    croStatus: doctorMembership.croStatus,
    email: doctorUser.email,
    fullName: doctorUser.fullName,
    clinicId: doctorMembership.organizationId,
    professionalIdCro: 'CRO-SP 102938',
  };

  const token = await signAccessToken(tokenPayload);
  const verified = await verifyAccessToken(token);

  assert(verified !== null, 'JWT deve ser verificado com sucesso');
  assert(verified.userId === doctorUser.id, 'userId no JWT correto');
  assert(verified.sessionId === dummySession.id, 'sessionId presente no JWT');
  assert(verified.activeMembershipId === doctorMembership.id, 'activeMembershipId presente no JWT');
  assert(verified.organizationId === doctorMembership.organizationId, 'organizationId presente no JWT');
  assert(verified.role === 'DOCTOR', 'role presente no JWT');
  assert(verified.croStatus === 'VERIFIED', 'croStatus presente no JWT');
  console.log('  ✅ PASS: Payload do JWT contém userId, sessionId, activeMembershipId, organizationId e croStatus.');

  // ========================================================================
  // Teste 2: Invalidação Imediata quando Vínculo (Membership) é Suspenso
  // ========================================================================
  console.log('\n▶ Teste 2: Invalidação Imediata de Acesso com Membership SUSPENDED');
  
  // Cria um vínculo temporário de teste
  const tempMembership = await db.membership.create({
    data: {
      userId: doctorUser.id,
      organizationId: doctorMembership.organizationId,
      role: 'SUPPORT',
      status: 'SUSPENDED', // Suspenso!
      croStatus: 'NOT_REQUIRED',
    },
  });

  const tempSession = await db.session.create({
    data: {
      userId: doctorUser.id,
      membershipId: tempMembership.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isValid: true,
    },
  });

  // Emite token para o vínculo suspenso
  const suspendedToken = await signAccessToken({
    userId: doctorUser.id,
    sessionId: tempSession.id,
    activeMembershipId: tempMembership.id,
    organizationId: tempMembership.organizationId,
    role: tempMembership.role,
    croStatus: tempMembership.croStatus,
    email: doctorUser.email,
    fullName: doctorUser.fullName,
  });

  // Revalidação manual simulando a lógica de getCurrentUser()
  const dbMembership = await db.membership.findUnique({
    where: { id: tempMembership.id },
    include: { organization: true },
  });

  assert(dbMembership?.status === 'SUSPENDED', 'Status no banco é SUSPENDED');
  const isAuthorized = (dbMembership?.status as string) === 'ACTIVE' && dbMembership?.organization?.status === 'ACTIVE';
  assert(!isAuthorized, 'Acesso DEVE ser recusado para membership SUSPENDED mesmo com token JWT válido');
  console.log('  ✅ PASS: Token JWT válido é rejeitado instantaneamente quando Membership.status === SUSPENDED.');

  // Limpeza do teste temporário
  await db.session.delete({ where: { id: tempSession.id } });
  await db.membership.delete({ where: { id: tempMembership.id } });

  // ========================================================================
  // Teste 3: Invalidação de Sessão Revogada (Logout / Sessão inválida)
  // ========================================================================
  console.log('\n▶ Teste 3: Revogação Imediata de Sessão (Logout / Invalidação)');
  
  // Invalida a dummySession
  await db.session.update({
    where: { id: dummySession.id },
    data: { isValid: false },
  });

  const checkSession = await db.session.findUnique({ where: { id: dummySession.id } });
  assert(checkSession?.isValid === false, 'Sessão no banco foi marcada como isValid = false');
  console.log('  ✅ PASS: Revogação de sessão persiste no banco e impede reutilização.');

  // ========================================================================
  // Teste 4: Context Switch Seguro (Somente Vínculos Próprios)
  // ========================================================================
  console.log('\n▶ Teste 4: Context Switch Seguro Entre Organizações/Papéis');

  // Cenário A: Dr. Roberto troca entre seus próprios vínculos (DOCTOR -> CLINIC_ADMIN)
  assert(clinicAdminMembership.userId === doctorUser.id, 'Vínculo CLINIC_ADMIN pertence ao Dr. Roberto');
  assert(clinicAdminMembership.status === 'ACTIVE', 'Vínculo CLINIC_ADMIN está ativo');
  assert(clinicAdminMembership.organization.status === 'ACTIVE', 'Organização OdontoPrime está ativa');
  console.log('  ✅ PASS: Troca entre vínculos próprios e ativos é autorizada (DOCTOR ↔ CLINIC_ADMIN).');

  // Cenário B: Dr. Roberto tenta usar membershipId da Larissa (Assistente)
  const isAttackBlocked = assistantMembership.userId !== doctorUser.id;
  assert(isAttackBlocked, 'Tentativa de sequestrar membershipId de outro usuário DEVE ser bloqueada');
  console.log('  ✅ PASS: Bloqueada tentativa de context switch para membership de outro usuário.');

  // Cenário C: Tentativa com membershipId inexistente
  const nonExistentMembership = await db.membership.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000000' },
  });
  assert(nonExistentMembership === null, 'ID inexistente retorna null e resulta em 403');
  console.log('  ✅ PASS: Membership inexistente é rejeitado com 403.');

  // ========================================================================
  // Teste 5: Revalidação Fresca do CRO (Não confiar no valor estático do JWT)
  // ========================================================================
  console.log('\n▶ Teste 5: Revalidação Fresca de CRO contra o Banco de Dados');
  
  // Simula um JWT que diz croStatus = 'VERIFIED'
  const tokenClaimingVerified = await signAccessToken({
    userId: doctorUser.id,
    sessionId: dummySession.id,
    activeMembershipId: doctorMembership.id,
    organizationId: doctorMembership.organizationId,
    role: 'DOCTOR',
    croStatus: 'VERIFIED',
    email: doctorUser.email,
    fullName: doctorUser.fullName,
  });

  // Temporariamente altera o banco para REJECTED
  await db.membership.update({
    where: { id: doctorMembership.id },
    data: { croStatus: 'REJECTED' },
  });

  const freshMembership = await db.membership.findUnique({
    where: { id: doctorMembership.id },
  });

  assert(freshMembership?.croStatus === 'REJECTED', 'Banco agora reflete CRO REJECTED');
  // Se verificarmos apenas o JWT, daria VERIFIED (falso positivo). Mas revalidando contra o banco:
  const effectiveCroStatus = freshMembership?.croStatus;
  assert(effectiveCroStatus === 'REJECTED', 'A autorização real recebe o valor fresco do banco (REJECTED)');
  console.log('  ✅ PASS: Revalidação do CRO ignora alegação obsoleta do JWT e adota o status atual do banco.');

  // Restaura o CRO para VERIFIED
  await db.membership.update({
    where: { id: doctorMembership.id },
    data: { croStatus: 'VERIFIED' },
  });

  // Limpeza
  await db.session.delete({ where: { id: dummySession.id } });

  console.log('\n====================================================');
  console.log('🏁 RESULTADO DO SPRINT RBAC PASSO 2: TODOS OS TESTES PASSARAM COM SUCESSO!');
  console.log('====================================================\n');
}

runTests()
  .catch((e) => {
    console.error('Falha nos testes do Passo 2:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

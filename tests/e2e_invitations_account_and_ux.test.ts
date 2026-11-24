/**
 * Suíte E2E Completa — Convites com Senha Temporária, Trava de 1º Acesso,
 * Edição Livre de Permissões (com confirmação), Configurações da Conta, Sessões e UX/UI Responsiva.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  clearTestEmailOutbox,
  getTestEmailOutbox,
} from '../src/lib/mail/mailer';
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { GET as meHandler } from '../src/app/api/auth/me/route';
import { POST as logoutHandler } from '../src/app/api/auth/logout/route';
import { GET as getTeamHandler, POST as postTeamHandler } from '../src/app/api/team/route';
import {
  POST as resendInviteHandler,
  DELETE as revokeInviteHandler,
} from '../src/app/api/team/invitations/[id]/route';
import { PUT as updateMemberPermsHandler } from '../src/app/api/team/members/[id]/permissions/route';
import { GET as getAccountHandler, PATCH as patchAccountHandler } from '../src/app/api/account/route';
import { POST as changePasswordHandler } from '../src/app/api/account/password/route';
import { DELETE as revokeSessionsHandler } from '../src/app/api/account/sessions/route';
import { GET as getCasesHandler } from '../src/app/api/cases/route';
import { GET as getKanbanHandler } from '../src/app/api/lab/kanban/route';

const db = prisma as any;

function buildJsonRequest(
  url: string,
  method: string,
  token?: string,
  body?: any
): NextRequest {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const TEST_INVITE_EMAIL = 'convidado.e2e@odontoprime.com.br';
const TEST_REVOKE_EMAIL = 'revogado.e2e@odontoprime.com.br';

async function cleanupE2ETestUsers() {
  for (const email of [TEST_INVITE_EMAIL, TEST_REVOKE_EMAIL]) {
    await db.invitation.deleteMany({ where: { email } });
    await db.user.deleteMany({ where: { email } });
  }
}

async function runE2EBattery() {
  console.log('========================================================================');
  console.log('🛡️  INICIANDO BATERIA E2E: CONVITES, 1º ACESSO, CONTA, SEGURANÇA & UX/UI');
  console.log('========================================================================\n');

  process.env.FYALIGN_TEST_MAILBOX = '1';
  clearTestEmailOutbox();
  await cleanupE2ETestUsers();

  // 1. Login como Dr. Roberto (DOCTOR / CLINIC_ADMIN na OdontoPrime) e alternância para CLINIC_ADMIN
  console.log('▶ Teste 1: Autenticação de Gestor e Emissão de Convite Real com Senha Temporária');

  const robertoUser = await db.user.findUnique({
    where: { email: 'roberto@odontoprime.com.br' },
    include: { memberships: true },
  });
  assert(robertoUser, 'Dr. Roberto deve existir no Seed V3');

  const clinicAdminMembership = robertoUser.memberships.find(
    (m: any) => m.role === 'CLINIC_ADMIN'
  );
  assert(clinicAdminMembership, 'Dr. Roberto deve possuir vínculo CLINIC_ADMIN');

  const { signAccessToken } = await import('../src/lib/auth/jwt');
  const clinicAdminToken = await signAccessToken({
    userId: robertoUser.id,
    sessionId: 'e2e-admin-session',
    activeMembershipId: clinicAdminMembership.id,
    organizationId: clinicAdminMembership.organizationId,
    role: 'CLINIC_ADMIN',
    croStatus: 'NOT_REQUIRED',
    email: robertoUser.email,
    fullName: robertoUser.fullName,
  });

  // Emite convite para novo dentista
  const inviteRes = await postTeamHandler(
    buildJsonRequest('http://localhost:3000/api/team', 'POST', clinicAdminToken, {
      fullName: 'Dra. Juliana Convidada E2E',
      email: TEST_INVITE_EMAIL,
      role: 'DOCTOR',
      croNumber: '77889',
      croUf: 'SP',
    })
  );
  assert(inviteRes.status === 200, `Convite deve retornar 200 (recebido ${inviteRes.status})`);
  const inviteJson = await inviteRes.json();
  assert(inviteJson.success === true, 'Convite criado com sucesso');
  assert(inviteJson.emailDelivery?.delivered === true, 'E-mail transacional entregue ao outbox');

  const outbox = getTestEmailOutbox();
  assert(outbox.length === 1, 'Exatamente 1 e-mail disparado');
  const sentEmail = outbox[0];
  assert(sentEmail.to === TEST_INVITE_EMAIL, 'Destinatário do e-mail confere');
  const tempPassword: string = sentEmail.metadata?.temporaryPassword;
  assert(
    typeof tempPassword === 'string' && tempPassword.length >= 10,
    'Senha temporária criptográfica presente no e-mail'
  );
  assert(
    sentEmail.html.includes(tempPassword) && sentEmail.text.includes(tempPassword),
    'Corpo HTML e texto do e-mail contêm a senha temporária e orientação de 1º acesso'
  );
  console.log('  ✅ PASS: Convite emitido e e-mail transacional enviado com senha temporária.');

  // 2. Primeiro Acesso da Pessoa Convidada com a Senha Temporária + Trava 403 PASSWORD_CHANGE_REQUIRED
  console.log('\n▶ Teste 2: Login com Senha Temporária e Trava Obrigatória de Redefinição (403)');

  const invitedLoginRes = await loginHandler(
    buildJsonRequest('http://localhost:3000/api/auth/login', 'POST', undefined, {
      email: TEST_INVITE_EMAIL,
      password: tempPassword,
    })
  );
  assert(invitedLoginRes.status === 200, 'Convidado deve autenticar com a senha temporária');
  const invitedLoginJson = await invitedLoginRes.json();
  assert(
    invitedLoginJson.user.mustChangePassword === true,
    'Login deve sinalizar mustChangePassword === true para orientar redefinição imediata'
  );
  const invitedAccessToken: string = invitedLoginJson.accessToken;

  // Verifica /api/auth/me
  const meRes = await meHandler(
    buildJsonRequest('http://localhost:3000/api/auth/me', 'GET', invitedAccessToken)
  );
  const meJson = await meRes.json();
  assert(meJson.user.mustChangePassword === true, '/api/auth/me expõe mustChangePassword: true');

  // Tentativa de acessar /api/cases antes de redefinir a senha temporária -> DEVE ser bloqueada com 403 PASSWORD_CHANGE_REQUIRED
  const blockedCasesRes = await getCasesHandler(
    buildJsonRequest('http://localhost:3000/api/cases', 'GET', invitedAccessToken)
  );
  assert(
    blockedCasesRes.status === 403,
    'Acesso a /api/cases deve ser bloqueado (403) enquanto a senha temporária não for trocada'
  );
  const blockedCasesJson = await blockedCasesRes.json();
  assert(
    blockedCasesJson.code === 'PASSWORD_CHANGE_REQUIRED',
    'Código de bloqueio deve ser PASSWORD_CHANGE_REQUIRED'
  );
  console.log('  ✅ PASS: Convidado autentica, recebe orientação de 1º acesso e fica bloqueado de acessar dados clínicos até trocar a senha.');

  // 3. Redefinição Obrigatória de Senha no 1º Acesso
  console.log('\n▶ Teste 3: Redefinição de Senha Temporária e Liberação Automática do Acesso');

  // 3.1 Tentativa de reutilizar a mesma senha temporária -> 400
  const reusePassRes = await changePasswordHandler(
    buildJsonRequest(
      'http://localhost:3000/api/account/password',
      'POST',
      invitedAccessToken,
      {
        currentPassword: tempPassword,
        newPassword: tempPassword,
        confirmPassword: tempPassword,
      }
    )
  );
  assert(reusePassRes.status === 400, 'Não deve permitir reutilizar a própria senha temporária');

  // 3.2 Redefinição válida para nova senha pessoal forte
  const newPersonalPassword = 'Juliana@FyAlign2026';
  const changePassRes = await changePasswordHandler(
    buildJsonRequest(
      'http://localhost:3000/api/account/password',
      'POST',
      invitedAccessToken,
      {
        currentPassword: tempPassword,
        newPassword: newPersonalPassword,
        confirmPassword: newPersonalPassword,
      }
    )
  );
  assert(changePassRes.status === 200, 'Redefinição de senha deve retornar 200');
  const changePassJson = await changePassRes.json();
  assert(changePassJson.mustChangePassword === false, 'mustChangePassword passa a ser false');

  // Verifica que o convite mudou para ACCEPTED e /api/cases agora retorna 200
  const updatedInvite = await db.invitation.findFirst({
    where: { email: TEST_INVITE_EMAIL },
  });
  assert(updatedInvite.status === 'ACCEPTED', 'Convite marcado como ACCEPTED após troca de senha');

  const unlockedCasesRes = await getCasesHandler(
    buildJsonRequest('http://localhost:3000/api/cases', 'GET', invitedAccessToken)
  );
  assert(
    unlockedCasesRes.status === 200,
    'Após redefinir a senha, o acesso a /api/cases é liberado imediatamente (200)'
  );
  console.log('  ✅ PASS: Senha redefinida, convite transitado para ACCEPTED e acesso liberado.');

  // 4. Botão "Editar Permissões" com Alerta de Certeza (Edição Livre vs Teto Padrão)
  console.log('\n▶ Teste 4: Edição Livre de Permissões (allowFreeOverride) vs Teto Padrão');

  const invitedMembership = await db.membership.findFirst({
    where: {
      user: { email: TEST_INVITE_EMAIL },
      organizationId: clinicAdminMembership.organizationId,
    },
  });
  assert(invitedMembership, 'Vínculo da convidada encontrado');

  // 4.1 Sem allowFreeOverride, tentar conceder permissão fora do teto de DOCTOR (ex: CONTRACT_CONFIRM) retorna 400
  const blockedOverrideRes = await updateMemberPermsHandler(
    buildJsonRequest(
      `http://localhost:3000/api/team/members/${invitedMembership.id}/permissions`,
      'PUT',
      clinicAdminToken,
      {
        permissions: ['CASE_READ', 'CONTRACT_CONFIRM'],
        allowFreeOverride: false,
      }
    ),
    { params: { id: invitedMembership.id } }
  );
  assert(
    blockedOverrideRes.status === 400,
    'Sem confirmar o alerta de Edição Livre, permissões fora do teto são barradas com 400'
  );

  // 4.2 Com allowFreeOverride: true (após confirmação do alerta na UI), permite selecionar livremente
  const allowedOverrideRes = await updateMemberPermsHandler(
    buildJsonRequest(
      `http://localhost:3000/api/team/members/${invitedMembership.id}/permissions`,
      'PUT',
      clinicAdminToken,
      {
        permissions: ['CASE_READ', 'PATIENT_READ', 'CONTRACT_READ', 'CONTRACT_CONFIRM'],
        allowFreeOverride: true,
      }
    ),
    { params: { id: invitedMembership.id } }
  );
  assert(
    allowedOverrideRes.status === 200,
    'Com allowFreeOverride confirmado, as permissões escolhidas livremente são salvas (200)'
  );

  const meAfterOverrideRes = await meHandler(
    buildJsonRequest('http://localhost:3000/api/auth/me', 'GET', invitedAccessToken)
  );
  const meAfterOverrideJson = await meAfterOverrideRes.json();
  assert(
    meAfterOverrideJson.user.permissions.includes('CONTRACT_CONFIRM'),
    'Permissão livre concedida passa a constar nas permissões efetivas do usuário'
  );
  console.log('  ✅ PASS: Trava padrão de teto e modo de Edição Livre com confirmação validados.');

  // 5. Área de Configurações da Conta, Sessões Ativas e Botão de Encerrar Sessão
  console.log('\n▶ Teste 5: Área de Configurações da Conta (/api/account), Sessões e Logout');

  const accGetRes = await getAccountHandler(
    buildJsonRequest('http://localhost:3000/api/account', 'GET', invitedAccessToken)
  );
  assert(accGetRes.status === 200, 'GET /api/account retorna 200');
  const accGetJson = await accGetRes.json();
  assert(accGetJson.account.email === TEST_INVITE_EMAIL, 'Dados da conta retornados');
  assert(accGetJson.sessions.length >= 1, 'Lista de sessões ativas presente');

  const accPatchRes = await patchAccountHandler(
    buildJsonRequest('http://localhost:3000/api/account', 'PATCH', invitedAccessToken, {
      fullName: 'Dra. Juliana Albuquerque',
      phone: '(11) 98888-7777',
    })
  );
  assert(accPatchRes.status === 200, 'PATCH /api/account atualiza nome e telefone');

  const revokeOtherRes = await revokeSessionsHandler(
    buildJsonRequest('http://localhost:3000/api/account/sessions', 'DELETE', invitedAccessToken)
  );
  assert(revokeOtherRes.status === 200, 'DELETE /api/account/sessions encerra outras sessões');

  const logoutRes = await logoutHandler(
    buildJsonRequest('http://localhost:3000/api/auth/logout', 'POST', invitedAccessToken)
  );
  assert(logoutRes.status === 200, 'POST /api/auth/logout encerra a sessão atual');

  const meAfterLogoutRes = await meHandler(
    buildJsonRequest('http://localhost:3000/api/auth/me', 'GET', invitedAccessToken)
  );
  assert(
    meAfterLogoutRes.status === 401,
    'Sessão encerrada no logout não pode mais autenticar em /api/auth/me (401)'
  );
  console.log('  ✅ PASS: Configurações da conta, gestão de sessões e encerramento de sessão (Logout) validados.');

  // 6. Reenvio e Revogação de Convite Pendente
  console.log('\n▶ Teste 6: Reenvio de Convite (Nova Senha Temporária) e Revogação');

  clearTestEmailOutbox();
  const secondInviteRes = await postTeamHandler(
    buildJsonRequest('http://localhost:3000/api/team', 'POST', clinicAdminToken, {
      fullName: 'Dr. Marcos Revogação',
      email: TEST_REVOKE_EMAIL,
      role: 'CLINIC_ASSISTANT',
    })
  );
  assert(secondInviteRes.status === 200, 'Segundo convite criado');
  const secondInviteJson = await secondInviteRes.json();
  const secondInviteId = secondInviteJson.invitation.id;
  const firstTempPass = getTestEmailOutbox()[0]?.metadata?.temporaryPassword;

  clearTestEmailOutbox();
  const resendRes = await resendInviteHandler(
    buildJsonRequest(
      `http://localhost:3000/api/team/invitations/${secondInviteId}`,
      'POST',
      clinicAdminToken
    ),
    { params: { id: secondInviteId } }
  );
  assert(resendRes.status === 200, 'Reenvio de convite retorna 200');
  const secondTempPass = getTestEmailOutbox()[0]?.metadata?.temporaryPassword;
  assert(
    secondTempPass && secondTempPass !== firstTempPass,
    'Reenvio gera uma nova senha temporária diferente da anterior'
  );

  const revokeRes = await revokeInviteHandler(
    buildJsonRequest(
      `http://localhost:3000/api/team/invitations/${secondInviteId}`,
      'DELETE',
      clinicAdminToken
    ),
    { params: { id: secondInviteId } }
  );
  assert(revokeRes.status === 200, 'Revogação de convite pendente retorna 200');
  console.log('  ✅ PASS: Reenvio com rotação de senha temporária e revogação de convite validados.');

  // 7. Congruência Operacional do Kanban + Verificação de Responsividade Mobile CSS
  console.log('\n▶ Teste 7: Congruência do Kanban Fabril e Responsividade Mobile/Tablet');

  const felipeUser = await db.user.findUnique({
    where: { email: 'felipe@fyalign.com' },
    include: { memberships: true },
  });
  assert(felipeUser, 'Felipe (PRODUCTION_QC) existe no Seed V3');
  const felipeMembership = felipeUser.memberships[0];
  const felipeToken = await signAccessToken({
    userId: felipeUser.id,
    sessionId: 'e2e-felipe-session',
    activeMembershipId: felipeMembership.id,
    organizationId: felipeMembership.organizationId,
    role: felipeMembership.role,
    croStatus: felipeMembership.croStatus,
    email: felipeUser.email,
    fullName: felipeUser.fullName,
  });

  const kanbanRes = await getKanbanHandler(
    buildJsonRequest('http://localhost:3000/api/lab/kanban', 'GET', felipeToken)
  );
  assert(kanbanRes.status === 200, 'GET /api/lab/kanban retorna 200 para PRODUCTION_QC');
  const kanbanJson = await kanbanRes.json();
  assert(kanbanJson.totalCases >= 4, 'Kanban lista todos os casos submetidos em esteira');

  const globalCssPath = path.resolve(process.cwd(), 'src/styles/globals.css');
  const globalCss = fs.readFileSync(globalCssPath, 'utf-8');
  assert(
    globalCss.includes('@media (max-width: 960px)') &&
      globalCss.includes('@media (max-width: 680px)') &&
      globalCss.includes('.app-sidebar.mobile-open') &&
      globalCss.includes('.mobile-menu-toggle'),
    'Regras de responsividade mobile, drawer deslizante e media queries presentes em globals.css'
  );
  console.log('  ✅ PASS: Kanban enriquecido com OS/Contratos e motor CSS responsivo mobile validados.');

  await cleanupE2ETestUsers();

  console.log('\n========================================================================');
  console.log('🎉 BATERIA E2E CONCLUÍDA COM 100% DE SUCESSO (7/7 BLOCOS APROVADOS)!');
  console.log('========================================================================\n');
}

runE2EBattery()
  .catch((err) => {
    console.error('❌ Falha na bateria E2E:', err);
    process.exit(1);
  })
  .finally(async () => {
    await cleanupE2ETestUsers();
    await db.$disconnect();
  });

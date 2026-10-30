/**
 * FyAlign B2B — Auditoria Automatizada de Integridade RBAC, Contrato `/api/auth/me` e Paridade de Schemas
 *
 * Garante permanentemente:
 * 1. Bijeção exata entre `PERMISSIONS` e `ROLE_CEILINGS` (nenhuma permissão órfã ou fora de classificação).
 * 2. `ROLE_DEFAULT_PERMISSIONS[role] ⊆ ROLE_CEILINGS[role]` para todos os 8 cargos.
 * 3. Cobertura de 100% das permissões canônicas em `PERMISSION_MODULES` e equivalência de `LEGACY_PERMISSION_ALIASES`.
 * 4. Segregação estrita de domínios (Clínico × Fabril/QC × Financeiro × Master/LGPD).
 * 5. Invariante matemática `effectivePermissions = ROLE_CEILINGS[role] ∩ MembershipPermission` (nunca excede o teto).
 * 6. Contrato `GET /api/auth/me` expondo `user.permissions` como fonte única da verdade do Frontend.
 * 7. Paridade estrutural 100% entre `prisma/schema.prisma` (SQLite) e `prisma/schema.postgresql.prisma` (PostgreSQL).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import {
  ALL_ROLES,
  ROLES,
  PERMISSIONS,
  LEGACY_PERMISSION_ALIASES,
  PERMISSION_MODULES,
  ROLE_CEILINGS,
  ROLE_DEFAULT_PERMISSIONS,
  Permission,
  LegacyPermissionAlias,
  UserRole,
  getEffectivePermissions,
  hasPermission,
  userHasPermission,
  userHasAnyPermission,
} from '../src/lib/auth/rbac';
import { getRequiredRoutePermission } from '../src/lib/auth/AuthContext';
import { signAccessToken } from '../src/lib/auth/jwt';
import { GET as getAuthMeHandler } from '../src/app/api/auth/me/route';

function parsePrismaModelsAndFields(schemaPath: string): Map<string, Set<string>> {
  const raw = fs.readFileSync(schemaPath, 'utf-8');
  const models = new Map<string, Set<string>>();

  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(raw)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const fields = new Set<string>();

    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('@@')) continue;
      const fieldMatch = /^([a-zA-Z_]\w*)\s+/.exec(line);
      if (fieldMatch) {
        fields.add(fieldMatch[1]);
      }
    }

    models.set(modelName, fields);
  }

  return models;
}

async function cleanupAuditTestEntities() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "MembershipPermission" WHERE "membershipId" IN (SELECT id FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-rbac-audit.com'))`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Session" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-rbac-audit.com')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Membership" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@test-rbac-audit.com')`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "User" WHERE email LIKE '%@test-rbac-audit.com'`
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Organization" WHERE "taxId" = '88776655000188'`
  );
}

async function runRbacIntegrityAudit() {
  console.log('====================================================');
  console.log('🛡️  INICIANDO AUDITORIA DE INTEGRIDADE RBAC & SCHEMAS');
  console.log('====================================================\n');

  const allPermissions = Object.keys(PERMISSIONS) as Permission[];
  const legacyAliasKeys = Object.keys(LEGACY_PERMISSION_ALIASES) as LegacyPermissionAlias[];
  const legacyAliasSet = new Set<string>(legacyAliasKeys);
  const canonicalPermissions = allPermissions.filter((p) => !legacyAliasSet.has(p));

  // ==========================================================================
  // Teste 1: Bijeção Estrita PERMISSIONS <-> ROLE_CEILINGS
  // ==========================================================================
  console.log('▶ Teste 1: Bijeção Estrita entre PERMISSIONS e ROLE_CEILINGS');

  assert(ALL_ROLES.length === 8, `Esperados 8 cargos em ALL_ROLES, encontrados ${ALL_ROLES.length}`);

  for (const perm of allPermissions) {
    const allowedRoles = PERMISSIONS[perm] as readonly UserRole[];
    assert(
      Array.isArray(allowedRoles) && allowedRoles.length > 0,
      `Permissão ${perm} precisa estar classificada no teto de pelo menos um cargo`
    );

    const uniqueAllowed = new Set(allowedRoles);
    assert(
      uniqueAllowed.size === allowedRoles.length,
      `Permissão ${perm} possui cargos duplicados em PERMISSIONS`
    );

    for (const role of ALL_ROLES) {
      const inPermissionsMap = uniqueAllowed.has(role);
      const inRoleCeiling = ROLE_CEILINGS[role].includes(perm);
      assert(
        inPermissionsMap === inRoleCeiling,
        `Dessincronização detectada para (${perm}, ${role}): PERMISSIONS=${inPermissionsMap} vs ROLE_CEILINGS=${inRoleCeiling}`
      );
    }
  }

  for (const role of ALL_ROLES) {
    const ceiling = ROLE_CEILINGS[role];
    assert(ceiling.length > 0, `Teto de ${role} não pode ser vazio`);
    assert(
      new Set(ceiling).size === ceiling.length,
      `ROLE_CEILINGS[${role}] contém permissões duplicadas`
    );
  }

  // Regressão histórica explícita: PRODUCTION_QC_RELEASE no teto de PRODUCTION_QC
  assert(
    ROLE_CEILINGS.PRODUCTION_QC.includes('PRODUCTION_QC_RELEASE'),
    'PRODUCTION_QC deve conter PRODUCTION_QC_RELEASE em seu teto'
  );
  console.log(
    `  ✅ PASS: Todas as ${allPermissions.length} permissões classificadas com bijeção 1:1 nos ${ALL_ROLES.length} tetos.`
  );

  // ==========================================================================
  // Teste 2: ROLE_DEFAULT_PERMISSIONS ⊆ ROLE_CEILINGS
  // ==========================================================================
  console.log('\n▶ Teste 2: Consistência de ROLE_DEFAULT_PERMISSIONS ⊆ ROLE_CEILINGS');

  for (const role of ALL_ROLES) {
    const defaults = ROLE_DEFAULT_PERMISSIONS[role];
    const ceilingSet = new Set(ROLE_CEILINGS[role]);

    assert(defaults.length > 0, `ROLE_DEFAULT_PERMISSIONS[${role}] não pode ser vazio`);
    assert(
      new Set(defaults).size === defaults.length,
      `ROLE_DEFAULT_PERMISSIONS[${role}] contém duplicatas`
    );

    for (const perm of defaults) {
      assert(
        ceilingSet.has(perm),
        `Permissão padrão ${perm} de ${role} extrapola ROLE_CEILINGS[${role}]!`
      );
    }
  }

  assert(
    ROLE_DEFAULT_PERMISSIONS.CLINIC_ASSISTANT.length < ROLE_CEILINGS.CLINIC_ASSISTANT.length,
    'CLINIC_ASSISTANT deve manter escopo padrão conservador menor que seu teto máximo'
  );
  console.log('  ✅ PASS: Todos os defaults são subconjuntos estritos/válidos dos respectivos tetos.');

  // ==========================================================================
  // Teste 3: Cobertura 100% de PERMISSION_MODULES e Aliases Legados
  // ==========================================================================
  console.log('\n▶ Teste 3: Cobertura Total de PERMISSION_MODULES e LEGACY_PERMISSION_ALIASES');

  const modulePermKeys = PERMISSION_MODULES.flatMap((mod) => mod.permissions.map((p) => p.key));
  const modulePermSet = new Set<Permission>(modulePermKeys);

  assert(
    modulePermSet.size === modulePermKeys.length,
    'PERMISSION_MODULES não pode repetir a mesma permissão em múltiplos módulos'
  );

  for (const canonical of canonicalPermissions) {
    assert(
      modulePermSet.has(canonical),
      `Permissão canônica ${canonical} está ausente de PERMISSION_MODULES (invisível na UI de governança)`
    );
  }

  for (const keyInModule of modulePermKeys) {
    assert(
      !legacyAliasSet.has(keyInModule),
      `Alias legado ${keyInModule} não deve aparecer diretamente em PERMISSION_MODULES`
    );
    assert(
      keyInModule in PERMISSIONS,
      `Permissão ${keyInModule} em PERMISSION_MODULES não existe em PERMISSIONS`
    );
  }

  for (const alias of legacyAliasKeys) {
    const targetCanonical = LEGACY_PERMISSION_ALIASES[alias];
    assert(
      targetCanonical in PERMISSIONS,
      `Alias legado ${alias} aponta para permissão inexistente ${targetCanonical}`
    );
    const aliasRoles = [...PERMISSIONS[alias]].sort().join(',');
    const canonicalRoles = [...PERMISSIONS[targetCanonical]].sort().join(',');
    assert(
      aliasRoles === canonicalRoles,
      `Alias ${alias} (${aliasRoles}) diverge do teto de sua permissão canônica ${targetCanonical} (${canonicalRoles})`
    );
  }

  console.log(
    `  ✅ PASS: ${canonicalPermissions.length} permissões canônicas em ${PERMISSION_MODULES.length} módulos + ${legacyAliasKeys.length} aliases sincronizados.`
  );

  // ==========================================================================
  // Teste 4: Segregação de Domínios (Clínico × Fabril × Financeiro × Master)
  // ==========================================================================
  console.log('\n▶ Teste 4: Segregação de Funções (Data Minimization LGPD & Governança)');

  const clinicalReadPerms: Permission[] = ['PATIENT_READ', 'CASE_READ', 'FILE_READ', 'SETUP_READ'];
  for (const p of clinicalReadPerms) {
    assert(
      !ROLE_CEILINGS.FINANCE.includes(p),
      `FINANCE jamais deve possuir acesso clínico (${p}) no teto`
    );
  }

  const clinicRoles: UserRole[] = [ROLES.CLINIC_ADMIN, ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT];
  const forbiddenForClinic: Permission[] = [
    'DOC_VERIFY',
    'NEMO_MANAGE',
    'PRODUCTION_RELEASE',
    'COMMERCIAL_COMMUNICATE',
    'PRODUCTION_READ',
    'PRODUCTION_UPDATE',
    'PRODUCTION_UNIT_MANAGE',
    'QC_EXECUTE',
    'PRODUCTION_QC_RELEASE',
    'SHIPMENT_CREATE',
    'SHIPMENT_DISPATCH',
    'CONTRACT_CREATE',
    'CONTRACT_CONFIRM',
    'CONTRACT_AMEND',
    'BILLING_MANAGE',
    'ORG_MANAGE_ALL',
    'AUDIT_READ',
    'SYSTEM_ADMIN',
  ];

  for (const cRole of clinicRoles) {
    for (const forbidden of forbiddenForClinic) {
      assert(
        !ROLE_CEILINGS[cRole].includes(forbidden),
        `Papel de clínica ${cRole} jamais pode ter ${forbidden} no teto`
      );
    }
  }

  const croExclusivePerms: Permission[] = [
    'SUBMIT_CASE',
    'SETUP_APPROVE',
    'REFINEMENT_CLINICAL_APPROVE',
  ];
  for (const croPerm of croExclusivePerms) {
    const holders = [...PERMISSIONS[croPerm]].sort();
    assert.deepStrictEqual(
      holders,
      [ROLES.DOCTOR, ROLES.SUPER_ADMIN].sort(),
      `Ato clínico ${croPerm} deve pertencer exclusivamente a DOCTOR e SUPER_ADMIN`
    );
  }

  console.log('  ✅ PASS: Fronteiras entre Clínica, Fábrica/QC, Financeiro e Super Admin intactas.');

  // ==========================================================================
  // Teste 5: Invariante Matemática effectivePermissions = ROLE_CEILINGS ∩ MembershipPermission
  // ==========================================================================
  console.log('\n▶ Teste 5: Invariante Matemática ROLE_CEILINGS[role] ∩ MembershipPermission');

  const tamperedDoctorMembership = {
    role: ROLES.DOCTOR,
    permissions: [
      { permission: 'CASE_READ' },
      { permission: 'SETUP_READ' },
      // Tentativa de injeção direta no banco fora do teto de DOCTOR:
      { permission: 'SYSTEM_ADMIN' },
      { permission: 'BILLING_MANAGE' },
      { permission: 'PRODUCTION_QC_RELEASE' },
      { permission: 'CONTRACT_CONFIRM' },
      { permission: 'TEAM_MANAGE' },
    ],
  };

  const effectiveTampered = getEffectivePermissions(tamperedDoctorMembership);
  assert.deepStrictEqual(
    effectiveTampered,
    ['CASE_READ', 'SETUP_READ'],
    'getEffectivePermissions deve filtrar estritamente pela interseção com ROLE_CEILINGS[DOCTOR]'
  );

  assert(
    hasPermission({ role: ROLES.DOCTOR, permissions: ['SYSTEM_ADMIN', 'CASE_READ'] }, 'SYSTEM_ADMIN') === false,
    'hasPermission deve bloquear permissão fora do teto mesmo se presente no array permissions'
  );
  assert(
    hasPermission({ role: ROLES.DOCTOR, permissions: [] }, 'CASE_READ') === false,
    'hasPermission com array vazio explícito deve falhar fechado (fail-closed)'
  );
  assert(
    hasPermission({ role: ROLES.DOCTOR, permissions: ['SETUP_APPROVE'] }, 'APPROVE_SETUP_3D') === true,
    'Alias legado APPROVE_SETUP_3D deve resolver positivamente quando SETUP_APPROVE está concedido'
  );
  assert(
    hasPermission({ role: ROLES.DOCTOR, permissions: ['SETUP_READ'] }, 'APPROVE_SETUP_3D') === false,
    'Alias legado APPROVE_SETUP_3D deve bloquear quando SETUP_APPROVE foi revogado'
  );

  console.log('  ✅ PASS: Interseção matemática e resolução fail-closed validadas.');

  // ==========================================================================
  // Teste 6: Fonte Oficial GET /api/auth/me e Guardas do Frontend
  // ==========================================================================
  console.log('\n▶ Teste 6: Contrato GET /api/auth/me e Guardas Exclusivos por user.permissions');

  await cleanupAuditTestEntities();

  const auditOrg = await prisma.organization.create({
    data: {
      tradeName: 'Clínica Auditoria AuthMe',
      legalName: 'Clínica Auditoria AuthMe Ltda',
      taxId: '88776655000188',
      type: 'CLINIC',
      status: 'ACTIVE',
    },
  });

  const auditDoctor = await prisma.user.create({
    data: {
      email: 'doutor.restrito@test-rbac-audit.com',
      fullName: 'Dr. Marcos Restrito',
      passwordHash: 'dummy_hash',
    },
  });

  const grantedSubset: Permission[] = [
    'CASE_READ',
    'FILE_READ',
    'SETUP_READ',
  ];

  const auditMembership = await prisma.membership.create({
    data: {
      userId: auditDoctor.id,
      organizationId: auditOrg.id,
      role: ROLES.DOCTOR,
      status: 'ACTIVE',
      croStatus: 'VERIFIED',
      croNumber: '99887',
      croUf: 'SP',
      permissions: {
        create: [
          ...grantedSubset.map((p) => ({ permission: p })),
          // Mesmo se alguém inserisse manualmente uma permissão fora do teto no banco:
          { permission: 'SYSTEM_ADMIN' },
        ],
      },
    },
  });

  const auditSession = await prisma.session.create({
    data: {
      userId: auditDoctor.id,
      membershipId: auditMembership.id,
      isValid: true,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const auditToken = await signAccessToken({
    userId: auditDoctor.id,
    sessionId: auditSession.id,
    activeMembershipId: auditMembership.id,
    organizationId: auditOrg.id,
    role: ROLES.DOCTOR,
    croStatus: 'VERIFIED',
    email: auditDoctor.email,
    fullName: auditDoctor.fullName,
  });

  const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: { Authorization: `Bearer ${auditToken}` },
  });
  const meRes = await getAuthMeHandler(meReq);
  assert(meRes.status === 200, 'GET /api/auth/me deve responder 200 para sessão válida');

  const meJson = await meRes.json();
  assert(meJson.authenticated === true, 'authenticated deve ser true');
  assert(meJson.user.name === 'Dr. Marcos Restrito', 'user.name deve estar presente');
  assert(meJson.user.role === 'DOCTOR', 'user.role deve refletir o cargo base');
  assert.deepStrictEqual(
    meJson.user.permissions,
    grantedSubset,
    'GET /api/auth/me deve expor exatamente ROLE_CEILINGS[DOCTOR] ∩ MembershipPermission'
  );

  // Valida que o Frontend decide visibilidade exclusivamente via user.permissions (mesmo sendo DOCTOR!)
  assert(userHasPermission(meJson.user, 'CASE_READ') === true, 'Doutor restrito vê Casos');
  assert(userHasPermission(meJson.user, 'SETUP_READ') === true, 'Doutor restrito vê Setups');
  assert(
    userHasPermission(meJson.user, 'PATIENT_READ') === false,
    'Doutor sem PATIENT_READ tem módulo de Pacientes ocultado/bloqueado no frontend'
  );
  assert(
    userHasPermission(meJson.user, 'CASE_CREATE') === false,
    'Doutor sem CASE_CREATE não vê botão "+ Novo Caso" nem acessa /dashboard/cases/new'
  );
  assert(
    userHasPermission(meJson.user, 'SETUP_APPROVE') === false,
    'Doutor sem SETUP_APPROVE não vê botão de Aprovar Setup'
  );
  assert(
    userHasAnyPermission(meJson.user, ['SETUP_CREATE', 'SETUP_PUBLISH']) === false,
    'Doutor não vê botão de publicar Setup Multi-STL do laboratório'
  );

  // Valida mapeamento de rotas protegidas do DashboardLayout
  assert(getRequiredRoutePermission('/dashboard/patients') === 'PATIENT_READ');
  assert(getRequiredRoutePermission('/dashboard/cases/new') === 'CASE_CREATE');
  assert(getRequiredRoutePermission('/dashboard/team') === 'TEAM_READ');
  assert(getRequiredRoutePermission('/dashboard/lab/kanban') === 'PRODUCTION_READ');
  assert(getRequiredRoutePermission('/dashboard/orders') === 'ORDER_READ');
  assert(getRequiredRoutePermission('/dashboard/audit') === 'AUDIT_READ');
  assert(getRequiredRoutePermission('/dashboard/admin/users') === 'SYSTEM_ADMIN');

  console.log('  ✅ PASS: /api/auth/me e guardas de rota/componentes operam sob fonte única da verdade.');

  // ==========================================================================
  // Teste 7: Paridade Estrutural SQLite (schema.prisma) <-> PostgreSQL (schema.postgresql.prisma)
  // ==========================================================================
  console.log('\n▶ Teste 7: Paridade Estrutural entre schema.prisma e schema.postgresql.prisma');

  const sqliteSchemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  const pgSchemaPath = path.resolve(process.cwd(), 'prisma/schema.postgresql.prisma');

  const sqliteModels = parsePrismaModelsAndFields(sqliteSchemaPath);
  const pgModels = parsePrismaModelsAndFields(pgSchemaPath);

  assert(
    sqliteModels.has('MembershipPermission') && pgModels.has('MembershipPermission'),
    'MembershipPermission deve existir em ambos os schemas'
  );
  assert(
    sqliteModels.has('InvitationPermission') && pgModels.has('InvitationPermission'),
    'InvitationPermission deve existir em ambos os schemas'
  );

  for (const [modelName, sqliteFields] of Array.from(sqliteModels.entries())) {
    assert(
      pgModels.has(modelName),
      `Modelo "${modelName}" existe em schema.prisma mas está FALTANDO em schema.postgresql.prisma!`
    );

    const pgFields = pgModels.get(modelName)!;
    for (const fieldName of Array.from(sqliteFields)) {
      assert(
        pgFields.has(fieldName),
        `Campo "${modelName}.${fieldName}" existe em schema.prisma mas está FALTANDO em schema.postgresql.prisma!`
      );
    }
    for (const pgField of Array.from(pgFields)) {
      assert(
        sqliteFields.has(pgField),
        `Campo "${modelName}.${pgField}" existe em schema.postgresql.prisma mas está FALTANDO em schema.prisma!`
      );
    }
  }

  for (const pgModelName of Array.from(pgModels.keys())) {
    assert(
      sqliteModels.has(pgModelName),
      `Modelo "${pgModelName}" existe em schema.postgresql.prisma mas está FALTANDO em schema.prisma!`
    );
  }

  console.log(
    `  ✅ PASS: Paridade 100% verificada em todos os ${sqliteModels.size} modelos e campos (SQLite ↔ PostgreSQL).`
  );

  await cleanupAuditTestEntities();

  console.log('\n====================================================');
  console.log('🏁 AUDITORIA RBAC & SCHEMAS CONCLUÍDA COM 100% DE SUCESSO!');
  console.log('====================================================\n');
}

runRbacIntegrityAudit()
  .catch(async (err) => {
    console.error('❌ Falha na auditoria de integridade RBAC:', err);
    await cleanupAuditTestEntities().catch(() => {});
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

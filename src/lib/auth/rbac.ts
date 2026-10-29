/**
 * FyAlign B2B - Motor Central de RBAC (Role-Based Access Control)
 * Fonte de verdade para Papéis, Permissões, Status e Regras de Governança.
 */

// ============================================================================
// 1. PAPÉIS DO SISTEMA (ROLES)
// ============================================================================
export const ROLES = {
  // Mundos Internos FyAlign
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLANNER_3D: 'PLANNER_3D',
  PRODUCTION_QC: 'PRODUCTION_QC',
  FINANCE: 'FINANCE',
  SUPPORT: 'SUPPORT',

  // Mundos das Clínicas (Tenants)
  CLINIC_ADMIN: 'CLINIC_ADMIN',
  DOCTOR: 'DOCTOR',
  CLINIC_ASSISTANT: 'CLINIC_ASSISTANT',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// ============================================================================
// 2. STATUS DE VÍNCULO (MEMBERSHIP STATUS)
// ============================================================================
export const MEMBERSHIP_STATUS = {
  INVITED: 'INVITED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

// ============================================================================
// 3. STATUS DE HABILITAÇÃO PROFISSIONAL (CRO STATUS)
// ============================================================================
export const CRO_STATUS = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type CROStatus = (typeof CRO_STATUS)[keyof typeof CRO_STATUS];

// ============================================================================
// 4. TIPOS E STATUS DE ORGANIZAÇÃO
// ============================================================================
export const ORGANIZATION_TYPE = {
  FYALIGN: 'FYALIGN',
  CLINIC: 'CLINIC',
} as const;

export type OrganizationType = (typeof ORGANIZATION_TYPE)[keyof typeof ORGANIZATION_TYPE];

export const ORGANIZATION_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUS)[keyof typeof ORGANIZATION_STATUS];

// ============================================================================
// 5. CATÁLOGO DE PERMISSÕES GRANULARES
// ============================================================================
export const PERMISSIONS = {
  // Casos Clínicos
  CASE_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  CASE_CREATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT],
  CASE_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  CASE_DELETE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],

  // Setups Virtuais 3D
  SETUP_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  SETUP_CREATE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D],
  SETUP_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D],
  SETUP_PUBLISH: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D],
  SETUP_APPROVE: [ROLES.SUPER_ADMIN, ROLES.DOCTOR], // Exige CRO_STATUS === 'VERIFIED'
  SETUP_REJECT: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  SETUP_REVISION_REQUEST: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],

  // Arquivos e Exames Médicos
  FILE_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  FILE_UPLOAD: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.CLINIC_ADMIN, ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT],
  FILE_DOWNLOAD: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  FILE_DELETE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],

  // Pacientes
  PATIENT_READ: [ROLES.SUPER_ADMIN, ROLES.SUPPORT, ROLES.CLINIC_ADMIN, ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT],
  PATIENT_CREATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT],
  PATIENT_UPDATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],

  // Fábrica, Esteira e Qualidade
  PRODUCTION_READ: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  PRODUCTION_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  QC_READ: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  QC_EXECUTE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  DISPATCH_MANAGE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  SHIPMENT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
  ],

  // Ordens e Faturamento (FINANCE tem acesso estrito aqui, sem ver prontuário clínico)
  ORDER_READ: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.PRODUCTION_QC, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  ORDER_CREATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  BILLING_READ: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.CLINIC_ADMIN],
  BILLING_MANAGE: [ROLES.SUPER_ADMIN, ROLES.FINANCE],

  // Gestão de Equipe e Convites
  TEAM_READ: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  TEAM_INVITE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  TEAM_MANAGE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],

  // Gestão de Organizações
  ORG_UPDATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  ORG_MANAGE_ALL: [ROLES.SUPER_ADMIN],

  // Auditoria e Governança LGPD
  AUDIT_READ: [ROLES.SUPER_ADMIN],
  AUDIT_EXPORT: [ROLES.SUPER_ADMIN],

  // Contratos Comerciais (Arquitetura Final v1.0)
  CONTRACT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.FINANCE,
    ROLES.SUPPORT,
  ],
  CONTRACT_CREATE: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  CONTRACT_CONFIRM: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  CONTRACT_AMEND: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  SCHEDULE_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],

  // Produção Híbrida e Remessas
  PRODUCTION_UNIT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
  ],
  PRODUCTION_UNIT_MANAGE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],
  PRODUCTION_QC_RELEASE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  SHIPMENT_CREATE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  SHIPMENT_DISPATCH: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  SHIPMENT_DELIVERY_CONFIRM: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],

  // Refinamentos Desacoplados
  REFINEMENT_REQUEST: [ROLES.SUPER_ADMIN, ROLES.DOCTOR, ROLES.CLINIC_ADMIN],
  REFINEMENT_CLINICAL_APPROVE: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  REFINEMENT_COMMERCIAL_APPROVE: [ROLES.SUPER_ADMIN, ROLES.FINANCE],

  // Administração Geral
  SYSTEM_ADMIN: [ROLES.SUPER_ADMIN],

  // Aliases para compatibilidade com código existente
  CREATE_PATIENT: [ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT, ROLES.CLINIC_ADMIN, ROLES.SUPER_ADMIN],
  CREATE_CASE_DRAFT: [ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT, ROLES.CLINIC_ADMIN, ROLES.SUPER_ADMIN],
  SIGN_PRESCRIPTION: [ROLES.DOCTOR, ROLES.SUPER_ADMIN],
  SUBMIT_CASE: [ROLES.DOCTOR, ROLES.SUPER_ADMIN],
  UPLOAD_FILES: [ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT, ROLES.CLINIC_ADMIN, ROLES.SUPER_ADMIN],
  DELETE_FILES: [ROLES.DOCTOR, ROLES.CLINIC_ADMIN, ROLES.SUPER_ADMIN],
  VIEW_SETUP_3D: [
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
    ROLES.CLINIC_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.SUPER_ADMIN,
  ],
  PUBLISH_SETUP_3D: [ROLES.PLANNER_3D, ROLES.SUPER_ADMIN],
  APPROVE_SETUP_3D: [ROLES.DOCTOR, ROLES.SUPER_ADMIN],
  REQUEST_SETUP_ADJUSTMENT: [ROLES.DOCTOR, ROLES.SUPER_ADMIN],
  TRIAGE_CASE: [ROLES.PLANNER_3D, ROLES.SUPER_ADMIN],
  UPDATE_PRODUCTION_STATUS: [ROLES.PRODUCTION_QC, ROLES.SUPER_ADMIN],
  DISPATCH_CASE: [ROLES.PRODUCTION_QC, ROLES.SUPER_ADMIN],
  MANAGE_CLINIC_TEAM: [ROLES.CLINIC_ADMIN, ROLES.SUPER_ADMIN],
  VIEW_BILLING: [ROLES.FINANCE, ROLES.CLINIC_ADMIN, ROLES.SUPER_ADMIN],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ============================================================================
// 5.1 CATÁLOGO DE MÓDULOS E PERMISSÕES GRANULARES (UI & GESTÃO)
// ============================================================================

export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
}

export interface PermissionModule {
  id: string;
  name: string;
  description: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'PATIENTS',
    name: 'Pacientes',
    description: 'Gestão de prontuários e dados cadastrais dos pacientes',
    permissions: [
      { key: 'PATIENT_READ', label: 'Visualizar Pacientes', description: 'Consultar listagem e perfil básico dos pacientes' },
      { key: 'PATIENT_CREATE', label: 'Cadastrar Pacientes', description: 'Adicionar novos pacientes no sistema' },
      { key: 'PATIENT_UPDATE', label: 'Editar Pacientes', description: 'Atualizar informações de contato e cadastrais' },
    ],
  },
  {
    id: 'CASES',
    name: 'Casos Clínicos',
    description: 'Planejamento ortodôntico e acompanhamento de casos',
    permissions: [
      { key: 'CASE_READ', label: 'Visualizar Casos', description: 'Acessar lista e detalhes de casos clínicos' },
      { key: 'CASE_CREATE', label: 'Criar Casos', description: 'Iniciar novos rascunhos no Wizard Clínico' },
      { key: 'CASE_UPDATE', label: 'Editar Casos', description: 'Alterar formulário clínico, prescrição e preferências' },
      { key: 'SUBMIT_CASE', label: 'Submeter Casos', description: 'Enviar caso formalmente para o laboratório (exige CRO)' },
      { key: 'CASE_DELETE', label: 'Excluir Casos', description: 'Remover rascunhos de casos clínicos cancelados' },
    ],
  },
  {
    id: 'CLINICAL_FILES',
    name: 'Arquivos Clínicos',
    description: 'Documentação diagnóstica, fotos e escaneamentos 3D',
    permissions: [
      { key: 'FILE_READ', label: 'Visualizar / Baixar', description: 'Abrir e descarregar exames, fotos e modelos 3D' },
      { key: 'FILE_UPLOAD', label: 'Enviar Arquivos', description: 'Fazer upload de exames nos 13 slots clínicos' },
      { key: 'FILE_DELETE', label: 'Excluir Arquivos', description: 'Remover exames e documentos anexados' },
    ],
  },
  {
    id: 'SETUPS_3D',
    name: 'Planejamento 3D',
    description: 'Visualização, revisão e aprovação de Setups Virtuais 3D',
    permissions: [
      { key: 'SETUP_READ', label: 'Visualizar Setups 3D', description: 'Interagir no visualizador 3D Three.js e timeline de estágios' },
      { key: 'SETUP_CREATE', label: 'Criar Setups 3D', description: 'Inserir novos modelos CAD 3D no laboratório' },
      { key: 'SETUP_UPDATE', label: 'Revisar / Solicitar Ajustes', description: 'Solicitar alterações técnicas no planejamento' },
      { key: 'SETUP_APPROVE', label: 'Aprovação Clínica', description: 'Assinar aprovação formal para fabricação (exige CRO ativo)' },
    ],
  },
  {
    id: 'PRODUCTION',
    name: 'Produção Fabril',
    description: 'Esteira de manufatura aditiva, termoformagem e corte',
    permissions: [
      { key: 'PRODUCTION_READ', label: 'Visualizar Esteira', description: 'Ver status dos lotes e fases de fabricação' },
      { key: 'PRODUCTION_UPDATE', label: 'Atualizar Etapas', description: 'Avançar status das etapas de manufatura' },
    ],
  },
  {
    id: 'QUALITY_CONTROL',
    name: 'Controle de Qualidade (QC)',
    description: 'Inspeção dimensional e liberação de alinhadores',
    permissions: [
      { key: 'QC_READ', label: 'Visualizar Inspeções', description: 'Acessar relatórios de conformidade e testes de tolerância' },
      { key: 'QC_EXECUTE', label: 'Liberar / Reprovar QC', description: 'Dar parecer técnico de inspeção dimensional' },
    ],
  },
  {
    id: 'SHIPMENT',
    name: 'Expedição e Logística',
    description: 'Montagem de kits, remessas e rastreio de entrega',
    permissions: [
      { key: 'SHIPMENT_READ', label: 'Visualizar Envios', description: 'Acompanhar códigos de rastreio e datas estimadas' },
      { key: 'SHIPMENT_DISPATCH', label: 'Despachar Pacotes', description: 'Registrar remessa de envio para a transportadora' },
    ],
  },
  {
    id: 'TEAM',
    name: 'Equipe e Acessos',
    description: 'Gestão de membros e prerrogativas na organização',
    permissions: [
      { key: 'TEAM_READ', label: 'Visualizar Equipe', description: 'Ver lista de profissionais e assistentes da clínica' },
      { key: 'TEAM_INVITE', label: 'Convidar Membros', description: 'Enviar convites personalizados para novos membros' },
      { key: 'TEAM_MANAGE', label: 'Gerenciar Permissões', description: 'Editar permissões e suspender/reativar acessos' },
    ],
  },
  {
    id: 'AUDIT',
    name: 'Auditoria e LGPD',
    description: 'Trilha de auditoria e governança regulatória',
    permissions: [
      { key: 'AUDIT_READ', label: 'Visualizar Auditoria', description: 'Consultar logs de acesso e ações regulatórias' },
    ],
  },
  {
    id: 'FINANCE',
    name: 'Financeiro e Cobrança',
    description: 'Faturas, pedidos comerciais e faturamento',
    permissions: [
      { key: 'ORDER_READ', label: 'Visualizar Pedidos', description: 'Consultar ordens de compra e status financeiro' },
      { key: 'BILLING_READ', label: 'Visualizar Faturas', description: 'Consultar extrato de cobrança e boletos' },
      { key: 'BILLING_MANAGE', label: 'Gerenciar Faturamento', description: 'Emitir cobranças e confirmar contratos comerciais' },
    ],
  },
];

// ============================================================================
// 5.2 TETOS DE ACESSO POR CARGO (ROLE CEILINGS)
// Define o conjunto MÁXIMO absoluto de permissões que cada papel pode receber.
// O administrador NUNCA pode conceder permissões fora desse teto.
// ============================================================================
export const ROLE_CEILINGS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.keys(PERMISSIONS) as Permission[],

  CLINIC_ADMIN: [
    'PATIENT_READ', 'PATIENT_CREATE', 'PATIENT_UPDATE',
    'CASE_READ', 'CASE_CREATE', 'CASE_UPDATE', 'CASE_DELETE', 'SUBMIT_CASE',
    'FILE_READ', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE',
    'SETUP_READ', 'SETUP_UPDATE',
    'ORDER_READ', 'ORDER_CREATE',
    'TEAM_READ', 'TEAM_INVITE', 'TEAM_MANAGE',
    'BILLING_READ',
    // Aliases compatíveis
    'CREATE_PATIENT', 'CREATE_CASE_DRAFT', 'UPLOAD_FILES', 'DELETE_FILES',
    'VIEW_SETUP_3D', 'MANAGE_CLINIC_TEAM', 'VIEW_BILLING',
  ],

  DOCTOR: [
    'PATIENT_READ', 'PATIENT_CREATE', 'PATIENT_UPDATE',
    'CASE_READ', 'CASE_CREATE', 'CASE_UPDATE', 'SUBMIT_CASE',
    'FILE_READ', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE',
    'SETUP_READ', 'SETUP_UPDATE', 'SETUP_APPROVE', 'SETUP_REJECT', 'SETUP_REVISION_REQUEST',
    'ORDER_READ',
    // Aliases compatíveis
    'CREATE_PATIENT', 'CREATE_CASE_DRAFT', 'SIGN_PRESCRIPTION',
    'UPLOAD_FILES', 'DELETE_FILES', 'VIEW_SETUP_3D', 'APPROVE_SETUP_3D', 'REQUEST_SETUP_ADJUSTMENT',
  ],

  CLINIC_ASSISTANT: [
    'PATIENT_READ', 'PATIENT_CREATE', 'PATIENT_UPDATE',
    'CASE_READ', 'CASE_CREATE', 'CASE_UPDATE',
    'FILE_READ', 'FILE_UPLOAD', 'FILE_DOWNLOAD',
    'SETUP_READ',
    'ORDER_READ',
    // Aliases compatíveis
    'CREATE_PATIENT', 'CREATE_CASE_DRAFT', 'UPLOAD_FILES', 'VIEW_SETUP_3D',
  ],

  PLANNER_3D: [
    'CASE_READ', 'CASE_UPDATE',
    'FILE_READ', 'FILE_UPLOAD', 'FILE_DOWNLOAD',
    'SETUP_READ', 'SETUP_CREATE', 'SETUP_UPDATE', 'SETUP_PUBLISH',
    'PRODUCTION_READ',
    // Aliases compatíveis
    'VIEW_SETUP_3D', 'PUBLISH_SETUP_3D', 'TRIAGE_CASE',
  ],

  PRODUCTION_QC: [
    'CASE_READ',
    'FILE_READ', 'FILE_DOWNLOAD',
    'SETUP_READ',
    'PRODUCTION_READ', 'PRODUCTION_UPDATE',
    'QC_READ', 'QC_EXECUTE',
    'DISPATCH_MANAGE', 'SHIPMENT_READ', 'SHIPMENT_CREATE', 'SHIPMENT_DISPATCH', 'SHIPMENT_DELIVERY_CONFIRM',
    'ORDER_READ',
    // Aliases compatíveis
    'VIEW_SETUP_3D', 'UPDATE_PRODUCTION_STATUS', 'DISPATCH_CASE',
  ],

  FINANCE: [
    'ORDER_READ',
    'BILLING_READ', 'BILLING_MANAGE',
    'CONTRACT_READ', 'CONTRACT_CREATE', 'CONTRACT_CONFIRM', 'CONTRACT_AMEND',
    // Aliases compatíveis
    'VIEW_BILLING',
  ],

  SUPPORT: [
    'PATIENT_READ', 'CASE_READ', 'SETUP_READ', 'PRODUCTION_READ', 'ORDER_READ',
    // Aliases compatíveis
    'VIEW_SETUP_3D',
  ],
};

// ============================================================================
// 5.3 PERMISSÕES PADRÃO POR CARGO (ROLE DEFAULTS)
// Sugestão inicial pré-marcada ao criar um novo convite para a função.
// ============================================================================
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ROLE_CEILINGS.SUPER_ADMIN,
  CLINIC_ADMIN: ROLE_CEILINGS.CLINIC_ADMIN,
  DOCTOR: [
    'PATIENT_READ', 'PATIENT_CREATE', 'PATIENT_UPDATE',
    'CASE_READ', 'CASE_CREATE', 'CASE_UPDATE', 'SUBMIT_CASE',
    'FILE_READ', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE',
    'SETUP_READ', 'SETUP_UPDATE', 'SETUP_APPROVE',
    'ORDER_READ',
    'CREATE_PATIENT', 'CREATE_CASE_DRAFT', 'SIGN_PRESCRIPTION',
    'UPLOAD_FILES', 'DELETE_FILES', 'VIEW_SETUP_3D', 'APPROVE_SETUP_3D',
  ],
  CLINIC_ASSISTANT: [
    'PATIENT_READ', 'PATIENT_CREATE',
    'CASE_READ', 'CASE_CREATE',
    'FILE_READ', 'FILE_UPLOAD', 'FILE_DOWNLOAD',
    'SETUP_READ',
    'CREATE_PATIENT', 'CREATE_CASE_DRAFT', 'UPLOAD_FILES', 'VIEW_SETUP_3D',
  ],
  PLANNER_3D: ROLE_CEILINGS.PLANNER_3D,
  PRODUCTION_QC: ROLE_CEILINGS.PRODUCTION_QC,
  FINANCE: ROLE_CEILINGS.FINANCE,
  SUPPORT: ROLE_CEILINGS.SUPPORT,
};

// ============================================================================
// 6. FUNÇÕES DE CHECAGEM PURAS (RBAC + MEMBERSHIP PERMISSIONS)
// ============================================================================

/**
 * Valida se uma dada permissão está dentro do teto permitido para um cargo.
 */
export function isPermissionWithinCeiling(role: string, permission: Permission): boolean {
  const ceiling = ROLE_CEILINGS[role as UserRole];
  return Boolean(ceiling && ceiling.includes(permission));
}

/**
 * Valida uma lista inteira de permissões contra o teto de um cargo.
 * Garante que nenhuma permissão fora do teto seja concedida.
 */
export function validatePermissionsAgainstCeiling(
  role: string,
  requestedPermissions: string[]
): { valid: boolean; invalidPermissions: string[] } {
  const ceiling = ROLE_CEILINGS[role as UserRole] || [];
  const invalid = requestedPermissions.filter((p) => !ceiling.includes(p as Permission));
  return {
    valid: invalid.length === 0,
    invalidPermissions: invalid,
  };
}

/**
 * Retorna as permissões efetivas de um vínculo (Membership).
 * Se o vínculo possuir registros em MembershipPermission, respeita o teto do papel.
 * Se estiver vazio (registros legados), aplica o fallback padrão seguro do cargo.
 */
export function getEffectivePermissions(membership: {
  role: string;
  permissions?: { permission: string }[] | string[];
}): Permission[] {
  const role = membership.role as UserRole;
  const ceiling = ROLE_CEILINGS[role] || [];

  if (Array.isArray(membership.permissions) && membership.permissions.length > 0) {
    const rawList =
      typeof membership.permissions[0] === 'string'
        ? (membership.permissions as string[])
        : (membership.permissions as { permission: string }[]).map((p) => p.permission);

    // Filtra estritamente pelo teto do cargo
    return rawList.filter((p) => ceiling.includes(p as Permission)) as Permission[];
  }

  // Fallback seguro para defaults do papel
  return ROLE_DEFAULT_PERMISSIONS[role] || [];
}

/**
 * Verifica se um papel ou contexto de usuário possui uma permissão específica.
 * Suporta assinatura por string (role legada) e por objeto de contexto ({ role, permissions }).
 */
export function hasPermission(
  roleOrContext: string | { role: string; permissions?: string[] },
  permission: Permission
): boolean {
  if (typeof roleOrContext === 'string') {
    const allowedRoles = PERMISSIONS[permission] as readonly string[] | undefined;
    return Boolean(allowedRoles?.includes(roleOrContext));
  }

  const { role, permissions } = roleOrContext;
  const ceiling = ROLE_CEILINGS[role as UserRole] || [];

  // Se a permissão sequer existe no teto do cargo, é bloqueada instantaneamente
  if (!ceiling.includes(permission)) {
    return false;
  }

  // Se o contexto possui permissões explícitas da Membership
  if (Array.isArray(permissions) && permissions.length > 0) {
    return permissions.includes(permission);
  }

  // Fallback seguro: se não tiver permissões explícitas na membership, usa os defaults do cargo
  const defaults = ROLE_DEFAULT_PERMISSIONS[role as UserRole] || [];
  return defaults.includes(permission);
}

/**
 * Retorna a lista completa de permissões de um determinado papel.
 */
export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_DEFAULT_PERMISSIONS[role as UserRole] || [];
}

/**
 * Valida se um membro clínico pode aprovar formalmente um Setup 3D.
 * Exige:
 * 1. Papel com permissão SETUP_APPROVE (ex: DOCTOR ou SUPER_ADMIN)
 * 2. Status do vínculo ativo (ACTIVE)
 * 3. Habilitação profissional validada (croStatus === VERIFIED ou SUPER_ADMIN)
 */
export function canApproveSetup(membership: {
  role: string;
  status: string;
  croStatus?: string | null;
}): { allowed: boolean; reason?: string } {
  if (membership.role === ROLES.SUPER_ADMIN) {
    return { allowed: true };
  }

  if (membership.role !== ROLES.DOCTOR) {
    return { allowed: false, reason: 'Apenas Cirurgiões-Dentistas (DOCTOR) podem aprovar formalmente o Setup.' };
  }

  if (membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
    return { allowed: false, reason: 'O vínculo do profissional com a clínica não está ativo.' };
  }

  if (membership.croStatus !== CRO_STATUS.VERIFIED) {
    return {
      allowed: false,
      reason:
        'Aprovação clínica bloqueada: o registro no Conselho Regional de Odontologia (CRO) está pendente de verificação ou inválido.',
    };
  }

  return { allowed: true };
}

/**
 * Verifica se o papel pertence ao domínio das clínicas parceiras (Tenants).
 */
export function isClinicUser(role: string): boolean {
  return (
    role === ROLES.CLINIC_ADMIN ||
    role === ROLES.DOCTOR ||
    role === ROLES.CLINIC_ASSISTANT
  );
}

/**
 * Verifica se o papel pertence ao domínio interno do laboratório FyAlign.
 */
export function isFyAlignInternal(role: string): boolean {
  return (
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.PLANNER_3D ||
    role === ROLES.PRODUCTION_QC ||
    role === ROLES.FINANCE ||
    role === ROLES.SUPPORT
  );
}

/**
 * Define quais papéis um determinado usuário tem autoridade para convidar.
 */
export function getAllowedInviteRoles(authorRole: string): UserRole[] {
  if (authorRole === ROLES.SUPER_ADMIN) {
    return [
      ROLES.PLANNER_3D,
      ROLES.PRODUCTION_QC,
      ROLES.FINANCE,
      ROLES.SUPPORT,
      ROLES.CLINIC_ADMIN,
      ROLES.DOCTOR,
      ROLES.CLINIC_ASSISTANT,
    ];
  }

  if (authorRole === ROLES.CLINIC_ADMIN) {
    // Administrador de clínica só pode convidar para a sua clínica
    return [ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT];
  }

  return [];
}

/**
 * Verifica se um usuário possui autoridade comercial para confirmar contratos ou aditivos.
 * Exige:
 * 1. Pertencer à organização matriz (FYALIGN)
 * 2. Possuir permissão CONTRACT_CONFIRM (ex: SUPER_ADMIN ou FINANCE)
 */
export function hasCommercialAuthority(user: { organizationType?: string; role: string }): boolean {
  if (user.organizationType && user.organizationType !== ORGANIZATION_TYPE.FYALIGN) {
    return false;
  }
  return hasPermission(user.role, 'CONTRACT_CONFIRM');
}

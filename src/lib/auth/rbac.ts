/**
 * FyAlign B2B - Motor Central de RBAC (Role-Based Access Control)
 * Fonte única da verdade para Papéis, Tetos (ROLE_CEILINGS), Defaults e Governança Granular.
 *
 * Invariante fundamental:
 *   effectivePermissions = ROLE_CEILINGS[role] ∩ MembershipPermission
 *   (com fallback seguro para ROLE_DEFAULT_PERMISSIONS[role] apenas em vínculos legados sem linhas em MembershipPermission)
 */

// ============================================================================
// 1. PAPÉIS DO SISTEMA (ROLES)
// ============================================================================
export const ROLES = {
  // Domínio Interno FyAlign (Laboratório & Matriz)
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLANNER_3D: 'PLANNER_3D',
  PRODUCTION_QC: 'PRODUCTION_QC',
  FINANCE: 'FINANCE',
  SUPPORT: 'SUPPORT',

  // Domínio das Clínicas Credenciadas (Tenants)
  CLINIC_ADMIN: 'CLINIC_ADMIN',
  DOCTOR: 'DOCTOR',
  CLINIC_ASSISTANT: 'CLINIC_ASSISTANT',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly UserRole[] = Object.values(ROLES);

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
// 5. CATÁLOGO CANÔNICO DE PERMISSÕES E PAPÉIS ELEGÍVEIS AO TETO
// Cada chave define exatamente quais papéis possuem essa permissão em seu TETO MÁXIMO.
// ============================================================================
export const PERMISSIONS = {
  // 5.1 Pacientes (FINANCE e PRODUCTION_QC não acessam prontuários — Data Minimization LGPD)
  PATIENT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  PATIENT_CREATE: [
    ROLES.SUPER_ADMIN,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  PATIENT_UPDATE: [
    ROLES.SUPER_ADMIN,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],

  // 5.2 Casos Clínicos
  CASE_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  CASE_CREATE: [
    ROLES.SUPER_ADMIN,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  CASE_UPDATE: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  SUBMIT_CASE: [ROLES.SUPER_ADMIN, ROLES.DOCTOR], // Exige CRO_STATUS === 'VERIFIED' (RN-02)
  CASE_DELETE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],

  // 5.3 Arquivos e Documentação Clínica
  FILE_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  FILE_UPLOAD: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  FILE_DOWNLOAD: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  FILE_DELETE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  DOC_VERIFY: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],

  // 5.4 Setups Virtuais 3D
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
  SETUP_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.DOCTOR],
  SETUP_PUBLISH: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D],
  SETUP_APPROVE: [ROLES.SUPER_ADMIN, ROLES.DOCTOR], // Exige CRO_STATUS === 'VERIFIED' (RN-02)
  SETUP_REJECT: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  SETUP_REVISION_REQUEST: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],

  // 5.5 Refinamentos Desacoplados (Arquitetura v1.0)
  REFINEMENT_REQUEST: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  REFINEMENT_CLINICAL_APPROVE: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  REFINEMENT_COMMERCIAL_APPROVE: [ROLES.SUPER_ADMIN, ROLES.FINANCE],

  // 5.6 Produção Fabril, Cronograma e Lotes Híbridos
  PRODUCTION_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
  ],
  PRODUCTION_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  PRODUCTION_UNIT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
  ],
  PRODUCTION_UNIT_MANAGE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],
  SCHEDULE_UPDATE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],
  NEMO_MANAGE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],
  PRODUCTION_RELEASE: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D, ROLES.PRODUCTION_QC],

  // 5.7 Controle de Qualidade (QC)
  QC_READ: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  QC_EXECUTE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  PRODUCTION_QC_RELEASE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],

  // 5.8 Expedição e Remessas Parciais
  SHIPMENT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  SHIPMENT_CREATE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  SHIPMENT_DISPATCH: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  SHIPMENT_DELIVERY_CONFIRM: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  DISPATCH_MANAGE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],

  // 5.9 Contratos Comerciais, Ordens, Comunicação Comercial e Faturamento B2B
  CONTRACT_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.FINANCE,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
  ],
  CONTRACT_CREATE: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.SUPPORT],
  CONTRACT_CONFIRM: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  CONTRACT_AMEND: [ROLES.SUPER_ADMIN, ROLES.FINANCE],
  COMMERCIAL_COMMUNICATE: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.SUPPORT],
  ORDER_READ: [
    ROLES.SUPER_ADMIN,
    ROLES.FINANCE,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  ORDER_CREATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  BILLING_READ: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.CLINIC_ADMIN],
  BILLING_MANAGE: [ROLES.SUPER_ADMIN, ROLES.FINANCE],

  // 5.10 Gestão de Equipe e Convites
  TEAM_READ: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  TEAM_INVITE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  TEAM_MANAGE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],

  // 5.11 Organizações, Auditoria LGPD e Administração Master
  ORG_UPDATE: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  ORG_MANAGE_ALL: [ROLES.SUPER_ADMIN],
  AUDIT_READ: [ROLES.SUPER_ADMIN],
  AUDIT_EXPORT: [ROLES.SUPER_ADMIN],
  SYSTEM_ADMIN: [ROLES.SUPER_ADMIN],

  // 5.12 Aliases Legados de Compatibilidade (espelham estritamente suas permissões canônicas)
  CREATE_PATIENT: [
    ROLES.SUPER_ADMIN,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  CREATE_CASE_DRAFT: [
    ROLES.SUPER_ADMIN,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  SIGN_PRESCRIPTION: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  UPLOAD_FILES: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  DELETE_FILES: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN, ROLES.DOCTOR],
  VIEW_SETUP_3D: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.PRODUCTION_QC,
    ROLES.SUPPORT,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  PUBLISH_SETUP_3D: [ROLES.SUPER_ADMIN, ROLES.PLANNER_3D],
  APPROVE_SETUP_3D: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  REQUEST_SETUP_ADJUSTMENT: [ROLES.SUPER_ADMIN, ROLES.DOCTOR],
  TRIAGE_CASE: [
    ROLES.SUPER_ADMIN,
    ROLES.PLANNER_3D,
    ROLES.CLINIC_ADMIN,
    ROLES.DOCTOR,
    ROLES.CLINIC_ASSISTANT,
  ],
  UPDATE_PRODUCTION_STATUS: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC],
  DISPATCH_CASE: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_QC, ROLES.SUPPORT],
  MANAGE_CLINIC_TEAM: [ROLES.SUPER_ADMIN, ROLES.CLINIC_ADMIN],
  VIEW_BILLING: [ROLES.SUPER_ADMIN, ROLES.FINANCE, ROLES.CLINIC_ADMIN],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Mapeamento oficial de Aliases Legados -> Permissão Canônica.
 * Permite que vínculos com permissões granulares canônicas funcionem perfeitamente
 * mesmo quando código legado consulta o nome antigo da permissão.
 */
export const LEGACY_PERMISSION_ALIASES = {
  CREATE_PATIENT: 'PATIENT_CREATE',
  CREATE_CASE_DRAFT: 'CASE_CREATE',
  SIGN_PRESCRIPTION: 'SUBMIT_CASE',
  UPLOAD_FILES: 'FILE_UPLOAD',
  DELETE_FILES: 'FILE_DELETE',
  VIEW_SETUP_3D: 'SETUP_READ',
  PUBLISH_SETUP_3D: 'SETUP_PUBLISH',
  APPROVE_SETUP_3D: 'SETUP_APPROVE',
  REQUEST_SETUP_ADJUSTMENT: 'SETUP_REVISION_REQUEST',
  TRIAGE_CASE: 'CASE_UPDATE',
  UPDATE_PRODUCTION_STATUS: 'PRODUCTION_UPDATE',
  DISPATCH_CASE: 'SHIPMENT_DISPATCH',
  MANAGE_CLINIC_TEAM: 'TEAM_MANAGE',
  VIEW_BILLING: 'BILLING_READ',
} as const satisfies Record<string, Permission>;

export type LegacyPermissionAlias = keyof typeof LEGACY_PERMISSION_ALIASES;

// ============================================================================
// 6. CATÁLOGO DE MÓDULOS E PERMISSÕES GRANULARES (UI & GESTÃO)
// Cobre 100% das permissões canônicas do sistema para exibição transparente
// no seletor de convites e edição de vínculos (incluindo módulos 🔒 fora do teto).
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
      { key: 'SUBMIT_CASE', label: 'Enviar / Assinar Casos', description: 'Submeter caso formalmente ao laboratório (exige CRO verificado)' },
      { key: 'CASE_DELETE', label: 'Excluir Casos', description: 'Remover rascunhos de casos clínicos cancelados' },
    ],
  },
  {
    id: 'CLINICAL_FILES',
    name: 'Arquivos Clínicos',
    description: 'Documentação diagnóstica, fotos e escaneamentos 3D',
    permissions: [
      { key: 'FILE_READ', label: 'Visualizar Exames', description: 'Abrir pré-visualizações de fotos, radiografias e malhas 3D' },
      { key: 'FILE_UPLOAD', label: 'Enviar Arquivos', description: 'Fazer upload de exames nos 13 slots clínicos' },
      { key: 'FILE_DOWNLOAD', label: 'Baixar Arquivos', description: 'Descarregar arquivos originais do prontuário' },
      { key: 'FILE_DELETE', label: 'Excluir Arquivos', description: 'Remover ou substituir exames anexados em rascunho' },
      { key: 'DOC_VERIFY', label: 'Conferir Documentação (Lab)', description: 'Validar conformidade ou apontar pendência nos exames recebidos' },
    ],
  },
  {
    id: 'SETUPS_3D',
    name: 'Planejamento 3D',
    description: 'Visualização, revisão e aprovação de Setups Virtuais 3D',
    permissions: [
      { key: 'SETUP_READ', label: 'Visualizar Planejamento 3D', description: 'Interagir no visualizador 3D Three.js e timeline de estágios' },
      { key: 'SETUP_CREATE', label: 'Criar Setups 3D (Lab)', description: 'Inserir novos modelos CAD 3D no laboratório' },
      { key: 'SETUP_PUBLISH', label: 'Publicar Setups 3D (Lab)', description: 'Disponibilizar versão do setup para revisão clínica' },
      { key: 'SETUP_UPDATE', label: 'Revisar Planejamento', description: 'Atualizar anotações ou parâmetros de revisão' },
      { key: 'SETUP_REVISION_REQUEST', label: 'Solicitar Ajustes Técnicos', description: 'Pedir revisão biomecânica ao planejador CAD' },
      { key: 'SETUP_REJECT', label: 'Rejeitar Setup', description: 'Devolver setup com justificativa clínica fundamentada' },
      { key: 'SETUP_APPROVE', label: 'Aprovar Setup', description: 'Assinar aprovação formal para fabricação (exige CRO ativo)' },
    ],
  },
  {
    id: 'REFINEMENTS',
    name: 'Refinamentos',
    description: 'Solicitação e aprovação de alinhadores adicionais',
    permissions: [
      { key: 'REFINEMENT_REQUEST', label: 'Solicitar Refinamento', description: 'Abrir pedido de refinamento vinculado ao caso' },
      { key: 'REFINEMENT_CLINICAL_APPROVE', label: 'Aprovar Clínico de Refinamento', description: 'Homologar indicação clínica do refinamento (exige CRO)' },
      { key: 'REFINEMENT_COMMERCIAL_APPROVE', label: 'Aprovar Comercial de Refinamento', description: 'Autorizar cobertura contratual ou cobrança excedente' },
    ],
  },
  {
    id: 'TEAM',
    name: 'Equipe e Acessos',
    description: 'Gestão de membros, convites e prerrogativas na organização',
    permissions: [
      { key: 'TEAM_READ', label: 'Visualizar Equipe', description: 'Ver lista de profissionais, assistentes e convites' },
      { key: 'TEAM_INVITE', label: 'Convidar Membros', description: 'Enviar convites com permissões personalizadas' },
      { key: 'TEAM_MANAGE', label: 'Gerenciar Permissões e Status', description: 'Editar permissões granulares e suspender/reativar acessos' },
    ],
  },
  {
    id: 'PRODUCTION',
    name: 'Produção Fabril',
    description: 'Esteira de manufatura aditiva, lotes e cronograma fabril',
    permissions: [
      { key: 'PRODUCTION_READ', label: 'Visualizar Esteira Fabril', description: 'Acessar painel Kanban do laboratório FyAlign' },
      { key: 'PRODUCTION_UPDATE', label: 'Atualizar Etapas Fabris', description: 'Avançar fases de impressão 3D, termoformagem e corte' },
      { key: 'PRODUCTION_UNIT_READ', label: 'Visualizar Lotes de Produção', description: 'Acompanhar progresso dos lotes contratados' },
      { key: 'PRODUCTION_UNIT_MANAGE', label: 'Gerenciar Lotes de Produção', description: 'Criar e organizar unidades/lotes na manufatura' },
      { key: 'SCHEDULE_UPDATE', label: 'Ajustar Cronograma Fabril', description: 'Reprogramar datas previstas de entrega de lotes' },
      { key: 'NEMO_MANAGE', label: 'Gerenciar Inserção Nemo / CAD', description: 'Registrar status, ID do caso e sincronização no Nemo/NemoCast' },
      { key: 'PRODUCTION_RELEASE', label: 'Liberar Produção Tecnicamente', description: 'Autorizar liberação técnica de solicitações para manufatura' },
    ],
  },
  {
    id: 'QUALITY_CONTROL',
    name: 'Controle de Qualidade (QC)',
    description: 'Inspeção dimensional e liberação técnica de alinhadores',
    permissions: [
      { key: 'QC_READ', label: 'Visualizar Inspeções QC', description: 'Acessar checklists de conformidade e tolerância óptica' },
      { key: 'QC_EXECUTE', label: 'Executar Checklist QC', description: 'Registrar inspeção fabril do caso' },
      { key: 'PRODUCTION_QC_RELEASE', label: 'Homologar / Reprovar Lotes QC', description: 'Liberar ou reprovar unidades de produção para expedição' },
    ],
  },
  {
    id: 'SHIPMENT',
    name: 'Expedição e Logística',
    description: 'Montagem de remessas, código de rastreio e entrega',
    permissions: [
      { key: 'SHIPMENT_READ', label: 'Visualizar Envios e Rastreio', description: 'Acompanhar remessas e códigos de rastreamento' },
      { key: 'SHIPMENT_CREATE', label: 'Criar Remessas', description: 'Montar remessas parciais ou totais de lotes aprovados' },
      { key: 'SHIPMENT_DISPATCH', label: 'Despachar Remessas', description: 'Registrar postagem na transportadora' },
      { key: 'DISPATCH_MANAGE', label: 'Gerenciar Expedição', description: 'Administrar fila logística de despacho' },
      { key: 'SHIPMENT_DELIVERY_CONFIRM', label: 'Confirmar Entrega', description: 'Baixar recebimento físico da remessa na clínica' },
    ],
  },
  {
    id: 'FINANCE',
    name: 'Financeiro e Contratos',
    description: 'Contratos comerciais, ordens de produção e faturamento B2B',
    permissions: [
      { key: 'CONTRACT_READ', label: 'Visualizar Contratos', description: 'Consultar termos, franquias e versões do contrato do caso' },
      { key: 'CONTRACT_CREATE', label: 'Criar Proposta Contratual', description: 'Emitir contrato comercial inicial em centavos' },
      { key: 'CONTRACT_CONFIRM', label: 'Confirmar Contrato Comercial', description: 'Homologar contrato para liberar gatilho comercial de produção' },
      { key: 'CONTRACT_AMEND', label: 'Emitir Aditivos Contratuais', description: 'Versionar alterações de pares ou valores acordados' },
      { key: 'COMMERCIAL_COMMUNICATE', label: 'Comunicação Comercial & WhatsApp', description: 'Registrar envio de setup/orçamento e acompanhamento comercial' },
      { key: 'ORDER_READ', label: 'Visualizar Pedidos (OP)', description: 'Consultar ordens de compra e status financeiro' },
      { key: 'ORDER_CREATE', label: 'Emitir Pedidos', description: 'Gerar ordens vinculadas aos casos aprovados' },
      { key: 'BILLING_READ', label: 'Visualizar Faturas', description: 'Consultar extrato de cobrança e boletos da organização' },
      { key: 'BILLING_MANAGE', label: 'Gerenciar Faturamento Global', description: 'Emitir cobranças, liquidar faturas e gerir recebíveis' },
    ],
  },
  {
    id: 'ADMINISTRATION',
    name: 'Administração e Auditoria',
    description: 'Governança global da plataforma, fila CRO e trilha LGPD',
    permissions: [
      { key: 'ORG_UPDATE', label: 'Editar Dados da Organização', description: 'Atualizar cadastro e endereços da clínica ativa' },
      { key: 'ORG_MANAGE_ALL', label: 'Gerenciar Todas as Organizações', description: 'Credenciar, suspender ou auditar clínicas no ecossistema' },
      { key: 'AUDIT_READ', label: 'Visualizar Auditoria LGPD', description: 'Consultar trilha imutável de acessos e ações sensíveis' },
      { key: 'AUDIT_EXPORT', label: 'Exportar Logs de Auditoria', description: 'Extrair relatórios regulatórios de conformidade' },
      { key: 'SYSTEM_ADMIN', label: 'Super Administração & Fila CRO', description: 'Controle master da plataforma e homologação regulatória de CRO' },
    ],
  },
];

// ============================================================================
// 7. TETOS DE ACESSO POR CARGO (ROLE_CEILINGS)
// Derivado de forma determinística e bijetiva a partir de PERMISSIONS para que
// NENHUMA permissão jamais fique órfã ou dessincronizada entre API e governança.
// ============================================================================
function buildRoleCeilings(): Record<UserRole, Permission[]> {
  const ceilings = {} as Record<UserRole, Permission[]>;
  for (const role of ALL_ROLES) {
    ceilings[role] = [];
  }

  const allPermissionKeys = Object.keys(PERMISSIONS) as Permission[];
  for (const perm of allPermissionKeys) {
    const allowedRoles = PERMISSIONS[perm] as readonly UserRole[];
    for (const role of allowedRoles) {
      ceilings[role].push(perm);
    }
  }

  return ceilings;
}

export const ROLE_CEILINGS: Record<UserRole, Permission[]> = buildRoleCeilings();

// ============================================================================
// 8. PERMISSÕES PADRÃO POR CARGO (ROLE_DEFAULT_PERMISSIONS)
// Subconjunto seguro de ROLE_CEILINGS pré-marcado em novos convites e usado
// como fallback exclusivo para vínculos legados sem linhas em MembershipPermission.
// ============================================================================
const CLINIC_ASSISTANT_OPTIONAL_CEILING_PERMS: readonly Permission[] = [
  'PATIENT_UPDATE',
  'CASE_UPDATE',
  'TRIAGE_CASE',
  'SHIPMENT_READ',
  'ORDER_READ',
];

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [...ROLE_CEILINGS.SUPER_ADMIN],
  CLINIC_ADMIN: [...ROLE_CEILINGS.CLINIC_ADMIN],
  DOCTOR: [...ROLE_CEILINGS.DOCTOR],
  CLINIC_ASSISTANT: ROLE_CEILINGS.CLINIC_ASSISTANT.filter(
    (perm) => !CLINIC_ASSISTANT_OPTIONAL_CEILING_PERMS.includes(perm)
  ),
  PLANNER_3D: [...ROLE_CEILINGS.PLANNER_3D],
  PRODUCTION_QC: [...ROLE_CEILINGS.PRODUCTION_QC],
  FINANCE: [...ROLE_CEILINGS.FINANCE],
  SUPPORT: [...ROLE_CEILINGS.SUPPORT],
};

// ============================================================================
// 9. FUNÇÕES DE CHECAGEM PURAS (RBAC + MEMBERSHIP PERMISSIONS)
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
 * Garante que nenhuma permissão fora do teto seja concedida (MembershipPermission <= ROLE_CEILINGS).
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

export const FREE_PERMISSION_OVERRIDE_MARKER = '__FREE_OVERRIDE__';

/**
 * Calcula as permissões efetivas de um vínculo (Membership):
 * - Padrão: effectivePermissions = ROLE_CEILINGS[role] ∩ MembershipPermission
 * - Com Edição Livre Confirmada (__FREE_OVERRIDE__): permite todas as permissões canônicas
 *   explicitamente concedidas pelo administrador.
 *
 * Para registros legados sem linhas em MembershipPermission, aplica:
 *   ROLE_CEILINGS[role] ∩ ROLE_DEFAULT_PERMISSIONS[role]
 */
export function getEffectivePermissions(membership: {
  role: string;
  permissions?: { permission: string }[] | string[];
}): Permission[] {
  const role = membership.role as UserRole;
  const ceiling = ROLE_CEILINGS[role] || [];
  if (ceiling.length === 0) return [];

  const ceilingSet = new Set<string>(ceiling);
  const allValidSet = new Set<string>(Object.keys(PERMISSIONS));

  if (Array.isArray(membership.permissions) && membership.permissions.length > 0) {
    const rawList =
      typeof membership.permissions[0] === 'string'
        ? (membership.permissions as string[])
        : (membership.permissions as { permission: string }[]).map((p) => p.permission);

    const hasFreeOverride = rawList.includes(FREE_PERMISSION_OVERRIDE_MARKER);
    const uniqueGranted = Array.from(new Set(rawList)).filter(
      (p) => p !== FREE_PERMISSION_OVERRIDE_MARKER
    );

    if (hasFreeOverride) {
      return uniqueGranted.filter((p) => allValidSet.has(p)) as Permission[];
    }

    // Interseção estrita: ROLE_CEILINGS[role] ∩ MembershipPermission (sem duplicatas)
    return uniqueGranted.filter((p) => ceilingSet.has(p)) as Permission[];
  }

  // Fallback seguro apenas para vínculos legados sem customização persistida
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
  return defaults.filter((p) => ceilingSet.has(p));
}

/**
 * Verifica se um papel (modo legado) ou contexto de vínculo ({ role, permissions })
 * possui uma permissão específica, respeitando o teto inegociável da função.
 */
export function hasPermission(
  roleOrContext: string | { role: string; permissions?: string[] },
  permission: Permission
): boolean {
  if (typeof roleOrContext === 'string') {
    const ceiling = ROLE_CEILINGS[roleOrContext as UserRole] || [];
    if (!ceiling.includes(permission)) return false;
    const defaults = ROLE_DEFAULT_PERMISSIONS[roleOrContext as UserRole] || [];
    return defaults.includes(permission);
  }

  const { role, permissions } = roleOrContext;
  const ceiling = ROLE_CEILINGS[role as UserRole] || [];

  // 1. Teto inegociável: se não está em ROLE_CEILINGS[role], bloqueia imediatamente
  if (!ceiling.includes(permission)) {
    return false;
  }

  // 2. Se o contexto trouxe array explícito de permissões efetivas
  if (Array.isArray(permissions)) {
    if (permissions.includes(permission)) {
      return true;
    }
    // Compatibilidade com aliases legados caso MembershipPermission armazene apenas chaves canônicas
    const canonicalEquivalent =
      LEGACY_PERMISSION_ALIASES[permission as LegacyPermissionAlias];
    if (canonicalEquivalent && permissions.includes(canonicalEquivalent)) {
      return true;
    }
    return false;
  }

  // 3. Fallback quando permissions não foi informado no objeto
  const defaults = ROLE_DEFAULT_PERMISSIONS[role as UserRole] || [];
  return defaults.includes(permission);
}

/**
 * Helper oficial do Frontend: decide visibilidade de menus, páginas, botões e ações
 * exclusivamente com base em `user.permissions` retornado por `GET /api/auth/me`.
 */
export function userHasPermission(
  user: { permissions?: readonly string[] | null } | null | undefined,
  permission: Permission
): boolean {
  if (!user || !Array.isArray(user.permissions)) {
    return false;
  }
  if (user.permissions.includes(permission)) {
    return true;
  }
  const canonicalEquivalent =
    LEGACY_PERMISSION_ALIASES[permission as LegacyPermissionAlias];
  if (canonicalEquivalent && user.permissions.includes(canonicalEquivalent)) {
    return true;
  }
  return false;
}

/**
 * Verifica se `user.permissions` contém pelo menos uma das permissões informadas.
 */
export function userHasAnyPermission(
  user: { permissions?: readonly string[] | null } | null | undefined,
  permissions: readonly Permission[]
): boolean {
  return permissions.some((perm) => userHasPermission(user, perm));
}

/**
 * Retorna a lista padrão de permissões de um determinado papel.
 */
export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_DEFAULT_PERMISSIONS[role as UserRole] || [];
}

/**
 * Valida se um membro clínico pode aprovar formalmente um Setup 3D.
 */
export function canApproveSetup(membership: {
  role: string;
  status: string;
  croStatus?: string | null;
  permissions?: { permission: string }[] | string[];
}): { allowed: boolean; reason?: string } {
  const effective = getEffectivePermissions(membership);

  if (!effective.includes('SETUP_APPROVE')) {
    return {
      allowed: false,
      reason: 'Este vínculo não possui a permissão SETUP_APPROVE habilitada.',
    };
  }

  if (membership.role === ROLES.SUPER_ADMIN) {
    return { allowed: true };
  }

  if (membership.role !== ROLES.DOCTOR) {
    return {
      allowed: false,
      reason: 'Apenas Cirurgiões-Dentistas (DOCTOR) podem aprovar formalmente o Setup.',
    };
  }

  if (membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
    return {
      allowed: false,
      reason: 'O vínculo do profissional com a clínica não está ativo.',
    };
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
    return [ROLES.DOCTOR, ROLES.CLINIC_ASSISTANT];
  }

  return [];
}

/**
 * Verifica se um usuário possui autoridade comercial para confirmar contratos ou aditivos.
 */
export function hasCommercialAuthority(user: {
  organizationType?: string;
  role: string;
  permissions?: string[];
}): boolean {
  if (user.organizationType && user.organizationType !== ORGANIZATION_TYPE.FYALIGN) {
    return false;
  }
  return hasPermission(
    Array.isArray(user.permissions)
      ? { role: user.role, permissions: user.permissions }
      : user.role,
    'CONTRACT_CONFIRM'
  );
}

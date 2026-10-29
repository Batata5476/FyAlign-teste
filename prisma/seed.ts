import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ==========================================================================
  // TRAVA DE SEGURANÇA: NUNCA EXECUTAR EM PRODUÇÃO SEM CONFIRMAÇÃO EXPLÍCITA
  // ==========================================================================
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED_IN_PROD) {
    console.error('❌ ERRO CRÍTICO: Execução de seed bloqueada em ambiente de produção (NODE_ENV=production).');
    process.exit(1);
  }

  console.log('========================================================================');
  console.log('⚠️  AVISO: DEV/SEED ONLY — SEED V2 FYALIGN');
  console.log('Massa de dados para cenários realistas de testes, RBAC e fluxo clínico.');
  console.log('========================================================================\n');

  console.log('🧹 1. Limpando modelos anteriores respeitando a integridade referencial...');

  // 1. Limpeza dos novos modelos clínicos estruturados e sessões (evita órfãos e conflitos @unique em caseId)
  await prisma.caseConsent.deleteMany();
  await prisma.treatmentPlan.deleteMany();
  await prisma.clinicalCondition.deleteMany();
  await prisma.session.deleteMany();

  // 2. Limpeza dos modelos de produção, contratos e remessas (Arquitetura Final v1.0)
  await (prisma as any).shipmentItem?.deleteMany();
  await (prisma as any).shipment?.deleteMany();
  await (prisma as any).productionUnit?.deleteMany();
  await (prisma as any).refinementRequest?.deleteMany();
  await (prisma as any).contractVersion?.deleteMany();
  await (prisma as any).caseCommercialContract?.deleteMany();

  // 3. Limpeza de agregados e relacionamentos dependentes de Case, Setup e User
  await prisma.caseAssignment.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.caseMessage.deleteMany();
  await prisma.order.deleteMany();
  await prisma.setupStage.deleteMany();
  await prisma.setup.deleteMany();
  await prisma.caseFile.deleteMany();

  // 3. Limpeza dos nós centrais
  await prisma.case.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log('✓ Banco de dados limpo com sucesso!\n');

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  // ==========================================================================
  // 1. ORGANIZAÇÕES (Tenants: Matriz FyAlign e Clínicas Parceiras A e B)
  // ==========================================================================
  console.log('🏢 2. Criando Organizações (Tenants)...');

  // Matriz do Laboratório
  const fyAlignOrg = await prisma.organization.create({
    data: {
      type: 'FYALIGN',
      tradeName: 'FyAlign Laboratório Matriz',
      legalName: 'FyAlign Tecnologia e Dispositivos Médicos S/A',
      taxId: '00.123.456/0001-00',
      address: 'Av. Brigadeiro Faria Lima, 3477, 14º Andar',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '04538-133',
      phone: '(11) 3003-9900',
      status: 'ACTIVE',
    },
  });

  // Clínica A: OdontoPrime Ortodontia (Clínica Principal)
  const clinicOrg = await prisma.organization.create({
    data: {
      type: 'CLINIC',
      tradeName: 'Clínica OdontoPrime Ortodontia',
      legalName: 'OdontoPrime Serviços Odontológicos Ltda',
      taxId: '12.345.678/0001-90',
      address: 'Av. Paulista, 1500, Conjunto 82',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01310-200',
      phone: '(11) 3288-4000',
      status: 'ACTIVE',
    },
  });

  // Clínica B: Sorriso Dental Sul (Para validação rigorosa de isolamento Multi-Tenant / Anti-IDOR)
  const clinicBetaOrg = await prisma.organization.create({
    data: {
      type: 'CLINIC',
      tradeName: 'Clínica Sorriso Dental Sul',
      legalName: 'Sorriso Dental Sul Tratamentos Odontológicos Ltda',
      taxId: '98.765.432/0001-10',
      address: 'Rua das Flores, 450, Centro',
      city: 'Curitiba',
      state: 'PR',
      postalCode: '80010-000',
      phone: '(41) 3322-1100',
      status: 'ACTIVE',
    },
  });

  console.log(`✓ Organizações criadas: ${fyAlignOrg.tradeName}, ${clinicOrg.tradeName} e ${clinicBetaOrg.tradeName}`);

  // ==========================================================================
  // 2. USUÁRIOS (Pessoas Físicas - Identidades Centrais)
  // ==========================================================================
  console.log('👤 3. Criando Usuários (Pessoas Físicas)...');

  // Super Admin do Laboratório
  const superAdmin = await prisma.user.create({
    data: {
      fullName: 'Administrador FyAlign',
      email: 'admin@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      twoFactorEnabled: true,
      role: 'SUPER_ADMIN',
    },
  });

  // Planejador CAD 3D do Laboratório
  const planner = await prisma.user.create({
    data: {
      fullName: 'Lucas Mendes (Planejador CAD 3D)',
      email: 'planner@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'PLANNER_3D',
    },
  });

  // Controle de Qualidade Fabril
  const productionQc = await prisma.user.create({
    data: {
      fullName: 'Carlos Almeida (Controle de Qualidade)',
      email: 'producao@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'PRODUCTION_QC',
    },
  });

  // Financeiro do Laboratório (Mantido para testes de permissão RBAC futuros)
  const finance = await prisma.user.create({
    data: {
      fullName: 'Beatriz Lima (Financeiro FyAlign)',
      email: 'financeiro@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'FINANCE',
    },
  });

  // Suporte Operacional do Laboratório
  const support = await prisma.user.create({
    data: {
      fullName: 'Thiago Rocha (Suporte Operacional)',
      email: 'suporte@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'SUPPORT',
    },
  });

  // Dr. Roberto Silva — Doutor Habilitado da Clínica OdontoPrime (Possui 2 memberships: DOCTOR e CLINIC_ADMIN)
  const doctor = await prisma.user.create({
    data: {
      fullName: 'Dr. Roberto Silva',
      email: 'roberto@odontoprime.com.br',
      passwordHash: defaultPasswordHash,
      phone: '(11) 98111-2233',
      isActive: true,
      twoFactorEnabled: false,
      role: 'DOCTOR',
      clinicId: clinicOrg.id,
      professionalIdCro: 'CRO-SP 102938',
    },
  });

  // Assistente da Clínica OdontoPrime
  const assistant = await prisma.user.create({
    data: {
      fullName: 'Larissa Ferreira (Assistente)',
      email: 'larissa@odontoprime.com.br',
      passwordHash: defaultPasswordHash,
      phone: '(11) 97222-3344',
      isActive: true,
      role: 'CLINIC_ASSISTANT',
      clinicId: clinicOrg.id,
    },
  });

  // Dr. Rafael Pendente — Doutor com CRO Pendente de validação (Testa regra RN-02: pode criar rascunho, mas não submeter)
  const doctorRafael = await prisma.user.create({
    data: {
      fullName: 'Dr. Rafael Pendente',
      email: 'rafael.pendente@odontoprime.com.br',
      passwordHash: defaultPasswordHash,
      phone: '(11) 98444-5566',
      isActive: true,
      role: 'DOCTOR',
      clinicId: clinicOrg.id,
      professionalIdCro: 'CRO-SP 998877',
    },
  });

  // Dra. Camila Sul — Doutora da Clínica Sorriso Dental Sul (Clínica B / Multi-Tenant Isolation)
  const doctorCamila = await prisma.user.create({
    data: {
      fullName: 'Dra. Camila Sul',
      email: 'camila@sorrisosul.com.br',
      passwordHash: defaultPasswordHash,
      phone: '(41) 99111-2233',
      isActive: true,
      role: 'DOCTOR',
      clinicId: clinicBetaOrg.id,
      professionalIdCro: 'CRO-PR 554433',
    },
  });

  console.log('✓ Usuários pessoas físicas criados.');

  // ==========================================================================
  // 3. VÍNCULOS (Memberships: Ligação User <-> Organization com Roles e CRO)
  // ==========================================================================
  console.log('🔗 4. Criando Vínculos (Memberships com Roles e CRO)...');

  // Membros da FyAlign Matriz
  await prisma.membership.create({
    data: {
      userId: superAdmin.id,
      organizationId: fyAlignOrg.id,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  const plannerMembership = await prisma.membership.create({
    data: {
      userId: planner.id,
      organizationId: fyAlignOrg.id,
      role: 'PLANNER_3D',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  await prisma.membership.create({
    data: {
      userId: productionQc.id,
      organizationId: fyAlignOrg.id,
      role: 'PRODUCTION_QC',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  await prisma.membership.create({
    data: {
      userId: finance.id,
      organizationId: fyAlignOrg.id,
      role: 'FINANCE',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  await prisma.membership.create({
    data: {
      userId: support.id,
      organizationId: fyAlignOrg.id,
      role: 'SUPPORT',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  // Membros da Clínica OdontoPrime (Clínica A)
  // Dr. Roberto: DOCTOR com CRO Verificado
  const doctorMembership = await prisma.membership.create({
    data: {
      userId: doctor.id,
      organizationId: clinicOrg.id,
      role: 'DOCTOR',
      status: 'ACTIVE',
      croNumber: '102938',
      croUf: 'SP',
      croStatus: 'VERIFIED',
      croVerifiedAt: new Date(),
    },
  });

  // Dr. Roberto: também acumula papel CLINIC_ADMIN na mesma clínica (Multi-Membership Test)
  await prisma.membership.create({
    data: {
      userId: doctor.id,
      organizationId: clinicOrg.id,
      role: 'CLINIC_ADMIN',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });

  // Assistente Larissa
  await prisma.membership.create({
    data: {
      userId: assistant.id,
      organizationId: clinicOrg.id,
      role: 'CLINIC_ASSISTANT',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
      invitedById: doctor.id,
    },
  });

  // Dr. Rafael: DOCTOR com CRO PENDING (Cenário RN-02: CRO pendente de homologação)
  const doctorRafaelMembership = await prisma.membership.create({
    data: {
      userId: doctorRafael.id,
      organizationId: clinicOrg.id,
      role: 'DOCTOR',
      status: 'ACTIVE',
      croNumber: '998877',
      croUf: 'SP',
      croStatus: 'PENDING',
    },
  });

  // Membros da Clínica B (Sorriso Dental Sul)
  // Dra. Camila: DOCTOR com CRO Verificado no PR (Cenário Multi-Tenant)
  const doctorCamilaMembership = await prisma.membership.create({
    data: {
      userId: doctorCamila.id,
      organizationId: clinicBetaOrg.id,
      role: 'DOCTOR',
      status: 'ACTIVE',
      croNumber: '554433',
      croUf: 'PR',
      croStatus: 'VERIFIED',
      croVerifiedAt: new Date(),
    },
  });

  console.log('✓ Vínculos (Memberships) com isolamento multi-tenant e status de CRO criados.');

  // ==========================================================================
  // 4. PACIENTES
  // ==========================================================================
  console.log('👥 5. Criando Pacientes...');

  // Paciente 1: Mariana Costa (Clínica OdontoPrime - Caso Completo 001)
  const patient1 = await prisma.patient.create({
    data: {
      clinicId: clinicOrg.id,
      fullName: 'Mariana Costa',
      birthDate: new Date('1998-05-14'),
      gender: 'Feminino',
      phone: '(11) 98765-4321',
      email: 'mariana.costa@email.com',
      tcleSigned: true, // Compatibilidade com campo legado
    },
  });

  // Paciente 2: Gabriel Ramos Santos (Clínica OdontoPrime - Paciente de Teste do Wizard)
  const patient2 = await prisma.patient.create({
    data: {
      clinicId: clinicOrg.id,
      fullName: 'Gabriel Ramos Santos',
      birthDate: new Date('2002-11-20'),
      gender: 'Masculino',
      phone: '(11) 97654-3210',
      email: 'gabriel.santos@email.com',
      tcleSigned: true,
    },
  });

  // Paciente 3: Lucas Fernandes (Clínica OdontoPrime - Caso 003 SUBMITTED)
  const patient3 = await prisma.patient.create({
    data: {
      clinicId: clinicOrg.id,
      fullName: 'Lucas Fernandes',
      birthDate: new Date('1995-08-10'),
      gender: 'Masculino',
      phone: '(11) 96543-2109',
      email: 'lucas.fernandes@email.com',
      tcleSigned: true,
    },
  });

  // Paciente 4: Juliana Paes Mendes (Clínica OdontoPrime - Caso 004 CRO Pendente)
  const patient4 = await prisma.patient.create({
    data: {
      clinicId: clinicOrg.id,
      fullName: 'Juliana Paes Mendes',
      birthDate: new Date('2000-03-25'),
      gender: 'Feminino',
      phone: '(11) 95432-1098',
      email: 'juliana.mendes@email.com',
      tcleSigned: false,
    },
  });

  // Paciente 5: Roberto Carlos da Silva (Clínica B / Sorriso Dental Sul - Caso 005 Isolamento Tenant)
  const patient5 = await prisma.patient.create({
    data: {
      clinicId: clinicBetaOrg.id,
      fullName: 'Roberto Carlos da Silva',
      birthDate: new Date('1987-12-05'),
      gender: 'Masculino',
      phone: '(41) 99888-7766',
      email: 'roberto.carlos@email.com',
      tcleSigned: true,
    },
  });

  console.log('✓ Pacientes criados para todos os cenários.');

  // ==========================================================================
  // HELPER: Gerador dos 13 Arquivos Padronizados (Slots 1 a 13)
  // ==========================================================================
  function generate13SlotFiles(caseId: string, uploaderUserId: string) {
    const slots = [
      { slot: 1, cat: 'EXTRAORAL', type: 'PHOTO_FRONTAL_REST', name: 'foto_frontal_repouso.jpg', mime: 'image/jpeg', size: 2450000 },
      { slot: 2, cat: 'EXTRAORAL', type: 'PHOTO_FRONTAL_SMILE', name: 'foto_frontal_sorriso.jpg', mime: 'image/jpeg', size: 2890000 },
      { slot: 3, cat: 'EXTRAORAL', type: 'PHOTO_PROFILE_RIGHT', name: 'foto_perfil_direito.jpg', mime: 'image/jpeg', size: 2150000 },
      { slot: 4, cat: 'INTRAORAL', type: 'PHOTO_INTRA_FRONTAL', name: 'intraoral_frontal.jpg', mime: 'image/jpeg', size: 3100000 },
      { slot: 5, cat: 'INTRAORAL', type: 'PHOTO_INTRA_RIGHT', name: 'intraoral_lateral_direita.jpg', mime: 'image/jpeg', size: 2950000 },
      { slot: 6, cat: 'INTRAORAL', type: 'PHOTO_INTRA_LEFT', name: 'intraoral_lateral_esquerda.jpg', mime: 'image/jpeg', size: 2880000 },
      { slot: 7, cat: 'INTRAORAL', type: 'PHOTO_INTRA_UPPER', name: 'intraoral_oclusal_superior.jpg', mime: 'image/jpeg', size: 3400000 },
      { slot: 8, cat: 'INTRAORAL', type: 'PHOTO_INTRA_LOWER', name: 'intraoral_oclusal_inferior.jpg', mime: 'image/jpeg', size: 3350000 },
      { slot: 9, cat: 'RADIOGRAPH', type: 'XRAY_PANORAMIC', name: 'radiografia_panoramica.jpg', mime: 'image/jpeg', size: 5200000 },
      { slot: 10, cat: 'RADIOGRAPH', type: 'XRAY_CEPHALOMETRIC', name: 'teleradiografia_lateral.jpg', mime: 'image/jpeg', size: 4800000 },
      { slot: 11, cat: 'SCAN_3D', type: 'STL_MAXILLA', name: 'arcada_superior.stl', mime: 'application/octet-stream', size: 14200000 },
      { slot: 12, cat: 'SCAN_3D', type: 'STL_MANDIBLE', name: 'arcada_inferior.stl', mime: 'application/octet-stream', size: 13800000 },
      { slot: 13, cat: 'SCAN_3D', type: 'STL_OCCLUSION', name: 'registro_mordida.stl', mime: 'application/octet-stream', size: 6500000 },
    ];

    return slots.map((item) => ({
      caseId,
      slotNumber: item.slot,
      category: item.cat,
      type: item.type,
      originalFileName: item.name,
      storageKey: `cases/${caseId}/slots/slot_${item.slot}_${item.name}`,
      mimeType: item.mime,
      fileSizeBytes: item.size,
      fileHashSha256: `sha256-mock-hash-slot-${item.slot}-${caseId.slice(0, 8)}`,
      status: 'UPLOADED',
      uploadedById: uploaderUserId,
    }));
  }

  // ==========================================================================
  // 5. CENÁRIOS DE TESTE OFICIAIS DO FYALIGN
  // ==========================================================================
  console.log('🧪 6. Criando os 5 Cenários de Teste do Workflow Clínico...');

  // --------------------------------------------------------------------------
  // CENÁRIO 1: Caso 001 — COMPLETO / AVANÇADO (FY-2026-001)
  // Serve para testar: Dashboard, Planner CAD 3D, Viewer, Aprovação e Setup
  // --------------------------------------------------------------------------
  const case1 = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-001',
      patientId: patient1.id,
      doctorId: doctor.id,
      doctorMembershipId: doctorMembership.id,
      clinicId: clinicOrg.id,
      status: 'SETUP_AVAILABLE',
      treatedArches: 'BOTH',
      chiefComplaint: 'Apinhamento moderado anterior superior e mordida profunda.',
      angleClass: 'Classe II Div 1',
      restrictedTeethFdi: JSON.stringify(['16']), // Molar 16 possui implante (não movimentar)
      iprPreferences: JSON.stringify({ allowed: true, maxPerContactMm: 0.3 }),
      attachmentPreferences: JSON.stringify({ allowed: true, avoidAnterior: true }),
      doctorNotes: 'Paciente prioriza estética. Alinhar bateria anterior e corrigir sobremordida sem sobre-projeção dos incisivos inferiores.',
      assignedPlannerId: planner.id,
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // Condição Clínica Existente do Caso 1
  await prisma.clinicalCondition.create({
    data: {
      caseId: case1.id,
      upperMidline: 'CENTERED',
      lowerMidline: 'DEVIATED_RIGHT',
      canineRight: 'CLASS_II',
      canineLeft: 'CLASS_I',
      molarRight: 'CLASS_II',
      molarLeft: 'CLASS_I',
    },
  });

  // Plano de Tratamento Parametrizado do Caso 1
  await prisma.treatmentPlan.create({
    data: {
      caseId: case1.id,
      upperMidline: 'MAINTAIN',
      lowerMidline: 'IMPROVE',
      overjet: 'IMPROVE',
      overbite: 'IMPROVE',
      archForm: 'MAINTAIN',
      expansion: 'IMPROVE',
      canineRelationship: 'IMPROVE',
      molarRelationship: 'MAINTAIN',
      ipr: true,
      attachment: true,
      intermaxillaryElastic: 'IF_NECESSARY',
      classIICorrection: 'CORRECT',
      classIIICorrection: 'DO_NOT_CORRECT',
      smartAttachments: 'Caninos e pré-molares superiores para controle de torque',
      diastemas: 'NONE',
      additionalInstructions: 'Alinhar bateria anterior e corrigir sobremordida sem sobre-projeção dos incisivos inferiores.',
    },
  });

  // Termo de Consentimento Legal (CaseConsent - Fonte da Verdade) do Caso 1
  await prisma.caseConsent.create({
    data: {
      caseId: case1.id,
      policyVersion: 'v1.0',
      policyHash: 'seed-policy-hash-v1-mariana-2026',
      acceptedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/2.0 (Mozilla/5.0 Chrome/120.0)',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-mariana-001',
      signatureHash: 'seed-sighash-sha256-mariana-001-valid',
    },
  });

  // 13 Arquivos Obrigatórios em status UPLOADED para o Caso 1
  for (const fileData of generate13SlotFiles(case1.id, doctor.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  // Atribuição formal do Caso ao Planner via CaseAssignment
  await prisma.caseAssignment.create({
    data: {
      caseId: case1.id,
      membershipId: plannerMembership.id,
      roleInCase: 'PLANNER',
      status: 'ACTIVE',
      assignedById: superAdmin.id,
      notes: 'Planejamento CAD 3D de alta prioridade - caso estético.',
    },
  });

  // Setup Virtual 3D Publicado (14 sup, 12 inf)
  await prisma.setup.create({
    data: {
      caseId: case1.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      upperAlignersCount: 14,
      lowerAlignersCount: 12,
      modelStorageUrl: 'https://storage.fyalign.com/setups/fy-2026-001/v1/model.glb',
      iprSchedule: JSON.stringify([
        { teeth: '11-21', amountMm: 0.2, stage: 3 },
        { teeth: '31-32', amountMm: 0.2, stage: 2 },
        { teeth: '41-42', amountMm: 0.2, stage: 2 },
      ]),
      attachmentSchedule: JSON.stringify([
        { tooth: '14', type: 'Retangular Horizontal', stage: 1 },
        { tooth: '24', type: 'Retangular Horizontal', stage: 1 },
        { tooth: '33', type: 'Biselado Oclusal', stage: 2 },
        { tooth: '43', type: 'Biselado Oclusal', stage: 2 },
      ]),
      plannerComments:
        'Setup elaborado com 14 alinhadores superiores e 12 inferiores. IPR conservador de 0.2mm nos contatos centrais. Molar 16 mantido como ancoragem sem movimentação conforme prescrito.',
    },
  });

  // Mensagem no Prontuário
  await prisma.caseMessage.create({
    data: {
      caseId: case1.id,
      senderId: planner.id,
      content:
        'Olá Dr. Roberto! O Setup Virtual v1 do caso da Mariana Costa está pronto para sua análise. Respeitamos a restrição de movimentação no dente #16.',
      mentionedTeethFdi: '16',
    },
  });

  // Pedido Comercial Vinculado
  await prisma.order.create({
    data: {
      caseId: case1.id,
      orderCode: 'PED-2026-001',
      planType: 'FULL',
      amount: 3500.0,
      paymentStatus: 'PENDING',
    },
  });

  console.log('  ✓ Caso 001 (Completo / SETUP_AVAILABLE): FY-2026-001 criado com sucesso.');

  // --------------------------------------------------------------------------
  // CENÁRIO 2: Caso 002 — RASCUNHO / WIZARD INCOMPLETO (FY-2026-002)
  // Serve para testar: Wizard Etapa 2 (Paciente Gabriel Ramos Santos),
  // Etapa 3 (Condição Clínica) e Etapa 4 (Plano de Tratamento).
  // Propositalmente SEM ClinicalCondition, SEM TreatmentPlan, SEM Consent.
  // --------------------------------------------------------------------------
  const case2 = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-002',
      patientId: patient2.id,
      doctorId: doctor.id,
      doctorMembershipId: doctorMembership.id,
      clinicId: clinicOrg.id,
      status: 'DRAFT',
      treatedArches: 'BOTH',
      chiefComplaint: 'Diastema interincisal superior de 2.5mm.',
      angleClass: 'Classe I',
      restrictedTeethFdi: JSON.stringify([]),
      doctorNotes: 'Fechamento de diastema com mesialização dos incisivos centrais e laterais.',
    },
  });

  // Apenas 2 fotos iniciais de rascunho (incompleto propositalmente para o Wizard)
  await prisma.caseFile.create({
    data: {
      caseId: case2.id,
      slotNumber: 1,
      category: 'EXTRAORAL',
      type: 'PHOTO_FRONTAL_REST',
      originalFileName: 'rascunho_frontal.jpg',
      storageKey: `cases/${case2.id}/slots/slot_1_rascunho_frontal.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 1800000,
      status: 'UPLOADED',
      uploadedById: doctor.id,
    },
  });

  await prisma.caseFile.create({
    data: {
      caseId: case2.id,
      slotNumber: 2,
      category: 'EXTRAORAL',
      type: 'PHOTO_FRONTAL_SMILE',
      originalFileName: 'rascunho_sorriso.jpg',
      storageKey: `cases/${case2.id}/slots/slot_2_rascunho_sorriso.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 1950000,
      status: 'UPLOADED',
      uploadedById: doctor.id,
    },
  });

  console.log('  ✓ Caso 002 (Rascunho / DRAFT Wizard): FY-2026-002 criado com sucesso.');

  // --------------------------------------------------------------------------
  // CENÁRIO 3: Caso 003 — SUBMITTED (FY-2026-003)
  // Serve para testar: Transição Dentista -> Triagem do Laboratório,
  // Atribuição de Planner e criação do primeiro Setup Virtual.
  // Possui Condition ✓, TreatmentPlan ✓, Consent ✓, 13 Arquivos ✓.
  // --------------------------------------------------------------------------
  const case3 = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-003',
      patientId: patient3.id,
      doctorId: doctor.id,
      doctorMembershipId: doctorMembership.id,
      clinicId: clinicOrg.id,
      status: 'SUBMITTED',
      treatedArches: 'BOTH',
      chiefComplaint: 'Fechamento de diastemas generalizados e alinhamento do arco superior.',
      angleClass: 'Classe I',
      restrictedTeethFdi: JSON.stringify([]),
      doctorNotes: 'Alinhamento com fechamento de diastemas. Respeitar contatos proximais.',
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.clinicalCondition.create({
    data: {
      caseId: case3.id,
      upperMidline: 'CENTERED',
      lowerMidline: 'CENTERED',
      canineRight: 'CLASS_I',
      canineLeft: 'CLASS_I',
      molarRight: 'CLASS_I',
      molarLeft: 'CLASS_I',
    },
  });

  await prisma.treatmentPlan.create({
    data: {
      caseId: case3.id,
      upperMidline: 'MAINTAIN',
      lowerMidline: 'MAINTAIN',
      overjet: 'MAINTAIN',
      overbite: 'MAINTAIN',
      archForm: 'MAINTAIN',
      expansion: 'MAINTAIN',
      canineRelationship: 'MAINTAIN',
      molarRelationship: 'MAINTAIN',
      ipr: false,
      attachment: true,
      intermaxillaryElastic: 'NO',
      classIICorrection: 'DO_NOT_CORRECT',
      classIIICorrection: 'DO_NOT_CORRECT',
      diastemas: 'CLOSE_ALL',
      additionalInstructions: 'Fechamento de diastema anterossuperior de 2mm.',
    },
  });

  await prisma.caseConsent.create({
    data: {
      caseId: case3.id,
      policyVersion: 'v1.0',
      policyHash: 'seed-policy-hash-v1-lucas-2026',
      acceptedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/2.0 (Mozilla/5.0 Chrome/120.0)',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-lucas-003',
      signatureHash: 'seed-sighash-sha256-lucas-003-valid',
    },
  });

  for (const fileData of generate13SlotFiles(case3.id, doctor.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  console.log('  ✓ Caso 003 (SUBMITTED / Triagem Lab): FY-2026-003 criado com sucesso.');

  // --------------------------------------------------------------------------
  // CENÁRIO 4: Caso 004 — CRO PENDENTE (FY-2026-004)
  // Serve para testar: Regra RN-02 de Habilitação do CRO.
  // Dr. Rafael possui croStatus = 'PENDING'. Pode criar rascunho e preencher tudo,
  // mas o botão de Submeter é bloqueado pelo guard com 403 CRO_NOT_VERIFIED.
  // --------------------------------------------------------------------------
  const case4 = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-004',
      patientId: patient4.id,
      doctorId: doctorRafael.id,
      doctorMembershipId: doctorRafaelMembership.id,
      clinicId: clinicOrg.id,
      status: 'DRAFT',
      treatedArches: 'UPPER',
      chiefComplaint: 'Apinhamento anterossuperior leve.',
      angleClass: 'Classe I',
      doctorNotes: 'Doutor com CRO pendente de validação. Caso preenchido aguardando liberação do conselho.',
    },
  });

  await prisma.clinicalCondition.create({
    data: {
      caseId: case4.id,
      upperMidline: 'CENTERED',
      lowerMidline: 'CENTERED',
      canineRight: 'CLASS_I',
      canineLeft: 'CLASS_I',
      molarRight: 'CLASS_I',
      molarLeft: 'CLASS_I',
    },
  });

  await prisma.treatmentPlan.create({
    data: {
      caseId: case4.id,
      upperMidline: 'MAINTAIN',
      lowerMidline: 'MAINTAIN',
      overjet: 'MAINTAIN',
      overbite: 'MAINTAIN',
      archForm: 'MAINTAIN',
      expansion: 'MAINTAIN',
      canineRelationship: 'MAINTAIN',
      molarRelationship: 'MAINTAIN',
      ipr: false,
      attachment: false,
      intermaxillaryElastic: 'NO',
      classIICorrection: 'DO_NOT_CORRECT',
      classIIICorrection: 'DO_NOT_CORRECT',
      diastemas: 'NONE',
    },
  });

  for (const fileData of generate13SlotFiles(case4.id, doctorRafael.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  console.log('  ✓ Caso 004 (CRO PENDENTE / Bloqueio RN-02): FY-2026-004 criado com sucesso.');

  // --------------------------------------------------------------------------
  // CENÁRIO 5: Caso 005 — SEGUNDA CLÍNICA (FY-2026-B01)
  // Serve para testar: Isolamento Multi-Tenant e Neutralização Anti-IDOR.
  // Pertence à Clínica Sorriso Dental Sul (Clínica B) com a Dra. Camila Sul.
  // Dentistas da Clínica A recebem 404 ao tentar acessar ou manipular este caso.
  // --------------------------------------------------------------------------
  const case5 = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-B01',
      patientId: patient5.id,
      doctorId: doctorCamila.id,
      doctorMembershipId: doctorCamilaMembership.id,
      clinicId: clinicBetaOrg.id,
      status: 'SUBMITTED',
      treatedArches: 'BOTH',
      chiefComplaint: 'Mordida cruzada unilateral e apinhamento severo inferior.',
      angleClass: 'Classe III',
      doctorNotes: 'Caso pertencente exclusivamente ao tenant da Clínica B.',
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.clinicalCondition.create({
    data: {
      caseId: case5.id,
      upperMidline: 'CENTERED',
      lowerMidline: 'DEVIATED_LEFT',
      canineRight: 'CLASS_III',
      canineLeft: 'CLASS_III',
      molarRight: 'CLASS_III',
      molarLeft: 'CLASS_III',
    },
  });

  await prisma.treatmentPlan.create({
    data: {
      caseId: case5.id,
      upperMidline: 'MAINTAIN',
      lowerMidline: 'IMPROVE',
      overjet: 'IMPROVE',
      overbite: 'IMPROVE',
      archForm: 'IMPROVE',
      expansion: 'IMPROVE',
      canineRelationship: 'IMPROVE',
      molarRelationship: 'IMPROVE',
      ipr: true,
      attachment: true,
      intermaxillaryElastic: 'YES',
      classIICorrection: 'DO_NOT_CORRECT',
      classIIICorrection: 'CORRECT',
      diastemas: 'NONE',
    },
  });

  await prisma.caseConsent.create({
    data: {
      caseId: case5.id,
      policyVersion: 'v1.0',
      policyHash: 'seed-policy-hash-v1-roberto-2026',
      acceptedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/2.0 (Mozilla/5.0 Chrome/120.0)',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-roberto-005',
      signatureHash: 'seed-sighash-sha256-roberto-005-valid',
    },
  });

  for (const fileData of generate13SlotFiles(case5.id, doctorCamila.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  console.log('  ✓ Caso 005 (SEGUNDA CLÍNICA / Anti-IDOR): FY-2026-B01 criado com sucesso.');

  // ==========================================================================
  // 6. CONVITE DE DEMONSTRAÇÃO (Demonstração da tabela Invitation)
  // ==========================================================================
  console.log('✉️ 7. Criando Convite de Demonstração...');
  await prisma.invitation.create({
    data: {
      organizationId: clinicOrg.id,
      email: 'dra.patricia@odontoprime.com.br',
      role: 'DOCTOR',
      tokenHash: 'sample-invite-token-hash-2026-patricia',
      croNumber: '114422',
      croUf: 'SP',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 horas
      invitedById: doctor.id,
    },
  });

  console.log('\n========================================================================');
  console.log('🎉 BANCO DE DADOS POVOADO COM SUCESSO (SEED V2)!');
  console.log('========================================================================');
  console.log('Cenários disponíveis para desenvolvimento e testes:');
  console.log('  1. Caso FY-2026-001: SETUP_AVAILABLE (Completo: Condição + Plano + Consentimento + 13 slots + Setup)');
  console.log('  2. Caso FY-2026-002: DRAFT (Rascunho: Paciente Gabriel Ramos Santos, pronto para testar o Wizard)');
  console.log('  3. Caso FY-2026-003: SUBMITTED (Pronto para Triagem do Laboratório)');
  console.log('  4. Caso FY-2026-004: CRO PENDENTE (Dr. Rafael: pode preencher Wizard, bloqueado na submissão)');
  console.log('  5. Caso FY-2026-B01: SEGUNDA CLÍNICA (Dra. Camila: isolamento multi-tenant / anti-IDOR)');
  console.log('  - Multi-Membership: Dr. Roberto Silva possui papéis DOCTOR e CLINIC_ADMIN');
  console.log('  - Financeiro: Beatriz Lima (FINANCE) mantida para validação futura de RBAC');
  console.log('========================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante execução do seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

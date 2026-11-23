import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ROLE_DEFAULT_PERMISSIONS, UserRole } from '../src/lib/auth/rbac';
import { addBusinessDays } from '../src/lib/sla/treatment-sla';

const prisma = new PrismaClient();

async function grantDefaultPermissions(membershipId: string, role: UserRole) {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
  if (defaults.length === 0) return;
  await prisma.membershipPermission.createMany({
    data: defaults.map((permission) => ({
      membershipId,
      permission,
    })),
  });
}

async function main() {
  console.log('========================================================================');
  console.log('⚠️  AVISO: DEV/SEED ONLY — SEED V3 FYALIGN (FASE B COMPLETA)');
  console.log('Massa consistente: Personas reais, RBAC granular, Ficha 360°, OS e Contratos.');
  console.log('========================================================================\n');

  console.log('🧹 1. Limpando modelos anteriores respeitando a integridade referencial...');

  // Fase B: Eventos, Links Externos e Solicitações Operacionais
  await prisma.operationalEvent.deleteMany();
  await prisma.externalSystemLink.deleteMany();
  await prisma.serviceOrder.deleteMany();

  // Clínicos estruturados e sessões
  await prisma.caseConsent.deleteMany();
  await prisma.treatmentPlan.deleteMany();
  await prisma.clinicalCondition.deleteMany();
  await prisma.session.deleteMany();

  // Produção, contratos e remessas
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.productionUnit.deleteMany();
  await prisma.refinementRequest.deleteMany();
  await prisma.contractVersion.deleteMany();
  await prisma.caseCommercialContract.deleteMany();

  // Agregados e relacionamentos dependentes
  await prisma.caseAssignment.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.caseMessage.deleteMany();
  await prisma.order.deleteMany();
  await prisma.setupStage.deleteMany();
  await prisma.setup.deleteMany();
  await prisma.caseFile.deleteMany();

  // Nós centrais e RBAC
  await prisma.case.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.membershipPermission.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log('✓ Banco de dados limpo com sucesso!\n');

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysAhead = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  // ==========================================================================
  // 1. ORGANIZAÇÕES (Tenants: Matriz FyAlign e Clínicas Parceiras A e B)
  // ==========================================================================
  console.log('🏢 2. Criando Organizações (Tenants)...');

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
  // 2. USUÁRIOS (Personas Reais da Operação + Contas de Compatibilidade de Suíte)
  // ==========================================================================
  console.log('👤 3. Criando Usuários e Personas Operacionais...');

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

  // Personas Reais da Matriz FyAlign
  const felipeUser = await prisma.user.create({
    data: {
      fullName: 'Felipe Martins (Conferência, Nemo & Produção)',
      email: 'felipe@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'PRODUCTION_QC',
    },
  });

  const adrianoUser = await prisma.user.create({
    data: {
      fullName: 'Dr. Adriano Nogueira (Planejador 3D)',
      email: 'adriano@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'PLANNER_3D',
      professionalIdCro: 'CRO-SP 774411',
    },
  });

  const laisUser = await prisma.user.create({
    data: {
      fullName: 'Laís Oliveira (Comercial & Relacionamento)',
      email: 'lais@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'SUPPORT',
    },
  });

  const pauloUser = await prisma.user.create({
    data: {
      fullName: 'Dr. Paulo Henrique (Financeiro & Contratos)',
      email: 'paulo@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'FINANCE',
    },
  });

  // Contas de compatibilidade para suítes automatizadas existentes
  const planner = await prisma.user.create({
    data: {
      fullName: 'Lucas Mendes (Planejador CAD 3D)',
      email: 'planner@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'PLANNER_3D',
    },
  });

  const productionQc = await prisma.user.create({
    data: {
      fullName: 'Carlos Almeida (Controle de Qualidade)',
      email: 'producao@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'PRODUCTION_QC',
    },
  });

  const finance = await prisma.user.create({
    data: {
      fullName: 'Beatriz Lima (Financeiro FyAlign)',
      email: 'financeiro@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'FINANCE',
    },
  });

  const support = await prisma.user.create({
    data: {
      fullName: 'Thiago Rocha (Suporte Operacional)',
      email: 'suporte@fyalign.com',
      passwordHash: defaultPasswordHash,
      isActive: true,
      role: 'SUPPORT',
    },
  });

  // Clínicas Parceiras
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

  console.log('✓ Usuários e personas criados.');

  // ==========================================================================
  // 3. VÍNCULOS (Memberships + Permissões Granulares Explícitas)
  // ==========================================================================
  console.log('🔗 4. Criando Vínculos e Permissões Granulares...');

  const superAdminMembership = await prisma.membership.create({
    data: {
      userId: superAdmin.id,
      organizationId: fyAlignOrg.id,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(superAdminMembership.id, 'SUPER_ADMIN');

  const felipeMembership = await prisma.membership.create({
    data: {
      userId: felipeUser.id,
      organizationId: fyAlignOrg.id,
      role: 'PRODUCTION_QC',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(felipeMembership.id, 'PRODUCTION_QC');

  const adrianoMembership = await prisma.membership.create({
    data: {
      userId: adrianoUser.id,
      organizationId: fyAlignOrg.id,
      role: 'PLANNER_3D',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(adrianoMembership.id, 'PLANNER_3D');

  const laisMembership = await prisma.membership.create({
    data: {
      userId: laisUser.id,
      organizationId: fyAlignOrg.id,
      role: 'SUPPORT',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(laisMembership.id, 'SUPPORT');

  const pauloMembership = await prisma.membership.create({
    data: {
      userId: pauloUser.id,
      organizationId: fyAlignOrg.id,
      role: 'FINANCE',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(pauloMembership.id, 'FINANCE');

  const plannerMembership = await prisma.membership.create({
    data: {
      userId: planner.id,
      organizationId: fyAlignOrg.id,
      role: 'PLANNER_3D',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(plannerMembership.id, 'PLANNER_3D');

  const qcMembership = await prisma.membership.create({
    data: {
      userId: productionQc.id,
      organizationId: fyAlignOrg.id,
      role: 'PRODUCTION_QC',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(qcMembership.id, 'PRODUCTION_QC');

  const financeMembership = await prisma.membership.create({
    data: {
      userId: finance.id,
      organizationId: fyAlignOrg.id,
      role: 'FINANCE',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(financeMembership.id, 'FINANCE');

  const supportMembership = await prisma.membership.create({
    data: {
      userId: support.id,
      organizationId: fyAlignOrg.id,
      role: 'SUPPORT',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(supportMembership.id, 'SUPPORT');

  const doctorMembership = await prisma.membership.create({
    data: {
      userId: doctor.id,
      organizationId: clinicOrg.id,
      role: 'DOCTOR',
      status: 'ACTIVE',
      croNumber: '102938',
      croUf: 'SP',
      croStatus: 'VERIFIED',
      croVerifiedAt: daysAgo(90),
    },
  });
  await grantDefaultPermissions(doctorMembership.id, 'DOCTOR');

  const doctorAdminMembership = await prisma.membership.create({
    data: {
      userId: doctor.id,
      organizationId: clinicOrg.id,
      role: 'CLINIC_ADMIN',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
    },
  });
  await grantDefaultPermissions(doctorAdminMembership.id, 'CLINIC_ADMIN');

  const assistantMembership = await prisma.membership.create({
    data: {
      userId: assistant.id,
      organizationId: clinicOrg.id,
      role: 'CLINIC_ASSISTANT',
      status: 'ACTIVE',
      croStatus: 'NOT_REQUIRED',
      invitedById: doctor.id,
    },
  });
  await grantDefaultPermissions(assistantMembership.id, 'CLINIC_ASSISTANT');

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
  await grantDefaultPermissions(doctorRafaelMembership.id, 'DOCTOR');

  const doctorCamilaMembership = await prisma.membership.create({
    data: {
      userId: doctorCamila.id,
      organizationId: clinicBetaOrg.id,
      role: 'DOCTOR',
      status: 'ACTIVE',
      croNumber: '554433',
      croUf: 'PR',
      croStatus: 'VERIFIED',
      croVerifiedAt: daysAgo(60),
    },
  });
  await grantDefaultPermissions(doctorCamilaMembership.id, 'DOCTOR');

  console.log('✓ Vínculos e permissões granulares criados.');

  // ==========================================================================
  // 4. PACIENTES & VÍNCULOS COM PRONTUÁRIO EXTERNO DA CLÍNICA
  // ==========================================================================
  console.log('👥 5. Criando Pacientes e Vínculos ERP...');

  const patient1 = await prisma.patient.create({
    data: {
      clinicId: clinicOrg.id,
      fullName: 'Mariana Costa',
      birthDate: new Date('1998-05-14'),
      gender: 'Feminino',
      phone: '(11) 98765-4321',
      email: 'mariana.costa@email.com',
      tcleSigned: true,
    },
  });

  await prisma.externalSystemLink.create({
    data: {
      organizationId: clinicOrg.id,
      entityType: 'PATIENT',
      provider: 'CLINICORP',
      patientId: patient1.id,
      externalId: '4821',
      secondaryCode: 'PRONT-2026-88',
      externalUrl: 'https://app.clinicorp.com/pacientes/4821',
      syncStatus: 'LINKED',
      createdById: doctor.id,
    },
  });

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

  const patient6 = await prisma.patient.create({
    data: {
      clinicId: clinicOrg.id,
      fullName: 'Beatriz Cavalcanti',
      birthDate: new Date('1993-02-18'),
      gender: 'Feminino',
      phone: '(11) 99123-4567',
      email: 'beatriz.cavalcanti@email.com',
      tcleSigned: true,
    },
  });

  await prisma.externalSystemLink.create({
    data: {
      organizationId: clinicOrg.id,
      entityType: 'PATIENT',
      provider: 'SIMPLES_DENTAL',
      patientId: patient6.id,
      externalId: 'SD-9920',
      secondaryCode: 'AG-310',
      syncStatus: 'LINKED',
      createdById: doctor.id,
    },
  });

  console.log('✓ Pacientes criados.');

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
      storageKey: `clinics/seed/cases/${caseId}/slot_${item.slot}_${item.name}`,
      mimeType: item.mime,
      fileSizeBytes: item.size,
      fileHashSha256: `sha256-mock-hash-slot-${item.slot}-${caseId.slice(0, 8)}`,
      status: 'UPLOADED',
      uploadedById: uploaderUserId,
    }));
  }

  // ==========================================================================
  // 5. CENÁRIOS CLÍNICOS, OPERACIONAIS E COMERCIAIS (B1–B4)
  // ==========================================================================
  console.log('🧪 6. Criando Tratamentos, Contratos, OS, Lotes e Eventos...');

  // --------------------------------------------------------------------------
  // CENÁRIO 1A: Mariana Costa — Tratamento FY-2026-006 (IN_PRODUCTION — Ciclo Completo Fase B)
  // Possui: Setup Inicial Aprovado + Contrato Confirmado + LOTE-01 entregue +
  //         2ª Leva em RECEIVED (pronta p/ conferência de Felipe) +
  //         Refinamento #1 Coberto + Refinamento #2 Extra aguardando Dr. Paulo!
  // --------------------------------------------------------------------------
  const caseMarianaFull = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-006',
      patientId: patient1.id,
      doctorId: doctor.id,
      doctorMembershipId: doctorMembership.id,
      clinicId: clinicOrg.id,
      status: 'IN_PRODUCTION',
      treatedArches: 'BOTH',
      chiefComplaint: 'Apinhamento bimaxilar com correção de linha média inferior.',
      angleClass: 'Classe I',
      restrictedTeethFdi: JSON.stringify([]),
      doctorNotes: 'Tratamento híbrido 24 pares em andamento clínico.',
      assignedPlannerId: adrianoUser.id,
      submittedAt: daysAgo(75),
      approvedAt: daysAgo(70),
    },
  });

  await prisma.clinicalCondition.create({
    data: {
      caseId: caseMarianaFull.id,
      upperMidline: 'CENTERED',
      lowerMidline: 'DEVIATED_LEFT',
      canineRight: 'CLASS_I',
      canineLeft: 'CLASS_I',
      molarRight: 'CLASS_I',
      molarLeft: 'CLASS_I',
    },
  });

  await prisma.treatmentPlan.create({
    data: {
      caseId: caseMarianaFull.id,
      upperMidline: 'MAINTAIN',
      lowerMidline: 'IMPROVE',
      overjet: 'IMPROVE',
      overbite: 'IMPROVE',
      archForm: 'MAINTAIN',
      expansion: 'IMPROVE',
      canineRelationship: 'MAINTAIN',
      molarRelationship: 'MAINTAIN',
      ipr: true,
      attachment: true,
      intermaxillaryElastic: 'NO',
      classIICorrection: 'DO_NOT_CORRECT',
      classIIICorrection: 'DO_NOT_CORRECT',
      diastemas: 'NONE',
      additionalInstructions: 'Execução em 2 levas de 12 alinhadores.',
    },
  });

  await prisma.caseConsent.create({
    data: {
      caseId: caseMarianaFull.id,
      policyVersion: 'v1.0',
      policyHash: 'seed-policy-hash-mariana-006',
      acceptedAt: daysAgo(75),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/3.0',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-mariana-006',
      signatureHash: 'seed-sighash-mariana-006',
    },
  });

  for (const fileData of generate13SlotFiles(caseMarianaFull.id, doctor.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  await prisma.setup.create({
    data: {
      caseId: caseMarianaFull.id,
      versionNumber: 1,
      status: 'APPROVED',
      upperAlignersCount: 24,
      lowerAlignersCount: 24,
      approvedAt: daysAgo(70),
      plannerComments: 'Setup inicial v1 de 24 pares aprovado pelo Dr. Roberto.',
    },
  });

  const contractMarianaFull = await prisma.caseCommercialContract.create({
    data: {
      caseId: caseMarianaFull.id,
      contractCode: 'CTR-2026-1001',
      versionNumber: 1,
      status: 'CONFIRMED',
      packageName: 'FyAlign Híbrido 24 Pares + 1 Refinamento',
      contractedAligners: 24,
      totalPriceCents: 420000,
      currency: 'BRL',
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 1,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 16000,
      setupSlaBusinessDays: 3,
      productionSlaDays: 10,
      productionSlaDayType: 'BUSINESS_DAYS',
      commercialNotes: 'Faturamento B2B aprovado pela OdontoPrime.',
      confirmedById: pauloUser.id,
      confirmedAt: daysAgo(69),
    },
  });

  await prisma.contractVersion.create({
    data: {
      contractId: contractMarianaFull.id,
      versionNumber: 1,
      contractedAligners: 24,
      totalPriceCents: 420000,
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 1,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 16000,
      setupSlaBusinessDays: 3,
      productionSlaDays: 10,
      productionSlaDayType: 'BUSINESS_DAYS',
      snapshotJson: JSON.stringify({ contractCode: 'CTR-2026-1001', totalPriceCents: 420000 }),
      changeReason: 'Confirmação inicial do contrato comercial v1.',
      changedById: pauloUser.id,
      createdAt: daysAgo(69),
    },
  });

  const unitMarianaLote1 = await prisma.productionUnit.create({
    data: {
      caseId: caseMarianaFull.id,
      contractId: contractMarianaFull.id,
      unitCode: 'LOTE-01',
      type: 'BATCH',
      quantityPairs: 12,
      shippedQuantity: 12,
      stagesDescription: 'Alinhadores 01 a 12 (1ª Leva)',
      status: 'SHIPPED',
      qcApprovedById: felipeUser.id,
      qcApprovedAt: daysAgo(63),
    },
  });

  const shipMariana1 = await prisma.shipment.create({
    data: {
      caseId: caseMarianaFull.id,
      shipmentCode: 'REM-2026-101',
      carrierName: 'Jadlog Expresso',
      trackingCode: 'BR9911223344FY',
      status: 'DELIVERED',
      shippedAt: daysAgo(62),
      deliveredAt: daysAgo(60),
      dispatchedById: laisUser.id,
    },
  });

  await prisma.shipmentItem.create({
    data: {
      shipmentId: shipMariana1.id,
      productionUnitId: unitMarianaLote1.id,
      quantityShipped: 12,
    },
  });

  // OS-01: Pedido Inicial (Concluída no prazo)
  const soMariana1 = await prisma.serviceOrder.create({
    data: {
      caseId: caseMarianaFull.id,
      orderNumber: `${caseMarianaFull.caseCode}-OS-01`,
      sequenceNumber: 1,
      type: 'INITIAL',
      status: 'DELIVERED',
      title: 'Pedido Inicial — Alinhadores 1 a 12',
      alignerRangeStart: 1,
      alignerRangeEnd: 12,
      requiresNewBudget: false,
      nemoStatus: 'INSERTED',
      nemoCaseId: 'NEMO-2026-106',
      nemoInsertedAt: daysAgo(74),
      nemoInsertedById: felipeUser.id,
      docsVerifiedAt: daysAgo(74),
      docsVerifiedById: felipeUser.id,
      receivedAt: daysAgo(75),
      setupDueAt: daysAgo(71),
      setupSentAt: daysAgo(72),
      approvedAt: daysAgo(70),
      productionReleasedAt: daysAgo(69),
      productionReleasedById: felipeUser.id,
      productionDueAt: daysAgo(58),
      completedAt: daysAgo(62),
      requestedById: doctor.id,
    },
  });

  await prisma.externalSystemLink.create({
    data: {
      organizationId: fyAlignOrg.id,
      entityType: 'SERVICE_ORDER',
      provider: 'NEMO',
      caseId: caseMarianaFull.id,
      serviceOrderId: soMariana1.id,
      externalId: 'NEMO-2026-106',
      syncStatus: 'LINKED',
      createdById: felipeUser.id,
    },
  });

  // OS-02: Segunda Leva aberta pelo Dr. Roberto (RECEIVED — pronta para Felipe conferir e programar!)
  await prisma.serviceOrder.create({
    data: {
      caseId: caseMarianaFull.id,
      orderNumber: `${caseMarianaFull.caseCode}-OS-02`,
      sequenceNumber: 2,
      type: 'SECOND_BATCH',
      status: 'RECEIVED',
      title: 'Segunda Leva — Alinhadores 13 a 24',
      alignerRangeStart: 13,
      alignerRangeEnd: 24,
      requiresNewBudget: false,
      nemoStatus: 'NOT_REQUIRED',
      receivedAt: daysAgo(1),
      notes: 'Paciente no estágio 10 com excelente adaptação. Solicito preparação da 2ª leva.',
      requestedById: doctor.id,
    },
  });

  // Refinamento #1 Coberto pela Franquia + OS-03 (DUE_SOON)
  const refMariana1 = await prisma.refinementRequest.create({
    data: {
      caseId: caseMarianaFull.id,
      contractId: contractMarianaFull.id,
      sequenceNumber: 1,
      contractVersionUsed: 1,
      clinicalReason: 'Ajuste fino de torque palatino do incisivo lateral 22.',
      clinicalStatus: 'REQUESTED',
      isCoveredByContract: true,
      extraAlignersCount: 4,
      extraAmountChargedCents: 0,
      commercialStatus: 'COMMERCIALLY_APPROVED',
      requestedById: doctor.id,
      commerciallyApprovedById: pauloUser.id,
      commerciallyApprovedAt: daysAgo(2),
    },
  });

  await prisma.serviceOrder.create({
    data: {
      caseId: caseMarianaFull.id,
      refinementRequestId: refMariana1.id,
      orderNumber: `${caseMarianaFull.caseCode}-OS-03`,
      sequenceNumber: 3,
      type: 'REFINEMENT',
      status: 'IN_PLANNING',
      title: 'Refinamento #1 — Ajuste fino de torque no 22',
      requiresNewBudget: false,
      nemoStatus: 'INSERTED',
      nemoCaseId: 'NEMO-2026-106-R1',
      nemoInsertedAt: daysAgo(2),
      nemoInsertedById: felipeUser.id,
      docsVerifiedAt: daysAgo(2),
      docsVerifiedById: felipeUser.id,
      receivedAt: daysAgo(2),
      setupDueAt: daysAhead(0.5), // Vence em ~12h -> DUE_SOON!
      requestedById: doctor.id,
    },
  });

  // Refinamento #2 Extra-Franquia + OS-04 aguardando aprovação comercial de Dr. Paulo
  const refMariana2 = await prisma.refinementRequest.create({
    data: {
      caseId: caseMarianaFull.id,
      contractId: contractMarianaFull.id,
      sequenceNumber: 2,
      contractVersionUsed: 1,
      clinicalReason: 'Sobrecorreção adicional de rotação distal do canino 43.',
      clinicalStatus: 'CLINICALLY_APPROVED',
      isCoveredByContract: false,
      extraAlignersCount: 4,
      extraAmountChargedCents: 64000,
      commercialStatus: 'PENDING_COMMERCIAL_APPROVAL',
      requestedById: doctor.id,
    },
  });

  await prisma.serviceOrder.create({
    data: {
      caseId: caseMarianaFull.id,
      refinementRequestId: refMariana2.id,
      orderNumber: `${caseMarianaFull.caseCode}-OS-04`,
      sequenceNumber: 4,
      type: 'REFINEMENT',
      status: 'WAITING_PAYMENT',
      title: 'Refinamento #2 (Extra-Franquia) — Sobrecorreção do 43',
      requiresNewBudget: true,
      nemoStatus: 'INSERTED',
      nemoCaseId: 'NEMO-2026-106-R2',
      nemoInsertedAt: daysAgo(1),
      nemoInsertedById: felipeUser.id,
      docsVerifiedAt: daysAgo(1),
      docsVerifiedById: felipeUser.id,
      receivedAt: daysAgo(1),
      setupDueAt: daysAgo(0.2),
      setupSentAt: daysAgo(0.5),
      approvedAt: daysAgo(0.3),
      requestedById: doctor.id,
    },
  });

  // Eventos operacionais vs comerciais rigorosamente separados (zero vazamento de R$ para Felipe/Dr. Adriano!)
  await prisma.operationalEvent.createMany({
    data: [
      {
        caseId: caseMarianaFull.id,
        serviceOrderId: soMariana1.id,
        eventType: 'DOCS_VERIFIED',
        channel: 'INTERNAL',
        summary: 'Conferência documental e malhas STL validadas sem distorções',
        isInternalOnly: true,
        recordedById: felipeUser.id,
        occurredAt: daysAgo(74),
      },
      {
        caseId: caseMarianaFull.id,
        serviceOrderId: soMariana1.id,
        eventType: 'SETUP_SENT',
        channel: 'WHATSAPP',
        summary: 'Link do Setup Virtual v1 enviado ao Dr. Roberto via WhatsApp',
        isInternalOnly: false,
        recordedById: laisUser.id,
        occurredAt: daysAgo(72),
      },
      {
        caseId: caseMarianaFull.id,
        serviceOrderId: soMariana1.id,
        eventType: 'CONTRACT_CONFIRMED',
        channel: 'INTERNAL',
        summary: 'Contrato CTR-2026-1001 confirmado (R$ 4.200,00 — 24 pares)',
        details: 'Condição B2B OdontoPrime validada pelo Financeiro.',
        isInternalOnly: false,
        recordedById: pauloUser.id,
        occurredAt: daysAgo(69),
      },
      {
        caseId: caseMarianaFull.id,
        serviceOrderId: soMariana1.id,
        eventType: 'SHIPMENT_NOTIFIED',
        channel: 'WHATSAPP',
        summary: 'Rastreio Jadlog BR9911223344FY da 1ª Leva informado à clínica',
        isInternalOnly: false,
        recordedById: laisUser.id,
        occurredAt: daysAgo(62),
      },
      {
        caseId: caseMarianaFull.id,
        eventType: 'SECOND_BATCH_REQUESTED',
        channel: 'PORTAL',
        summary: 'Segunda Leva solicitada pelo Ortodontista (FY-2026-006-OS-02): alinhadores 13 a 24 — aguardando conferência interna',
        isInternalOnly: false,
        recordedById: doctor.id,
        occurredAt: daysAgo(1),
      },
      {
        caseId: caseMarianaFull.id,
        eventType: 'BUDGET_SENT',
        channel: 'WHATSAPP',
        summary: 'Orçamento complementar do Refinamento #2 (R$ 640,00 — 4 pares extras) enviado à clínica',
        isInternalOnly: false,
        recordedById: laisUser.id,
        occurredAt: daysAgo(0.4),
      },
    ],
  });

  // --------------------------------------------------------------------------
  // CENÁRIO 1B: Mariana Costa — Segundo Tratamento FY-2026-001 (SETUP_AVAILABLE + Contrato DRAFT)
  // Mantém compatibilidade integral com suítes existentes E demonstra o bloqueio categórico
  // de Segunda Leva / Refinamento enquanto Setup não aprovado + Contrato em DRAFT!
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
      restrictedTeethFdi: JSON.stringify(['16']),
      iprPreferences: JSON.stringify({ allowed: true, maxPerContactMm: 0.3 }),
      attachmentPreferences: JSON.stringify({ allowed: true, avoidAnterior: true }),
      doctorNotes: 'Paciente prioriza estética. Alinhar bateria anterior e corrigir sobremordida sem sobre-projeção dos incisivos inferiores.',
      assignedPlannerId: planner.id,
      submittedAt: daysAgo(3),
    },
  });

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

  await prisma.caseConsent.create({
    data: {
      caseId: case1.id,
      policyVersion: 'v1.0',
      policyHash: 'seed-policy-hash-v1-mariana-2026',
      acceptedAt: daysAgo(3),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/3.0',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-mariana-001',
      signatureHash: 'seed-sighash-sha256-mariana-001-valid',
    },
  });

  for (const fileData of generate13SlotFiles(case1.id, doctor.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

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

  await prisma.serviceOrder.create({
    data: {
      caseId: case1.id,
      orderNumber: 'FY-2026-001-OS-01',
      sequenceNumber: 1,
      type: 'INITIAL',
      status: 'AWAITING_APPROVAL',
      title: 'Pedido Inicial — Planejamento e 1ª Leva de Alinhadores',
      requiresNewBudget: false,
      nemoStatus: 'INSERTED',
      nemoCaseId: 'NEMO-2026-001',
      nemoInsertedAt: daysAgo(2),
      nemoInsertedById: felipeUser.id,
      docsVerifiedAt: daysAgo(2.5),
      docsVerifiedById: felipeUser.id,
      receivedAt: daysAgo(3),
      setupDueAt: addBusinessDays(daysAgo(3), 3),
      setupSentAt: daysAgo(1),
      requestedById: doctor.id,
    },
  });

  // Proposta Contratual em DRAFT (emitida por Laís, pronta para Dr. Paulo confirmar)
  await prisma.caseCommercialContract.create({
    data: {
      caseId: case1.id,
      contractCode: 'CTR-2026-1002',
      versionNumber: 1,
      status: 'DRAFT',
      packageName: 'FyAlign Estético 14 Pares',
      contractedAligners: 14,
      totalPriceCents: 350000,
      currency: 'BRL',
      productionModel: 'ALL_AT_ONCE',
      deliveryModel: 'SINGLE_SHIPMENT',
      includedRefinements: 1,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 17000,
      setupSlaBusinessDays: 3,
      productionSlaDays: 10,
      productionSlaDayType: 'BUSINESS_DAYS',
      commercialNotes: 'Proposta enviada por Laís; aguardando aceite formal da clínica.',
    },
  });

  await prisma.caseMessage.create({
    data: {
      caseId: case1.id,
      senderId: planner.id,
      content:
        'Olá Dr. Roberto! O Setup Virtual v1 do caso da Mariana Costa está pronto para sua análise. Respeitamos a restrição de movimentação no dente #16.',
      mentionedTeethFdi: '16',
    },
  });

  await prisma.order.create({
    data: {
      caseId: case1.id,
      orderCode: 'PED-2026-001',
      planType: 'FULL',
      amount: 3500.0,
      paymentStatus: 'PENDING',
    },
  });

  console.log('  ✓ Casos Mariana Costa (FY-2026-006 Ciclo Completo + FY-2026-001 SETUP_AVAILABLE) criados.');

  // --------------------------------------------------------------------------
  // CENÁRIO 2: Caso 002 — RASCUNHO / WIZARD INCOMPLETO (FY-2026-002)
  // Mantido estritamente como DRAFT com 2 arquivos para suítes Fase 2 e Fase 3!
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

  await prisma.caseFile.create({
    data: {
      caseId: case2.id,
      slotNumber: 1,
      category: 'EXTRAORAL',
      type: 'PHOTO_FRONTAL_REST',
      originalFileName: 'rascunho_frontal.jpg',
      storageKey: `clinics/seed/cases/${case2.id}/slot_1_rascunho_frontal.jpg`,
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
      storageKey: `clinics/seed/cases/${case2.id}/slot_2_rascunho_sorriso.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 1950000,
      status: 'UPLOADED',
      uploadedById: doctor.id,
    },
  });

  console.log('  ✓ Caso 002 (Rascunho / DRAFT Wizard): FY-2026-002 criado.');

  // --------------------------------------------------------------------------
  // CENÁRIO 3: Caso 003 — SUBMITTED / SLA OVERDUE & SEM CONTRATO (FY-2026-003)
  // Pronto para triagem de Felipe, inserção Nemo, emissão de proposta por Laís!
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
      submittedAt: daysAgo(6),
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
      acceptedAt: daysAgo(6),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/3.0',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-lucas-003',
      signatureHash: 'seed-sighash-sha256-lucas-003-valid',
    },
  });

  for (const fileData of generate13SlotFiles(case3.id, doctor.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  await prisma.serviceOrder.create({
    data: {
      caseId: case3.id,
      orderNumber: 'FY-2026-003-OS-01',
      sequenceNumber: 1,
      type: 'INITIAL',
      status: 'RECEIVED',
      title: 'Pedido Inicial — Planejamento e 1ª Leva de Alinhadores',
      requiresNewBudget: false,
      nemoStatus: 'PENDING',
      receivedAt: daysAgo(6),
      setupDueAt: daysAgo(1), // SLA de Setup estourado -> OVERDUE!
      requestedById: doctor.id,
    },
  });

  console.log('  ✓ Caso 003 (SUBMITTED / SLA OVERDUE / Sem Contrato): FY-2026-003 criado.');

  // --------------------------------------------------------------------------
  // CENÁRIO 4: Caso 004 — CRO PENDENTE (FY-2026-004)
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

  console.log('  ✓ Caso 004 (CRO PENDENTE / Bloqueio RN-02): FY-2026-004 criado.');

  // --------------------------------------------------------------------------
  // CENÁRIO 5: Caso 005 — SEGUNDA CLÍNICA (FY-2026-B01 — Anti-IDOR Multi-Tenant)
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
      submittedAt: daysAgo(2),
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
      acceptedAt: daysAgo(2),
      ipAddress: '127.0.0.1',
      userAgent: 'FyAlign Seed/3.0',
      scrollCompleted: true,
      signatureKey: 'seed-sigkey-roberto-005',
      signatureHash: 'seed-sighash-sha256-roberto-005-valid',
    },
  });

  for (const fileData of generate13SlotFiles(case5.id, doctorCamila.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  await prisma.serviceOrder.create({
    data: {
      caseId: case5.id,
      orderNumber: 'FY-2026-B01-OS-01',
      sequenceNumber: 1,
      type: 'INITIAL',
      status: 'RECEIVED',
      title: 'Pedido Inicial — Clínica B',
      requiresNewBudget: false,
      nemoStatus: 'PENDING',
      receivedAt: daysAgo(2),
      setupDueAt: addBusinessDays(daysAgo(2), 3),
      requestedById: doctorCamila.id,
    },
  });

  const contractB = await prisma.caseCommercialContract.create({
    data: {
      caseId: case5.id,
      contractCode: 'CTR-2026-2001',
      versionNumber: 1,
      status: 'CONFIRMED',
      packageName: 'FyAlign Clínica Sul 20 Pares',
      contractedAligners: 20,
      totalPriceCents: 380000,
      currency: 'BRL',
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 1,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 15000,
      confirmedById: pauloUser.id,
      confirmedAt: daysAgo(1),
    },
  });

  await prisma.contractVersion.create({
    data: {
      contractId: contractB.id,
      versionNumber: 1,
      contractedAligners: 20,
      totalPriceCents: 380000,
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 1,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 15000,
      snapshotJson: JSON.stringify({ contractCode: 'CTR-2026-2001' }),
      changeReason: 'Confirmação inicial Clínica B.',
      changedById: pauloUser.id,
    },
  });

  console.log('  ✓ Caso 005 (SEGUNDA CLÍNICA / Anti-IDOR): FY-2026-B01 criado.');

  // --------------------------------------------------------------------------
  // CENÁRIO 6: Beatriz Cavalcanti — FY-2026-007 (Radar T-30d Elegível p/ Disparo)
  // Setup aprovado + Contrato confirmado (24 pares) + LOTE-01 (12 pares) entregue
  // há 142 dias -> término estimado da 1ª leva em ~26 dias -> Radar T-30d ativo!
  // --------------------------------------------------------------------------
  const caseBeatriz = await prisma.case.create({
    data: {
      caseCode: 'FY-2026-007',
      patientId: patient6.id,
      doctorId: doctor.id,
      doctorMembershipId: doctorMembership.id,
      clinicId: clinicOrg.id,
      status: 'DELIVERED',
      treatedArches: 'BOTH',
      chiefComplaint: 'Sobremordida acentuada e rotação de pré-molares.',
      angleClass: 'Classe II Div 2',
      restrictedTeethFdi: JSON.stringify([]),
      doctorNotes: 'Primeira leva entregue; acompanhar janela T-30d da Segunda Leva.',
      assignedPlannerId: adrianoUser.id,
      submittedAt: daysAgo(155),
      approvedAt: daysAgo(150),
    },
  });

  for (const fileData of generate13SlotFiles(caseBeatriz.id, doctor.id)) {
    await prisma.caseFile.create({ data: fileData });
  }

  await prisma.setup.create({
    data: {
      caseId: caseBeatriz.id,
      versionNumber: 1,
      status: 'APPROVED',
      upperAlignersCount: 24,
      lowerAlignersCount: 24,
      approvedAt: daysAgo(150),
      plannerComments: 'Planejamento de 24 estágios aprovado.',
    },
  });

  const contractBeatriz = await prisma.caseCommercialContract.create({
    data: {
      caseId: caseBeatriz.id,
      contractCode: 'CTR-2026-1007',
      versionNumber: 1,
      status: 'CONFIRMED',
      packageName: 'FyAlign Híbrido 24 Pares',
      contractedAligners: 24,
      totalPriceCents: 420000,
      currency: 'BRL',
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 2,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 16000,
      setupSlaBusinessDays: 3,
      productionSlaDays: 10,
      productionSlaDayType: 'BUSINESS_DAYS',
      confirmedById: pauloUser.id,
      confirmedAt: daysAgo(149),
    },
  });

  await prisma.contractVersion.create({
    data: {
      contractId: contractBeatriz.id,
      versionNumber: 1,
      contractedAligners: 24,
      totalPriceCents: 420000,
      productionModel: 'HYBRID',
      deliveryModel: 'BATCHED',
      includedRefinements: 2,
      refinementWindowDays: 180,
      extraAlignerPriceCents: 16000,
      setupSlaBusinessDays: 3,
      productionSlaDays: 10,
      productionSlaDayType: 'BUSINESS_DAYS',
      snapshotJson: JSON.stringify({ contractCode: 'CTR-2026-1007' }),
      changeReason: 'Confirmação inicial do contrato.',
      changedById: pauloUser.id,
    },
  });

  const unitBeatriz1 = await prisma.productionUnit.create({
    data: {
      caseId: caseBeatriz.id,
      contractId: contractBeatriz.id,
      unitCode: 'LOTE-01',
      type: 'BATCH',
      quantityPairs: 12,
      shippedQuantity: 12,
      stagesDescription: 'Alinhadores 01 a 12 (1ª Leva)',
      status: 'SHIPPED',
      qcApprovedById: felipeUser.id,
      qcApprovedAt: daysAgo(143),
    },
  });

  const shipBeatriz1 = await prisma.shipment.create({
    data: {
      caseId: caseBeatriz.id,
      shipmentCode: 'REM-2026-107',
      carrierName: 'Correios SEDEX',
      trackingCode: 'SX887766554BR',
      status: 'DELIVERED',
      shippedAt: daysAgo(142),
      deliveredAt: daysAgo(140),
      dispatchedById: laisUser.id,
    },
  });

  await prisma.shipmentItem.create({
    data: {
      shipmentId: shipBeatriz1.id,
      productionUnitId: unitBeatriz1.id,
      quantityShipped: 12,
    },
  });

  await prisma.serviceOrder.create({
    data: {
      caseId: caseBeatriz.id,
      orderNumber: 'FY-2026-007-OS-01',
      sequenceNumber: 1,
      type: 'INITIAL',
      status: 'DELIVERED',
      title: 'Pedido Inicial — Alinhadores 1 a 12',
      alignerRangeStart: 1,
      alignerRangeEnd: 12,
      requiresNewBudget: false,
      nemoStatus: 'INSERTED',
      nemoCaseId: 'NEMO-2026-107',
      nemoInsertedAt: daysAgo(153),
      nemoInsertedById: felipeUser.id,
      docsVerifiedAt: daysAgo(153),
      docsVerifiedById: felipeUser.id,
      receivedAt: daysAgo(155),
      setupDueAt: daysAgo(151),
      setupSentAt: daysAgo(152),
      approvedAt: daysAgo(150),
      productionReleasedAt: daysAgo(149),
      productionReleasedById: felipeUser.id,
      productionDueAt: daysAgo(139),
      completedAt: daysAgo(142),
      requestedById: doctor.id,
    },
  });

  console.log('  ✓ Caso 006 (Radar T-30d Segunda Leva elegível): FY-2026-007 criado.');

  // Convite de demonstração
  await prisma.invitation.create({
    data: {
      organizationId: clinicOrg.id,
      email: 'dra.patricia@odontoprime.com.br',
      role: 'DOCTOR',
      tokenHash: 'sample-invite-token-hash-2026-patricia',
      croNumber: '114422',
      croUf: 'SP',
      status: 'PENDING',
      expiresAt: daysAhead(2),
      invitedById: doctor.id,
    },
  });

  console.log('\n========================================================================');
  console.log('🎉 BANCO DE DADOS POVOADO COM SUCESSO (SEED V3 — FASE B)!');
  console.log('========================================================================');
  console.log('Personas prontas para homologação (Senha padrão: Password@123):');
  console.log('  - Felipe (Conferência, Nemo & Produção): felipe@fyalign.com');
  console.log('  - Dr. Adriano (Planejador 3D):           adriano@fyalign.com');
  console.log('  - Laís (Comercial & Relacionamento):     lais@fyalign.com');
  console.log('  - Dr. Paulo (Financeiro & Contratos):    paulo@fyalign.com');
  console.log('  - Super Admin:                           admin@fyalign.com');
  console.log('  - Dr. Roberto (Ortodontista CRO OK):     roberto@odontoprime.com.br');
  console.log('  - Larissa (Assistente Clínica):          larissa@odontoprime.com.br');
  console.log('  - Dr. Rafael (CRO Pendente):             rafael.pendente@odontoprime.com.br');
  console.log('  - Dra. Camila (Clínica B):               camila@sorrisosul.com.br');
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

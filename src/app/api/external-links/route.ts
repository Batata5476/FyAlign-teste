import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';

const upsertExternalLinkSchema = z.object({
  entityType: z.enum([
    'PATIENT',
    'TREATMENT',
    'SERVICE_ORDER',
    'SHIPMENT',
    'DOCUMENTATION',
    'CONTRACT',
  ]),
  provider: z.enum([
    'NEMO',
    'CLINICORP',
    'SIMPLES_DENTAL',
    'DENTAL_OFFICE',
    'CORREIOS',
    'MELHOR_ENVIO',
    'LOGGI',
    'WHATSAPP',
    'ITERO',
    'MEDIT_LINK',
    'SHAPES_3',
    'IDOC',
    'OTHER',
  ]),
  patientId: z.string().uuid().optional().nullable(),
  caseId: z.string().uuid().optional().nullable(),
  serviceOrderId: z.string().uuid().optional().nullable(),
  externalId: z.string().min(1, 'O identificador externo é obrigatório'),
  secondaryCode: z.string().optional().nullable(),
  externalUrl: z.string().url('URL externa inválida').optional().or(z.literal('')).nullable(),
  syncStatus: z.enum(['MANUAL', 'LINKED', 'SYNCED', 'PENDING', 'ERROR']).default('LINKED'),
  metadata: z.record(z.any()).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId');
  const caseId = searchParams.get('caseId');

  if (!patientId && !caseId) {
    return NextResponse.json(
      { error: 'Informe patientId ou caseId para consultar vínculos externos.' },
      { status: 400 }
    );
  }

  if (patientId) {
    if (!hasPermission(userCtx, 'PATIENT_READ')) {
      return NextResponse.json({ error: 'Sem permissão PATIENT_READ.' }, { status: 403 });
    }
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, clinicId: true },
    });
    if (!patient || (sessionUser.organizationType === 'CLINIC' && patient.clinicId !== sessionUser.organizationId)) {
      return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 });
    }
    const links = await prisma.externalSystemLink.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ externalLinks: links });
  }

  if (!hasPermission(userCtx, 'CASE_READ')) {
    return NextResponse.json({ error: 'Sem permissão CASE_READ.' }, { status: 403 });
  }
  const targetCase = await prisma.case.findUnique({
    where: { id: caseId! },
    select: { id: true, clinicId: true },
  });
  if (!targetCase || (sessionUser.organizationType === 'CLINIC' && targetCase.clinicId !== sessionUser.organizationId)) {
    return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
  }

  const links = await prisma.externalSystemLink.findMany({
    where: { caseId: caseId! },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ externalLinks: links });
}

export async function POST(req: NextRequest) {
  const sessionUser = await getCurrentUser(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };

  try {
    const body = await req.json();
    const input = upsertExternalLinkSchema.parse(body);

    // 1. Validação de Permissão Granular por Domínio Externo (B-INT01)
    if (input.entityType === 'PATIENT') {
      if (!hasPermission(userCtx, 'PATIENT_UPDATE')) {
        return NextResponse.json(
          { error: 'Permissão PATIENT_UPDATE necessária para vincular prontuário externo do paciente.' },
          { status: 403 }
        );
      }
      if (!input.patientId) {
        return NextResponse.json(
          { error: 'patientId é obrigatório para vínculos de prontuário.' },
          { status: 400 }
        );
      }
    } else if (input.provider === 'NEMO') {
      if (!hasPermission(userCtx, 'NEMO_MANAGE')) {
        return NextResponse.json(
          { error: 'Permissão NEMO_MANAGE necessária para vincular caso no Nemo.' },
          { status: 403 }
        );
      }
    } else if (['CORREIOS', 'MELHOR_ENVIO', 'LOGGI', 'WHATSAPP'].includes(input.provider)) {
      const canLinkCommOrLogistics =
        hasPermission(userCtx, 'COMMERCIAL_COMMUNICATE') ||
        hasPermission(userCtx, 'SHIPMENT_CREATE') ||
        hasPermission(userCtx, 'SHIPMENT_DISPATCH');
      if (!canLinkCommOrLogistics) {
        return NextResponse.json(
          { error: 'Sem permissão comercial ou logística para registrar vínculo externo.' },
          { status: 403 }
        );
      }
    } else if (input.entityType === 'DOCUMENTATION') {
      if (!hasPermission(userCtx, 'FILE_UPLOAD')) {
        return NextResponse.json(
          { error: 'Permissão FILE_UPLOAD necessária para vincular fonte externa de exame.' },
          { status: 403 }
        );
      }
    } else if (!hasPermission(userCtx, 'CASE_UPDATE') && !hasPermission(userCtx, 'CONTRACT_CREATE')) {
      return NextResponse.json({ error: 'Sem permissão para criar vínculo externo.' }, { status: 403 });
    }

    // 2. Validação Anti-IDOR e Resolução de Organização
    let targetOrganizationId = sessionUser.organizationId;

    if (input.patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: input.patientId },
        select: { id: true, clinicId: true },
      });
      if (!patient || (sessionUser.organizationType === 'CLINIC' && patient.clinicId !== sessionUser.organizationId)) {
        return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 });
      }
      targetOrganizationId = patient.clinicId;
    }

    if (input.caseId) {
      const targetCase = await prisma.case.findUnique({
        where: { id: input.caseId },
        select: { id: true, clinicId: true },
      });
      if (!targetCase || (sessionUser.organizationType === 'CLINIC' && targetCase.clinicId !== sessionUser.organizationId)) {
        return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
      }
      targetOrganizationId = targetCase.clinicId;
    }

    const now = new Date();
    const existing = await prisma.externalSystemLink.findFirst({
      where: {
        entityType: input.entityType,
        provider: input.provider,
        patientId: input.patientId || null,
        caseId: input.caseId || null,
        serviceOrderId: input.serviceOrderId || null,
      },
    });

    const payload = {
      organizationId: targetOrganizationId,
      patientId: input.patientId || null,
      caseId: input.caseId || null,
      serviceOrderId: input.serviceOrderId || null,
      entityType: input.entityType,
      provider: input.provider,
      externalId: input.externalId.trim(),
      secondaryCode: input.secondaryCode?.trim() || null,
      externalUrl: input.externalUrl?.trim() || null,
      syncStatus: input.syncStatus,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      lastSyncedAt: now,
      createdById: sessionUser.userId,
    };

    const link = existing
      ? await prisma.externalSystemLink.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.externalSystemLink.create({
          data: payload,
        });

    return NextResponse.json({ externalLink: link }, { status: existing ? 200 : 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro em POST /api/external-links:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar vínculo com sistema externo.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';

const qcChecklistSchema = z.object({
  laserMarkingVerified: z.boolean().refine((v) => v === true, {
    message: 'A gravação a laser do ID do alinhador deve ser inspecionada e aprovada.',
  }),
  edgeLaserCutVerified: z.boolean().refine((v) => v === true, {
    message: 'O acabamento e corte a laser da borda gengival devem ser conferidos.',
  }),
  opticalClarityVerified: z.boolean().refine((v) => v === true, {
    message: 'A transparência ótica dos alinhadores é mandatória.',
  }),
  noBubblesOrDefects: z.boolean().refine((v) => v === true, {
    message: 'Não podem existir bolhas ou microfissuras de termoformagem.',
  }),
  alignersQuantityVerified: z.boolean().refine((v) => v === true, {
    message: 'A conferência quantitativa dos alinhadores é mandatória.',
  }),
  qcNotes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Apenas equipe de QC/Produção ou Super Admin
  if (!['PRODUCTION_QC', 'SUPER_ADMIN'].includes(sessionUser.role)) {
    return NextResponse.json(
      { error: 'Apenas a equipe de Controle de Qualidade (QC) pode homologar este checklist (F5.13).' },
      { status: 403 }
    );
  }

  const caseId = params.id;
  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const checklist = qcChecklistSchema.parse(body);

    // Atualizar caso para aguardando despacho ou DISPATCHED
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'QUALITY_CONTROL',
      },
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        action: 'QC_INSPECTION_PASSED',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify({
          checklist,
          inspectorName: sessionUser.fullName,
          inspectedAt: new Date().toISOString(),
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/QC',
      },
    });

    return NextResponse.json({
      message: 'Inspeção de Controle de Qualidade (QC) aprovada com sucesso! Lote liberado para expedição.',
      case: updatedCase,
      inspectedBy: sessionUser.fullName,
      inspectedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro na inspeção QC' }, { status: 500 });
  }
}

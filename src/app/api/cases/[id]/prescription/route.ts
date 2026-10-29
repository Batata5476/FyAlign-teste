import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      doctor: {
        select: {
          id: true,
          fullName: true,
          professionalIdCro: true,
          role: true,
        },
      },
      files: {
        select: {
          id: true,
          slotNumber: true,
          category: true,
          status: true,
          originalFileName: true,
        },
      },
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  if (!isFyAlignInternal(sessionUser.role) && clinicalCase.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  return NextResponse.json({ case: clinicalCase });
}

const updatePrescriptionSchema = z.object({
  treatedArches: z.enum(['UPPER', 'LOWER', 'BOTH']).optional(),
  chiefComplaint: z.string().optional(),
  angleClass: z.string().optional(),
  midlinePreference: z.string().optional(),
  restrictedTeethFdi: z.array(z.string()).optional(),
  extractedTeethFdi: z.array(z.string()).optional(),
  iprPreferences: z.object({
    allowed: z.boolean(),
    maxPerContactMm: z.number().optional(),
  }).optional(),
  attachmentPreferences: z.object({
    allowed: z.boolean(),
    avoidAnterior: z.boolean().optional(),
  }).optional(),
  doctorNotes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  if (!isFyAlignInternal(sessionUser.role) && clinicalCase.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  if (['APPROVED_BY_DOCTOR', 'IN_PRODUCTION'].includes(clinicalCase.status)) {
    return NextResponse.json(
      { error: 'Caso travado após aprovação formal (RN-03)' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const validated = updatePrescriptionSchema.parse(body);

    const updateData: any = {};
    if (validated.treatedArches) updateData.treatedArches = validated.treatedArches;
    if (validated.chiefComplaint !== undefined) updateData.chiefComplaint = validated.chiefComplaint;
    if (validated.angleClass !== undefined) updateData.angleClass = validated.angleClass;
    if (validated.doctorNotes !== undefined) updateData.doctorNotes = validated.doctorNotes;

    if (validated.restrictedTeethFdi !== undefined) {
      updateData.restrictedTeethFdi = JSON.stringify(validated.restrictedTeethFdi);
    }
    if (validated.iprPreferences !== undefined) {
      updateData.iprPreferences = JSON.stringify(validated.iprPreferences);
    }
    if (validated.attachmentPreferences !== undefined) {
      updateData.attachmentPreferences = JSON.stringify(validated.attachmentPreferences);
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
      include: { patient: true },
    });

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao atualizar prescrição:', error);
    return NextResponse.json({ error: 'Erro ao atualizar prescrição' }, { status: 500 });
  }
}

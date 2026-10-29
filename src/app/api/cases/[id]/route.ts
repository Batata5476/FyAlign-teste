import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const updateCaseSchema = z.object({
  patientId: z.string().uuid().optional(),
  treatedArches: z.enum(['UPPER', 'LOWER', 'BOTH']).optional(),
  chiefComplaint: z.string().optional(),
  doctorNotes: z.string().optional(),
  restrictedTeethFdi: z.array(z.string()).optional(),
});

const db = prisma as any;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const clinicalCase = await db.case.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      doctor: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          professionalIdCro: true,
        },
      },
      doctorMembership: {
        select: {
          id: true,
          role: true,
          status: true,
          croNumber: true,
          croUf: true,
          croStatus: true,
        },
      },
      clinic: {
        select: {
          id: true,
          tradeName: true,
          legalName: true,
          taxId: true,
          city: true,
          state: true,
        },
      },
      clinicalCondition: true,
      treatmentPlan: true,
      consents: {
        orderBy: { acceptedAt: 'desc' },
      },
      files: {
        orderBy: { slotNumber: 'asc' },
      },
      setups: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso clínico não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ case: clinicalCase });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'CASE_UPDATE',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const existingCase = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!existingCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Casos já aprovados ou em manufatura são imutáveis (RN-03)
  if (['APPROVED_BY_DOCTOR', 'IN_PRODUCTION', 'COMPLETED'].includes(existingCase.status)) {
    return NextResponse.json(
      { error: 'Caso bloqueado para alterações após aprovação médica (RN-03).' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const validated = updateCaseSchema.parse(body);

    const updateData: any = {};
    if (validated.patientId !== undefined) {
      const patient = await prisma.patient.findUnique({
        where: { id: validated.patientId },
      });

      if (!patient || (auth.user.organizationType === 'CLINIC' && patient.clinicId !== auth.user.organizationId)) {
        return NextResponse.json(
          { error: 'Paciente não encontrado para a sua clínica.' },
          { status: 404 }
        );
      }
      updateData.patientId = validated.patientId;
    }
    if (validated.treatedArches !== undefined) updateData.treatedArches = validated.treatedArches;
    if (validated.chiefComplaint !== undefined) updateData.chiefComplaint = validated.chiefComplaint;
    if (validated.doctorNotes !== undefined) updateData.doctorNotes = validated.doctorNotes;
    if (validated.restrictedTeethFdi !== undefined) {
      updateData.restrictedTeethFdi = JSON.stringify(validated.restrictedTeethFdi);
    }

    const updatedCase = await db.case.update({
      where: { id: caseId },
      data: updateData,
      include: {
        patient: true,
        clinicalCondition: true,
        treatmentPlan: true,
      },
    });

    // Trilha de auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: auth.user.activeMembershipId,
        action: 'UPDATE_CASE_DRAFT',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify(updateData),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
    });

    return NextResponse.json({ case: updatedCase });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao atualizar caso:', error);
    return NextResponse.json({ error: 'Erro ao atualizar dados do caso clínico.' }, { status: 500 });
  }
}

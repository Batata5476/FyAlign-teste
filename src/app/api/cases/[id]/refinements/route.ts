import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

const createRefinementSchema = z.object({
  refinementReason: z.string().min(5, {
    message: 'Informe a queixa ou objetivo do refinamento (ex: acabamento estético de incisivos).',
  }),
  treatedArches: z.enum(['UPPER', 'LOWER', 'BOTH']).default('BOTH'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (sessionUser.role !== 'DOCTOR' && sessionUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Apenas Cirurgiões-Dentistas podem solicitar refinamento ortodôntico (RN-02).' },
      { status: 403 }
    );
  }

  const caseId = params.id;
  const parentCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      refinements: true,
      patient: true,
    },
  });

  if (!parentCase) {
    return NextResponse.json({ error: 'Caso original não encontrado' }, { status: 404 });
  }

  if (sessionUser.role === 'DOCTOR' && parentCase.clinicId !== sessionUser.clinicId) {
    return NextResponse.json({ error: 'Acesso negado a este caso clínico' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { refinementReason, treatedArches } = createRefinementSchema.parse(body);

    const refinementIndex = parentCase.refinements.length + 1;
    const baseCode = parentCase.caseCode.split('-R')[0];
    const refinementCaseCode = `${baseCode}-R${refinementIndex}`;

    // Criar o caso filho de refinamento
    const newRefinementCase = await prisma.case.create({
      data: {
        caseCode: refinementCaseCode,
        parentCaseId: caseId,
        patientId: parentCase.patientId,
        doctorId: sessionUser.userId,
        clinicId: parentCase.clinicId,
        status: 'DRAFT',
        treatedArches,
        chiefComplaint: `REFINAMENTO: ${refinementReason}`,
        restrictedTeethFdi: parentCase.restrictedTeethFdi,
        iprPreferences: parentCase.iprPreferences,
        attachmentPreferences: parentCase.attachmentPreferences,
        doctorNotes: `Refinamento #${refinementIndex} originado do caso ${parentCase.caseCode}. Motivo: ${refinementReason}`,
      },
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        caseId: newRefinementCase.id,
        userId: sessionUser.userId,
        action: 'REFINEMENT_REQUESTED',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify({
          parentCaseId: caseId,
          parentCaseCode: parentCase.caseCode,
          refinementCaseCode,
          refinementIndex,
          refinementReason,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Clinical',
      },
    });

    return NextResponse.json({
      message: `Refinamento ${refinementCaseCode} criado com sucesso! Faça o upload dos novos escaneamentos.`,
      refinementCase: newRefinementCase,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Erro ao criar refinamento' }, { status: 500 });
  }
}

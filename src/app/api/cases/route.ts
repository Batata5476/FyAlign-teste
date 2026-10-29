import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const createCaseSchema = z.object({
  patientId: z.string().uuid(),
  treatedArches: z.enum(['UPPER', 'LOWER', 'BOTH']).default('BOTH'),
  chiefComplaint: z.string().optional(),
  angleClass: z.string().optional(),
  restrictedTeethFdi: z.array(z.string()).default([]),
  doctorNotes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  // 1. Guard de Autorização: Exige CASE_READ
  // FINANCE é bloqueado aqui (não tem acesso clínico a casos)
  const auth = await authorize(req, {
    permission: 'CASE_READ',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;

  // 2. Escopo do Recurso: Se for da clínica, filtra estritamente pelo seu organizationId
  const whereClause: any = {};
  if (sessionUser.organizationType === 'CLINIC') {
    whereClause.clinicId = sessionUser.organizationId;
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  if (statusFilter) {
    whereClause.status = statusFilter;
  }

  const cases = await prisma.case.findMany({
    where: whereClause,
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          birthDate: true,
          gender: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
          professionalIdCro: true,
        },
      },
      setups: {
        where: { status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
      files: {
        select: {
          id: true,
          slotNumber: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ cases });
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, {
    permission: 'CASE_CREATE',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;

  if (sessionUser.organizationType !== 'CLINIC') {
    return NextResponse.json(
      { error: 'Apenas membros de clínica podem criar casos clínicos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const validated = createCaseSchema.parse(body);

    // Valida se o paciente pertence à clínica do usuário autenticado
    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
    });

    if (!patient || patient.clinicId !== sessionUser.organizationId) {
      return NextResponse.json(
        { error: 'Paciente não encontrado para a sua clínica.' },
        { status: 404 }
      );
    }

    // Gera código sequencial amigável do caso (ex: FY-2026-003)
    const count = await prisma.case.count();
    const caseCode = `FY-2026-${String(count + 1).padStart(3, '0')}`;

    const newCase = await prisma.case.create({
      data: {
        caseCode,
        patientId: validated.patientId,
        doctorId: sessionUser.userId,
        doctorMembershipId: sessionUser.activeMembershipId,
        clinicId: sessionUser.organizationId,
        status: 'DRAFT',
        treatedArches: validated.treatedArches,
        chiefComplaint: validated.chiefComplaint,
        angleClass: validated.angleClass,
        restrictedTeethFdi: JSON.stringify(validated.restrictedTeethFdi),
        doctorNotes: validated.doctorNotes,
      },
      include: {
        patient: true,
      },
    });

    // Registra log de auditoria
    await prisma.auditLog.create({
      data: {
        caseId: newCase.id,
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'CREATE_CASE_DRAFT',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify({ caseCode, patientId: validated.patientId }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
    });

    return NextResponse.json({ case: newCase }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao criar caso:', error);
    return NextResponse.json({ error: 'Erro ao criar caso clínico.' }, { status: 500 });
  }
}

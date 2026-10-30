import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const createPatientSchema = z.object({
  fullName: z.string().min(3, 'Nome completo deve ter pelo menos 3 caracteres'),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
  gender: z.string().min(1, 'Gênero é obrigatório'),
  phone: z.string().min(8, 'Telefone de contato é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  tcleSigned: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  // 1. Guard de Autorização: Apenas papéis com PATIENT_READ (Doctor, Clinic Admin, Assistant, Super Admin, Support)
  // FINANCE e PRODUCTION_QC são bloqueados aqui com 403 Forbidden (Data Minimization)
  const auth = await authorize(req, {
    permission: 'PATIENT_READ',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;

  const whereClause: any = {};
  if (sessionUser.organizationType === 'CLINIC') {
    whereClause.clinicId = sessionUser.organizationId;
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || searchParams.get('q');
  if (search && search.trim()) {
    const term = search.trim();
    const cleanCode = term.replace(/^PAC-/i, '');
    whereClause.OR = [
      { fullName: { contains: term } },
      { email: { contains: term } },
      { phone: { contains: term } },
      { id: { contains: cleanCode } },
    ];
  }

  const patients = await prisma.patient.findMany({
    where: whereClause,
    include: {
      clinic: {
        select: {
          id: true,
          tradeName: true,
        },
      },
      externalLinks: {
        orderBy: { updatedAt: 'desc' },
      },
      cases: {
        select: {
          id: true,
          caseCode: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ patients });
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req, {
    permission: 'PATIENT_CREATE',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;

  if (sessionUser.organizationType !== 'CLINIC') {
    return NextResponse.json(
      { error: 'Apenas membros de clínica podem cadastrar pacientes.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const validated = createPatientSchema.parse(body);

    const patient = await prisma.patient.create({
      data: {
        clinicId: sessionUser.organizationId,
        fullName: validated.fullName,
        birthDate: new Date(validated.birthDate),
        gender: validated.gender,
        phone: validated.phone,
        email: validated.email || null,
        tcleSigned: validated.tcleSigned,
      },
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'CREATE_PATIENT',
        entityAffected: 'Patient',
        payloadDiff: JSON.stringify({ patientId: patient.id, fullName: patient.fullName }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      },
    });

    return NextResponse.json({ success: true, patient }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao cadastrar paciente:', error);
    return NextResponse.json({ error: 'Erro ao cadastrar paciente' }, { status: 500 });
  }
}

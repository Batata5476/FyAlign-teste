import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const patientId = params.id;

  // 1. Guard Central de Autorização:
  // - Revalida Sessão e Status
  // - Exige permissão PATIENT_READ (FINANCE e PRODUCTION_QC são bloqueados com 403)
  // - Escopo: Bloqueia Cross-tenant IDOR (se for de outra clínica, devolve 404)
  const auth = await authorize(req, {
    permission: 'PATIENT_READ',
    resource: { type: 'PATIENT', id: patientId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      cases: {
        select: {
          id: true,
          caseCode: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ patient });
}

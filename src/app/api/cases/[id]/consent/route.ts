import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { CaseConsentSchema } from '@/lib/types/clinical';

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

  const userCtx = { role: auth.user.role, permissions: auth.user.permissions };
  if (!hasPermission(userCtx, 'FILE_READ') && !hasPermission(userCtx, 'CASE_UPDATE')) {
    return NextResponse.json(
      { error: 'Acesso negado aos termos clínicos de consentimento.', code: 'FORBIDDEN_PERMISSION' },
      { status: 403 }
    );
  }

  const consents = await db.caseConsent.findMany({
    where: { caseId },
    orderBy: { acceptedAt: 'desc' },
  });

  return NextResponse.json({ consents });
}

export async function POST(
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

  const clinicalCase = await db.case.findUnique({
    where: { id: caseId },
    include: { patient: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  if (['APPROVED_BY_DOCTOR', 'IN_PRODUCTION', 'COMPLETED'].includes(clinicalCase.status)) {
    return NextResponse.json(
      { error: 'Caso bloqueado para alterações após aprovação médica (RN-03).' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const validated = CaseConsentSchema.parse(body);

    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const acceptedAt = new Date();

    const consent = await db.caseConsent.create({
      data: {
        caseId,
        policyVersion: validated.policyVersion,
        policyHash: validated.policyHash,
        scrollCompleted: validated.scrollCompleted,
        signatureKey: validated.signatureKey || null,
        signatureHash: validated.signatureHash || null,
        ipAddress,
        userAgent,
        acceptedAt,
      },
    });

    // Atualiza campo legado tcleSigned no paciente para manter compatibilidade
    if (!clinicalCase.patient.tcleSigned) {
      await db.patient.update({
        where: { id: clinicalCase.patientId },
        data: { tcleSigned: true },
      });
    }

    // Registra trilha de auditoria legal
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: auth.user.userId,
        organizationId: auth.user.organizationId,
        membershipId: auth.user.activeMembershipId,
        action: 'RECORD_CASE_CONSENT',
        entityAffected: 'CaseConsent',
        payloadDiff: JSON.stringify({
          consentId: consent.id,
          policyVersion: validated.policyVersion,
          scrollCompleted: validated.scrollCompleted,
        }),
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ consent }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro ao registrar consentimento:', error);
    return NextResponse.json(
      { error: 'Erro interno ao registrar consentimento.' },
      { status: 500 }
    );
  }
}

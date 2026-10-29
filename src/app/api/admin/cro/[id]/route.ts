import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

const db = prisma as any;

const decisionSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED'], {
    errorMap: () => ({ message: 'A decisão deve ser VERIFIED ou REJECTED' }),
  }),
  notes: z.string().optional(),
});

/**
 * PATCH /api/admin/cro/[id]
 * Valida ou Rejeita a documentação de habilitação CRO de um Cirurgião-Dentista.
 * Grava trilha de auditoria completa com identidade do administrador, motivo e timestamp.
 * Acesso exclusivo: SUPER_ADMIN (SYSTEM_ADMIN).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'SYSTEM_ADMIN' });
  if (!auth.authorized) {
    return auth.response;
  }

  const membershipId = params.id;

  try {
    const body = await req.json();
    const { decision, notes } = decisionSchema.parse(body);

    const targetMembership = await db.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        organization: { select: { id: true, tradeName: true } },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Registro de vínculo profissional não encontrado.' },
        { status: 404 }
      );
    }

    if (targetMembership.role !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'Apenas vínculos de Cirurgião-Dentista (DOCTOR) passam por validação de CRO.' },
        { status: 400 }
      );
    }

    const previousCroStatus = targetMembership.croStatus;

    // 1. Atualiza o status do CRO no banco de dados (fonte da verdade)
    const updated = await db.membership.update({
      where: { id: membershipId },
      data: {
        croStatus: decision,
        croVerifiedAt: decision === 'VERIFIED' ? new Date() : null,
      },
    });

    // 2. Trilha de Auditoria Imutável da Decisão Regulatória
    await db.auditLog.create({
      data: {
        userId: auth.user.userId,
        organizationId: targetMembership.organizationId,
        membershipId: targetMembership.id,
        action: decision === 'VERIFIED' ? 'CRO_VERIFIED' : 'CRO_REJECTED',
        entityAffected: 'Membership',
        payloadDiff: JSON.stringify({
          targetDoctorId: targetMembership.userId,
          targetDoctorName: targetMembership.user.fullName,
          targetDoctorEmail: targetMembership.user.email,
          clinicName: targetMembership.organization.tradeName,
          croNumber: targetMembership.croNumber,
          croUf: targetMembership.croUf,
          previousCroStatus,
          decision,
          justificationNotes: notes || null,
          decisionTimestamp: new Date().toISOString(),
          decisionAdminId: auth.user.userId,
          decisionAdminName: auth.user.fullName,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/PlatformAdmin',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Habilitação profissional do Dr(a). ${targetMembership.user.fullName} foi marcada como ${
        decision === 'VERIFIED' ? 'APROVADA / HABILITADA' : 'REJEITADA'
      }.`,
      membership: {
        id: updated.id,
        croStatus: updated.croStatus,
        croVerifiedAt: updated.croVerifiedAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Decisão inválida' },
        { status: 400 }
      );
    }
    console.error('Erro na decisão de CRO:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar validação de CRO.' },
      { status: 500 }
    );
  }
}

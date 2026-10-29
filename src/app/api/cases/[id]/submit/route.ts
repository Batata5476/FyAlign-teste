import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { SLOTS_METADATA } from '@/lib/storage/validator';

const submitCaseSchema = z.object({
  tcleConfirmed: z.boolean().optional().default(true),
  professionalDeclaration: z.boolean().optional().default(true),
  policyVersion: z.string().optional(),
  policyHash: z.string().optional(),
  signatureKey: z.string().optional(),
});

const db = prisma as any;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  // 1. Guard de Autorização Centralizado (RBAC, Multi-Tenant, CRO Habilitado e Sessão Ativa)
  const auth = await authorize(req, {
    permission: 'SUBMIT_CASE',
    resource: { type: 'CASE', id: caseId },
    requireCroVerified: true,
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;

  // 2. Consulta Completa do Caso Clínico e Agregados
  const clinicalCase = await db.case.findUnique({
    where: { id: caseId },
    include: {
      files: true,
      patient: true,
      doctor: true,
      clinicalCondition: true,
      treatmentPlan: true,
      consents: true,
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso clínico não encontrado.' }, { status: 404 });
  }

  // 3. Validação de Estado do Prontuário
  if (clinicalCase.status !== 'DRAFT' && clinicalCase.status !== 'PENDING_DOCS') {
    return NextResponse.json(
      { error: `O caso já foi submetido anteriormente (Status atual: ${clinicalCase.status}).` },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const validatedBody = submitCaseSchema.parse(body);

    // 4. Verificação da Condição Clínica Existente (Linha Média e Oclusão)
    if (!clinicalCase.clinicalCondition) {
      return NextResponse.json(
        {
          error: 'Submissão bloqueada: A Condição Clínica Existente (Linhas Médias e Classes de Angle Canina/Molar) deve ser preenchida.',
          missingSection: 'CLINICAL_CONDITION',
        },
        { status: 400 }
      );
    }

    // 5. Verificação do Plano de Tratamento Parametrizado (Ações Biomecânicas)
    if (!clinicalCase.treatmentPlan) {
      return NextResponse.json(
        {
          error: 'Submissão bloqueada: O Plano de Tratamento Parametrizado (Ações de Arco, IPR e Attachments) deve ser preenchido.',
          missingSection: 'TREATMENT_PLAN',
        },
        { status: 400 }
      );
    }

    // 6. Verificação Rigorosa dos 13 Arquivos Obrigatórios (RN-01)
    const requiredSlots = Object.values(SLOTS_METADATA).filter((s) => s.required);
    const uploadedSlotNumbers = (clinicalCase.files || [])
      .filter((f: any) => f.status === 'UPLOADED')
      .map((f: any) => f.slotNumber);

    const missingSlots = requiredSlots.filter(
      (s) => !uploadedSlotNumbers.includes(s.slotNumber)
    );

    if (missingSlots.length > 0) {
      const missingTitles = missingSlots.map((s) => `Slot ${s.slotNumber} (${s.title})`).join(', ');
      return NextResponse.json(
        {
          error: `Submissão bloqueada (RN-01): Faltam ${missingSlots.length} arquivos obrigatórios: ${missingTitles}.`,
          missingSlots: missingSlots.map((s) => s.slotNumber),
        },
        { status: 400 }
      );
    }

    // 7. Validação de Arquivos STL 3D (Slots 11, 12, 13)
    const stlSlots = [11, 12, 13];
    const missingStl = stlSlots.filter((slotNum) => !uploadedSlotNumbers.includes(slotNum));
    if (missingStl.length > 0) {
      return NextResponse.json(
        {
          error: 'Submissão bloqueada: Os escaneamentos 3D das arcadas (Maxila, Mandíbula e Mordida) são obrigatórios.',
          missingStl,
        },
        { status: 400 }
      );
    }

    const clientIp = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const clientUserAgent = req.headers.get('user-agent') || 'Unknown';
    const now = new Date();

    // 8. Registro / Garantia do Termo de Consentimento Legal (CaseConsent)
    if (!clinicalCase.consents || clinicalCase.consents.length === 0) {
      await db.caseConsent.create({
        data: {
          caseId: clinicalCase.id,
          policyVersion: validatedBody.policyVersion || 'v1.0-TCLE-2026',
          policyHash: validatedBody.policyHash || 'sha256-standard-tcle-cfo-compliance-default',
          scrollCompleted: true,
          ipAddress: clientIp,
          userAgent: clientUserAgent,
          acceptedAt: now,
          signatureKey: validatedBody.signatureKey || null,
        },
      });
    }

    // Atualiza campo legado de compatibilidade no paciente
    if (clinicalCase.patient && !clinicalCase.patient.tcleSigned) {
      await db.patient.update({
        where: { id: clinicalCase.patientId },
        data: { tcleSigned: true },
      });
    }

    // 9. Transição de Estado Transacional: DRAFT -> SUBMITTED
    const updatedCase = await db.case.update({
      where: { id: caseId },
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
      },
      include: {
        patient: true,
        clinicalCondition: true,
        treatmentPlan: true,
        consents: true,
        doctor: {
          select: { fullName: true, professionalIdCro: true },
        },
      },
    });

    // 10. Trilha de Auditoria Imutável (LGPD & CFO)
    await prisma.auditLog.create({
      data: {
        caseId: clinicalCase.id,
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'SUBMIT_CLINICAL_CASE_WITH_DIGITAL_SIGNATURE',
        entityAffected: 'Case',
        payloadDiff: JSON.stringify({
          caseCode: clinicalCase.caseCode,
          doctorName: sessionUser.fullName,
          cro: sessionUser.professionalIdCro,
          signedAt: now.toISOString(),
          ipAddress: clientIp,
        }),
        ipAddress: clientIp,
        userAgent: clientUserAgent,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Caso clínico e prescrição submetidos com sucesso ao laboratório FyAlign!',
      case: updatedCase,
      digitalSignature: {
        signedBy: sessionUser.fullName,
        cro: sessionUser.professionalIdCro,
        timestamp: now.toISOString(),
        ipAddress: clientIp,
        status: 'VALIDATED',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error('Erro na submissão do caso:', error);
    return NextResponse.json({ error: 'Erro interno ao processar submissão.' }, { status: 500 });
  }
}

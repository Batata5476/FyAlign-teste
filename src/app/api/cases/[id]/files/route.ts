import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { SLOTS_METADATA } from '@/lib/storage/validator';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  // Guard de Autorização: Exige CASE_READ e escopo do caso
  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { files: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  // Monta mapa consolidado de todos os 13 slots
  const slotsStatus = Object.values(SLOTS_METADATA).map((meta) => {
    const uploadedFile = clinicalCase.files.find((f) => f.slotNumber === meta.slotNumber);
    return {
      slotNumber: meta.slotNumber,
      title: meta.title,
      category: meta.category,
      description: meta.description,
      allowedExtensions: meta.allowedExtensions,
      maxSizeBytes: meta.maxSizeBytes,
      required: meta.required,
      file: uploadedFile || null,
    };
  });

  const totalRequired = slotsStatus.filter((s) => s.required).length;
  const totalCompleted = slotsStatus.filter((s) => s.required && s.file?.status === 'UPLOADED').length;
  const progressPercent = Math.round((totalCompleted / totalRequired) * 100);

  return NextResponse.json({
    caseId,
    caseCode: clinicalCase.caseCode,
    status: clinicalCase.status,
    slots: slotsStatus,
    progress: {
      totalRequired,
      totalCompleted,
      progressPercent,
      isComplete: totalCompleted >= totalRequired,
    },
  });
}

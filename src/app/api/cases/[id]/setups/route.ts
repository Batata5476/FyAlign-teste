import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { formatPatientCode } from '@/lib/patient360/overview-aggregator';
import { s3Client } from '@/lib/storage/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';
import { validate3DMeshBuffer } from '@/lib/storage/validator';
import { parseStageFileName, analyzeStageFiles } from '@/lib/three/stageParser';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'SETUP_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const sessionUser = auth.user;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };
  const canReadPatient = hasPermission(userCtx, 'PATIENT_READ');

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      doctor: {
        select: {
          id: true,
          fullName: true,
          professionalIdCro: true,
        },
      },
      setups: {
        orderBy: { versionNumber: 'desc' },
        include: {
          stages: {
            orderBy: { stageIndex: 'asc' },
          },
          approvedByDoctor: {
            select: { fullName: true, professionalIdCro: true },
          },
        },
      },
    },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  // Mapear setups resolvendo URLs temporárias dos modelos para cada estágio
  const enrichedSetups = clinicalCase.setups.map((setup: any) => ({
    ...setup,
    iprSchedule: setup.iprSchedule ? JSON.parse(setup.iprSchedule) : [],
    attachmentSchedule: setup.attachmentSchedule ? JSON.parse(setup.attachmentSchedule) : [],
    stages: setup.stages.map((st: any) => ({
      id: st.id,
      stageNumber: st.stageIndex,
      stageIndex: st.stageIndex,
      upperStorageKey: st.upperMeshStorageKey,
      lowerStorageKey: st.lowerMeshStorageKey,
      upperModelUrl: st.upperMeshStorageKey
        ? `/api/cases/${caseId}/stages/${st.id}/mesh?arch=upper`
        : undefined,
      lowerModelUrl: st.lowerMeshStorageKey
        ? `/api/cases/${caseId}/stages/${st.id}/mesh?arch=lower`
        : undefined,
      movements: st.toothTransformMatrices ? JSON.parse(st.toothTransformMatrices) : undefined,
    })),
  }));

  const sanitizedPatient = canReadPatient
    ? {
        ...clinicalCase.patient,
        patientCode: formatPatientCode(clinicalCase.patient.id),
        piiMinimized: false,
      }
    : {
        id: clinicalCase.patient.id,
        patientCode: formatPatientCode(clinicalCase.patient.id),
        fullName: clinicalCase.patient.fullName,
        birthDate: null,
        gender: null,
        phone: null,
        email: null,
        tcleSigned: clinicalCase.patient.tcleSigned,
        clinicId: clinicalCase.patient.clinicId,
        piiMinimized: true,
      };

  return NextResponse.json({
    caseId,
    caseCode: clinicalCase.caseCode,
    patient: sanitizedPatient,
    doctor: clinicalCase.doctor,
    setups: enrichedSetups,
    activeSetup: enrichedSetups[0] || null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const auth = await authorize(req, {
    permission: 'SETUP_PUBLISH',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const sessionUser = auth.user;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { setups: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const highestVersion = clinicalCase.setups.reduce(
      (max: number, s: { versionNumber: number }) => (s.versionNumber > max ? s.versionNumber : max),
      0
    );
    const nextVersion = highestVersion + 1;

    let upperAlignersCount = 14;
    let lowerAlignersCount = 14;
    let iprScheduleData: any = null;
    let attachmentScheduleData: any = null;
    let plannerComments = `Planejamento ortodôntico Setup v${nextVersion}`;
    const stagesToCreate: Array<{
      stageIndex: number;
      upperStorageKey?: string | null;
      lowerStorageKey?: string | null;
      toothTransformMatrices?: string | null;
    }> = [];

    // 1. Processamento via FormData (Multi-STL Drag-and-Drop do Planner)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const rawFiles: File[] = [];

      formData.forEach((value) => {
        if (value instanceof File && value.name) {
          rawFiles.push(value);
        }
      });

      if (rawFiles.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum arquivo STL foi enviado no formulário.' },
          { status: 400 }
        );
      }

      // Validação léxica e sequencial dos arquivos selecionados
      const fileSummaries = rawFiles.map((f) => ({ name: f.name, size: f.size }));
      const analysis = analyzeStageFiles(fileSummaries);

      if (!analysis.isValid) {
        return NextResponse.json(
          {
            error: `Validação dos arquivos de estágios falhou: ${analysis.errors.join(' | ')}`,
            errors: analysis.errors,
            unrecognizedFiles: analysis.unrecognizedFiles,
            missingFiles: analysis.missingFiles,
          },
          { status: 400 }
        );
      }

      const formComments = formData.get('plannerComments');
      if (typeof formComments === 'string' && formComments.trim()) {
        plannerComments = formComments.trim();
      }

      const formIpr = formData.get('iprSchedule');
      if (typeof formIpr === 'string' && formIpr.trim()) {
        try {
          iprScheduleData = JSON.parse(formIpr);
        } catch {}
      }

      const formAtt = formData.get('attachmentSchedule');
      if (typeof formAtt === 'string' && formAtt.trim()) {
        try {
          attachmentScheduleData = JSON.parse(formAtt);
        } catch {}
      }

      // Validação geométrica e gravação segura dos arquivos físicos no storage-vault
      const stagesMap = new Map<number, { upperKey?: string; lowerKey?: string }>();

      for (const file of rawFiles) {
        const parsed = parseStageFileName(file.name, file.size);
        if (!parsed) continue;

        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Validação estrita do cabeçalho e triângulos da malha 3D
        const meshValidation = validate3DMeshBuffer(buffer, parsed.extension);
        if (!meshValidation.valid) {
          return NextResponse.json(
            {
              error: `Arquivo ${file.name} possui geometria inválida ou corrompida: ${meshValidation.details}`,
            },
            { status: 400 }
          );
        }

        const anonymizedKey = `clinics/${clinicalCase.clinicId}/cases/${caseId}/setups/v${nextVersion}/stage_${parsed.stageNumber}_${parsed.arch.toLowerCase()}_${crypto.randomUUID()}${parsed.extension}`;
        const localPath = path.join(process.cwd(), 'storage-vault', anonymizedKey);
        const dir = path.dirname(localPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(localPath, buffer);

        // Upload opcional para S3 em produção
        if (s3Client) {
          try {
            await s3Client.send(
              new PutObjectCommand({
                Bucket: env.AWS_S3_BUCKET_NAME,
                Key: anonymizedKey,
                Body: buffer,
                ContentType: 'application/sla',
              })
            );
          } catch (s3Err) {
            console.error('Falha no upload para S3 da malha do estágio:', s3Err);
          }
        }

        if (!stagesMap.has(parsed.stageNumber)) {
          stagesMap.set(parsed.stageNumber, {});
        }
        const stageEntry = stagesMap.get(parsed.stageNumber)!;
        if (parsed.arch === 'UPPER') {
          stageEntry.upperKey = anonymizedKey;
        } else {
          stageEntry.lowerKey = anonymizedKey;
        }
      }

      const sortedStageNums = Array.from(stagesMap.keys()).sort((a, b) => a - b);
      const maxStageNum = sortedStageNums[sortedStageNums.length - 1] ?? 0;
      upperAlignersCount = maxStageNum;
      lowerAlignersCount = maxStageNum;

      for (const stageNum of sortedStageNums) {
        const entry = stagesMap.get(stageNum)!;
        stagesToCreate.push({
          stageIndex: stageNum,
          upperStorageKey: entry.upperKey || null,
          lowerStorageKey: entry.lowerKey || null,
          toothTransformMatrices: null,
        });
      }
    } else {
      // 2. Processamento via JSON DTO
      const body = await req.json();
      upperAlignersCount = body.upperAlignersCount ?? 14;
      lowerAlignersCount = body.lowerAlignersCount ?? 14;
      iprScheduleData = body.iprSchedule || null;
      attachmentScheduleData = body.attachmentSchedule || null;
      if (body.plannerComments) plannerComments = body.plannerComments;

      if (Array.isArray(body.stages) && body.stages.length > 0) {
        for (const st of body.stages) {
          stagesToCreate.push({
            stageIndex: st.stageNumber ?? st.stageIndex ?? 0,
            upperStorageKey: st.upperStorageKey || st.upperMeshStorageKey || null,
            lowerStorageKey: st.lowerStorageKey || st.lowerMeshStorageKey || null,
            toothTransformMatrices: st.movements ? JSON.stringify(st.movements) : null,
          });
        }
      } else {
        const totalStages = Math.max(body.stagesCount || 14, 1);
        for (let i = 0; i <= totalStages; i++) {
          stagesToCreate.push({
            stageIndex: i,
            upperStorageKey: null,
            lowerStorageKey: null,
            toothTransformMatrices: JSON.stringify({ progress: i / totalStages }),
          });
        }
      }
    }

    // Criar o Setup versionado com persistência exclusiva de storageKey
    const newSetup = await prisma.setup.create({
      data: {
        caseId,
        versionNumber: nextVersion,
        status: 'PUBLISHED',
        upperAlignersCount,
        lowerAlignersCount,
        iprSchedule: typeof iprScheduleData === 'object' && iprScheduleData !== null ? JSON.stringify(iprScheduleData) : iprScheduleData,
        attachmentSchedule: typeof attachmentScheduleData === 'object' && attachmentScheduleData !== null ? JSON.stringify(attachmentScheduleData) : attachmentScheduleData,
        plannerComments,
      },
    });

    // Criar registros atômicos de SetupStage com referências seguras
    for (const st of stagesToCreate) {
      await prisma.setupStage.create({
        data: {
          setupId: newSetup.id,
          stageIndex: st.stageIndex,
          upperMeshStorageKey: st.upperStorageKey,
          lowerMeshStorageKey: st.lowerStorageKey,
          toothTransformMatrices: st.toothTransformMatrices,
        },
      });
    }

    // Transicionar status do caso para AGUARDANDO APROVAÇÃO DO DOUTOR
    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: 'WAITING_DOCTOR_APPROVAL',
        assignedPlannerId: sessionUser.userId,
      },
    });

    // Trilha de auditoria
    await prisma.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        action: 'SETUP_PUBLISHED',
        entityAffected: 'Setup',
        payloadDiff: JSON.stringify({
          setupId: newSetup.id,
          versionNumber: nextVersion,
          stagesCount: stagesToCreate.length,
          hasRealMeshes: stagesToCreate.some((s) => s.upperStorageKey || s.lowerStorageKey),
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/CAD',
      },
    });

    // Retornar o Setup completo enriquecido com URLs de streaming temporárias
    const createdWithStages = await prisma.setup.findUnique({
      where: { id: newSetup.id },
      include: {
        stages: { orderBy: { stageIndex: 'asc' } },
        approvedByDoctor: { select: { fullName: true, professionalIdCro: true } },
      },
    });

    const enrichedSetup = {
      ...createdWithStages,
      iprSchedule: createdWithStages?.iprSchedule ? JSON.parse(createdWithStages.iprSchedule) : [],
      attachmentSchedule: createdWithStages?.attachmentSchedule ? JSON.parse(createdWithStages.attachmentSchedule) : [],
      stages: createdWithStages?.stages.map((st: any) => ({
        id: st.id,
        stageNumber: st.stageIndex,
        stageIndex: st.stageIndex,
        upperStorageKey: st.upperMeshStorageKey,
        lowerStorageKey: st.lowerMeshStorageKey,
        upperModelUrl: st.upperMeshStorageKey
          ? `/api/cases/${caseId}/stages/${st.id}/mesh?arch=upper`
          : undefined,
        lowerModelUrl: st.lowerMeshStorageKey
          ? `/api/cases/${caseId}/stages/${st.id}/mesh?arch=lower`
          : undefined,
        movements: st.toothTransformMatrices ? JSON.parse(st.toothTransformMatrices) : undefined,
      })) || [],
    };

    return NextResponse.json({
      success: true,
      message: `Setup virtual v${nextVersion} publicado com sucesso!`,
      setup: enrichedSetup,
    });
  } catch (error: any) {
    console.error('Erro ao publicar setup virtual:', error);
    return NextResponse.json({ error: error.message || 'Erro ao publicar setup' }, { status: 500 });
  }
}


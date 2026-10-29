import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { CreateShipmentSchema } from '@/lib/types/production';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'CASE_READ' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { clinicId: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  // Anti-IDOR
  if (sessionUser.organizationType === 'CLINIC' && clinicalCase.clinicId !== sessionUser.organizationId) {
    return NextResponse.json({ error: 'Caso não encontrado ou acesso não autorizado.' }, { status: 404 });
  }

  const shipments = await prisma.shipment.findMany({
    where: { caseId },
    include: {
      items: {
        include: {
          productionUnit: {
            select: { id: true, unitCode: true, type: true, quantityPairs: true, stagesDescription: true },
          },
        },
      },
      dispatchedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ shipments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize(req, { permission: 'SHIPMENT_DISPATCH' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const caseId = params.id;

  const clinicalCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { commercialContract: true },
  });

  if (!clinicalCase) {
    return NextResponse.json({ error: 'Caso não encontrado.' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = CreateShipmentSchema.parse(body);

    const now = new Date();
    const year = now.getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const shipmentCode = `SHP-${year}-${randomSuffix}`;

    // Execução Atômica de Despacho com Garantia de Integridade Quantitativa
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar e debitar saldo de cada unidade de produção
      for (const item of data.items) {
        const unit = await tx.productionUnit.findUnique({
          where: { id: item.productionUnitId },
        });

        if (!unit || unit.caseId !== caseId) {
          throw new Error(`Unidade de produção ${item.productionUnitId} não encontrada para este caso.`);
        }

        // Invariante SH-03: Unidade deve estar aprovada no QC
        if (unit.status !== 'QC_PASSED' && unit.shippedQuantity === 0) {
          throw new Error(
            `Invariante violada (SH-03): A unidade ${unit.unitCode} está em estado '${unit.status}' e não foi liberada pelo Controle de Qualidade para expedição.`
          );
        }

        // Invariante SH-02: Quantidade não pode exceder o saldo disponível
        const availableBalance = unit.quantityPairs - unit.shippedQuantity;
        if (item.quantityShipped > availableBalance) {
          throw new Error(
            `Invariante violada (SH-02): Tentativa de expedir ${item.quantityShipped} pares da unidade ${unit.unitCode}, mas restam apenas ${availableBalance} pares disponíveis.`
          );
        }

        const newShipped = unit.shippedQuantity + item.quantityShipped;
        const newStatus = newShipped === unit.quantityPairs ? 'SHIPPED' : unit.status;

        await tx.productionUnit.update({
          where: { id: unit.id },
          data: {
            shippedQuantity: newShipped,
            status: newStatus,
          },
        });
      }

      // 2. Criar a Remessa (Shipment)
      const createdShipment = await tx.shipment.create({
        data: {
          caseId,
          shipmentCode,
          carrierName: data.carrierName,
          trackingCode: data.trackingCode,
          plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
          shippedAt: now,
          status: 'DISPATCHED',
          notes: data.notes || null,
          dispatchedById: sessionUser.userId,
        },
      });

      // 3. Criar os Itens da Remessa (ShipmentItems)
      for (const item of data.items) {
        await tx.shipmentItem.create({
          data: {
            shipmentId: createdShipment.id,
            productionUnitId: item.productionUnitId,
            quantityShipped: item.quantityShipped,
          },
        });
      }

      // 4. Auditoria Imutável
      await tx.auditLog.create({
        data: {
          caseId,
          userId: sessionUser.userId,
          organizationId: sessionUser.organizationId,
          membershipId: sessionUser.activeMembershipId,
          action: 'SHIPMENT_DISPATCHED',
          entityAffected: 'Shipment',
          payloadDiff: JSON.stringify({
            shipmentId: createdShipment.id,
            shipmentCode,
            carrierName: data.carrierName,
            trackingCode: data.trackingCode,
            items: data.items,
          }),
          ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'FyAlign/Logistics',
        },
      });

      return createdShipment;
    });

    return NextResponse.json({
      message: `Remessa ${shipmentCode} despachada com sucesso.`,
      shipment: result,
    }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Erro ao despachar remessa.' }, { status: 400 });
  }
}

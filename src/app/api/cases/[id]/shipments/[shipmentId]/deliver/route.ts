import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; shipmentId: string } }
) {
  const auth = await authorize(req, { permission: 'SHIPMENT_DELIVERY_CONFIRM' });
  if (!auth.authorized) return auth.response;

  const { user: sessionUser } = auth;
  const { id: caseId, shipmentId } = params;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment || shipment.caseId !== caseId) {
    return NextResponse.json({ error: 'Remessa não encontrada para este caso.' }, { status: 404 });
  }

  if (shipment.status === 'DELIVERED') {
    return NextResponse.json(
      { message: 'Esta remessa já foi confirmada como entregue anteriormente.', shipment },
      { status: 200 }
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Atualizar remessa para DELIVERED
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: now,
      },
    });

    // 2. Avaliação de Conclusão Global do Caso (Invariante SH-05 / SH-06)
    const clinicalCase = await tx.case.findUnique({
      where: { id: caseId },
      include: {
        commercialContract: {
          include: {
            productionUnits: true,
          },
        },
        shipments: true,
        refinementRequests: true,
      },
    });

    let caseCompleted = false;

    if (clinicalCase && clinicalCase.commercialContract) {
      const contract = clinicalCase.commercialContract;
      const allShipmentsDelivered = clinicalCase.shipments.every(
        (s) => s.id === shipment.id || s.status === 'DELIVERED'
      );

      const totalShippedPairs = contract.productionUnits.reduce(
        (sum, u) => sum + u.shippedQuantity,
        0
      );

      const allUnitsShipped = contract.productionUnits.every(
        (u) => u.shippedQuantity === u.quantityPairs
      );

      const hasPendingRefinements = clinicalCase.refinementRequests.some(
        (r) => r.clinicalStatus === 'PENDING_DOCTOR_APPROVAL' || r.commercialStatus === 'PENDING_COMMERCIAL_APPROVAL'
      );

      // Invariante de Conclusão: Todas as entregas cumpridas, todas as unidades enviadas, nenhum refinamento pendente
      if (
        allShipmentsDelivered &&
        allUnitsShipped &&
        totalShippedPairs >= contract.contractedAligners &&
        !hasPendingRefinements
      ) {
        await tx.case.update({
          where: { id: caseId },
          data: { status: 'COMPLETED' },
        });
        caseCompleted = true;
      }
    }

    // 3. Auditoria
    await tx.auditLog.create({
      data: {
        caseId,
        userId: sessionUser.userId,
        organizationId: sessionUser.organizationId,
        membershipId: sessionUser.activeMembershipId,
        action: 'SHIPMENT_DELIVERED',
        entityAffected: 'Shipment',
        payloadDiff: JSON.stringify({
          shipmentId: shipment.id,
          shipmentCode: shipment.shipmentCode,
          deliveredAt: now.toISOString(),
          caseCompleted,
        }),
        ipAddress: req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'FyAlign/Logistics',
      },
    });

    return { updatedShipment, caseCompleted };
  });

  return NextResponse.json({
    message: result.caseCompleted
      ? `Entrega confirmada. Todas as obrigações contratuais foram concluídas: Caso transicionado para COMPLETED.`
      : `Entrega da remessa confirmada com sucesso. Existem outras entregas ou unidades pendentes para o caso.`,
    shipment: result.updatedShipment,
    caseCompleted: result.caseCompleted,
  });
}

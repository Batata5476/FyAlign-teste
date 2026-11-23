import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { hasPermission } from '@/lib/auth/rbac';
import { formatPatientCode } from '@/lib/patient360/overview-aggregator';

export async function GET(req: NextRequest) {
  const auth = await authorize(req, {
    permission: 'CASE_READ',
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const { user: sessionUser } = auth;
  const userCtx = { role: sessionUser.role, permissions: sessionUser.permissions };

  if (!hasPermission(userCtx, 'ORDER_READ') && !hasPermission(userCtx, 'AUDIT_EXPORT')) {
    return NextResponse.json(
      { error: 'Permissão ORDER_READ ou AUDIT_EXPORT necessária para exportar relatórios.' },
      { status: 403 }
    );
  }

  const canReadPatient = hasPermission(userCtx, 'PATIENT_READ');
  const canReadContract = hasPermission(userCtx, 'CONTRACT_READ');
  const isClinic = sessionUser.organizationType === 'CLINIC';

  const cases = await prisma.case.findMany({
    where: isClinic
      ? {
          clinicId: sessionUser.organizationId,
        }
      : {},
    include: {
      patient: {
        select: { id: true, fullName: true },
      },
      doctor: {
        select: { id: true, fullName: true, professionalIdCro: true },
      },
      clinic: {
        select: { id: true, tradeName: true },
      },
      commercialContract: {
        select: { packageName: true, totalPriceCents: true, status: true },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const headers = [
    'Código do Caso',
    'Paciente',
    'Dentista',
    'CRO',
    'Clínica',
    'Status',
    'Arcos Tratados',
    'Data de Envio',
    'Plano',
    'Valor (R$)',
    'Pagamento',
    'Rastreamento',
  ];

  const rows = cases.map((c: any) => {
    const order = c.orders[0];
    const contract = c.commercialContract;
    const patientLabel = canReadPatient
      ? c.patient.fullName
      : formatPatientCode(c.patient.id);
    const planLabel = contract?.packageName || (order ? order.planType : 'N/A');
    const amountLabel = canReadContract
      ? contract
        ? (contract.totalPriceCents / 100).toFixed(2)
        : order
        ? order.amount.toFixed(2)
        : '0.00'
      : 'RESTRITO';

    return [
      `"${c.caseCode}"`,
      `"${patientLabel.replace(/"/g, '""')}"`,
      `"${c.doctor.fullName.replace(/"/g, '""')}"`,
      `"${c.doctor.professionalIdCro || 'N/A'}"`,
      `"${c.clinic.tradeName.replace(/"/g, '""')}"`,
      `"${c.status}"`,
      `"${c.treatedArches}"`,
      `"${c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('pt-BR') : 'Rascunho'}"`,
      `"${planLabel}"`,
      `"${amountLabel}"`,
      `"${canReadContract ? (contract?.status || order?.paymentStatus || 'N/A') : 'RESTRITO'}"`,
      `"${order?.trackingCode || 'N/A'}"`,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="relatorio-casos-fyalign-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { isFyAlignInternal } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const isInternal = isFyAlignInternal(sessionUser.role);

  const cases = await prisma.case.findMany({
    where: isInternal
      ? {}
      : {
          clinicId: sessionUser.clinicId || '',
        },
    include: {
      patient: true,
      doctor: true,
      clinic: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Geração do conteúdo CSV com UTF-8 BOM
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
    return [
      `"${c.caseCode}"`,
      `"${c.patient.fullName.replace(/"/g, '""')}"`,
      `"${c.doctor.fullName.replace(/"/g, '""')}"`,
      `"${c.doctor.professionalIdCro || 'N/A'}"`,
      `"${c.clinic.tradeName.replace(/"/g, '""')}"`,
      `"${c.status}"`,
      `"${c.treatedArches}"`,
      `"${c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('pt-BR') : 'Rascunho'}"`,
      `"${order ? order.planType : 'N/A'}"`,
      `"${order ? order.amount.toFixed(2) : '0.00'}"`,
      `"${order ? order.paymentStatus : 'N/A'}"`,
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

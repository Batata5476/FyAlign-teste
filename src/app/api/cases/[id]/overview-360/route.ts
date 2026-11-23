import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { buildCaseOverview360 } from '@/lib/patient360/overview-aggregator';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado ou sessão expirada.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const ctx = { role: user.role, permissions: user.permissions };
  const canReadCase = hasPermission(ctx, 'CASE_READ');
  const canReadContract = hasPermission(ctx, 'CONTRACT_READ');

  if (!canReadCase && !canReadContract) {
    return NextResponse.json(
      {
        error: `Acesso negado: Vínculo ativo (${user.role}) não possui CASE_READ nem CONTRACT_READ.`,
        code: 'FORBIDDEN_PERMISSION',
      },
      { status: 403 }
    );
  }

  // Isolamento Multi-Tenant e Proteção Anti-IDOR (retorna 404 neutro para outra clínica)
  const caseScope = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, clinicId: true },
  });

  if (!caseScope) {
    return NextResponse.json({ error: 'Tratamento não encontrado.', code: 'NOT_FOUND' }, { status: 404 });
  }

  if (user.organizationType === 'CLINIC' && caseScope.clinicId !== user.organizationId) {
    return NextResponse.json({ error: 'Tratamento não encontrado.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const overview = await buildCaseOverview360(caseId, user);
  if (!overview) {
    return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
  }

  return NextResponse.json(overview);
}

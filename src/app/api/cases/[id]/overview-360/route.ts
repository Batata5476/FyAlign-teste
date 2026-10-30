import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { buildCaseOverview360 } from '@/lib/patient360/overview-aggregator';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;

  // Guard Central: Exige CASE_READ + Isolamento Cross-Tenant (404 em IDOR)
  const auth = await authorize(req, {
    permission: 'CASE_READ',
    resource: { type: 'CASE', id: caseId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const overview = await buildCaseOverview360(caseId, auth.user);
  if (!overview) {
    return NextResponse.json({ error: 'Tratamento não encontrado.' }, { status: 404 });
  }

  return NextResponse.json(overview);
}

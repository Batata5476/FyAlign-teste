import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { buildPatientOverview360 } from '@/lib/patient360/overview-aggregator';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const patientId = params.id;

  // Guard Central: Exige PATIENT_READ + Isolamento Cross-Tenant (404 em tentativa de IDOR entre clínicas)
  const auth = await authorize(req, {
    permission: 'PATIENT_READ',
    resource: { type: 'PATIENT', id: patientId },
  });

  if (!auth.authorized) {
    return auth.response;
  }

  const overview = await buildPatientOverview360(patientId, auth.user);
  if (!overview) {
    return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 });
  }

  return NextResponse.json(overview);
}

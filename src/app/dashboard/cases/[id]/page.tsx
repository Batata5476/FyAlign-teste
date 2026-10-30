'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PatientTreatment360View } from '@/components/patient360/PatientTreatment360View';

export default function Treatment360Page() {
  const params = useParams();
  const caseId = params.id as string;

  return <PatientTreatment360View mode="TREATMENT" resourceId={caseId} />;
}

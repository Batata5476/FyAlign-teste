'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PatientTreatment360View } from '@/components/patient360/PatientTreatment360View';

export default function Patient360Page() {
  const params = useParams();
  const patientId = params.id as string;

  return <PatientTreatment360View mode="PATIENT" resourceId={patientId} />;
}


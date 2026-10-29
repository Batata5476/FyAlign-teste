'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CaseDetailsRedirect() {
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  useEffect(() => {
    if (caseId) {
      router.replace(`/dashboard/cases/${caseId}/upload`);
    }
  }, [caseId, router]);

  return (
    <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
      Redirecionando para a documentação do caso...
    </div>
  );
}

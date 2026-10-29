'use client';

import React from 'react';
import { CaseWizard } from '@/components/wizard/CaseWizard';

export default function NewCasePage() {
  return (
    <div className="container-custom" style={{ padding: '28px 16px' }}>
      <CaseWizard />
    </div>
  );
}

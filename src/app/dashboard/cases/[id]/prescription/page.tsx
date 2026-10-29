'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PrescriptionForm } from '@/components/prescription/PrescriptionForm';
import { ArrowLeft, Printer, FileText, CheckCircle2 } from 'lucide-react';

export default function CasePrescriptionPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [caseRes, userRes] = await Promise.all([
          fetch(`/api/cases/${caseId}/prescription`),
          fetch('/api/auth/me'),
        ]);

        if (caseRes.ok) {
          const cData = await caseRes.json();
          setCaseData(cData.case);
        }

        if (userRes.ok) {
          const uData = await userRes.json();
          setCurrentUser(uData.user);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (caseId) {
      loadData();
    }
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados da prescrição ortodôntica...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ color: 'var(--crimson-danger)' }}>Caso clínico não encontrado.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary" style={{ marginTop: '16px' }}>
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const handlePrintMirror = () => {
    window.print();
  };

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => router.push(`/dashboard/cases/${caseId}/upload`)}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar para Uploads</span>
          </button>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Etapa 2 de 2 • Prescrição Clínica</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              Formulário Ortodôntico Parametrizado
            </h1>
          </div>
        </div>

        {/* Ação de Espelho de Impressão / PDF (F3.15) */}
        <button
          type="button"
          onClick={handlePrintMirror}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Printer size={16} />
          <span>Imprimir / Gerar PDF</span>
        </button>
      </div>

      <PrescriptionForm
        initialCase={caseData}
        userRole={currentUser?.role}
        userCro={currentUser?.professionalIdCro}
        userName={currentUser?.fullName}
        onSubmitted={() => router.push('/dashboard')}
      />
    </div>
  );
}

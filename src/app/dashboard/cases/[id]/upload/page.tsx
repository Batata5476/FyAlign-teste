'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UploadGrid } from '@/components/upload/UploadGrid';
import { ArrowLeft, ArrowRight, CheckCircle2, User, FileText, AlertTriangle } from 'lucide-react';

export default function CaseUploadPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/files`);
      if (res.ok) {
        const data = await res.json();
        setCaseData(data);
      }
    } catch (err) {
      console.error('Erro ao buscar arquivos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchFiles();
    }
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando dados da documentação...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ color: 'var(--crimson-danger)' }}>Caso não encontrado.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary" style={{ marginTop: '16px' }}>
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const isComplete = caseData.progress?.isComplete;

  return (
    <div>
      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => router.push(`/dashboard/cases/${caseId}`)}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar para Ficha 360°</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan-primary)', fontSize: '1.1rem' }}>
                {caseData.caseCode}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                Envio de Documentação e Escaneamentos 3D
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Grade estruturada de 13 arquivos padronizados conforme especificação do BluePrint FyAlign.
            </p>
          </div>
        </div>

        {/* Botão de Avançar */}
        <button
          onClick={() => router.push(`/dashboard/cases/${caseId}/prescription`)}
          className="btn-primary"
          style={{
            opacity: isComplete ? 1 : 0.6,
            cursor: isComplete ? 'pointer' : 'not-allowed',
            padding: '12px 20px'
          }}
          title={!isComplete ? 'Carregue todos os 13 arquivos obrigatórios para avançar' : ''}
        >
          <span>Avançar para Prescrição</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Grid Principal dos 13 Cards */}
      <UploadGrid
        slots={caseData.slots || []}
        caseId={caseId}
        onRefresh={fetchFiles}
      />

      {/* Sticky Bottom Bar */}
      <div style={{
        position: 'sticky',
        bottom: '20px',
        marginTop: '32px',
        padding: '16px 24px',
        background: 'rgba(10, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-hover)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {isComplete ? (
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.25)',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CheckCircle2 size={20} color="#10b981" />
            </div>
          ) : (
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.25)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} color="#fbbf24" />
            </div>
          )}
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.94rem', color: '#ffffff' }}>
              {isComplete
                ? 'Todos os 12 arquivos obrigatórios foram validados com sucesso!'
                : `Documentação pendente: ${caseData.progress?.totalCompleted} de ${caseData.progress?.totalRequired} arquivos obrigatórios.`}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '2px' }}>
              Upload direto seguro via AWS S3 Presigned URLs com anonimização por UUIDs.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/dashboard/cases/${caseId}/prescription`)}
          className="btn-primary"
          disabled={!isComplete}
          style={{ opacity: isComplete ? 1 : 0.6 }}
        >
          <span>Avançar para Prescrição Clínica</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

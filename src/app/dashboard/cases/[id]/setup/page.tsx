'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DentalViewer3D } from '@/components/viewer3d/DentalViewer3D';
import { CaseChatModal } from '@/components/chat/CaseChatModal';
import { SetupApprovalModal } from '@/components/approval/SetupApprovalModal';
import { StageUploadModal } from '@/components/setup/StageUploadModal';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertCircle,
  Sparkles,
  RotateCcw,
  History,
  Upload,
} from 'lucide-react';

export default function CaseSetupViewerPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;
  const { can, canAny } = useAuth();

  const canPublishSetup = canAny(['SETUP_CREATE', 'SETUP_PUBLISH']);
  const canRequestRevision = canAny(['SETUP_REJECT', 'SETUP_REVISION_REQUEST']);
  const canApproveSetupAction = can('SETUP_APPROVE');

  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<any>(null);
  const [selectedSetupIndex, setSelectedSetupIndex] = useState(0);

  // Modais
  const [chatOpen, setChatOpen] = useState(false);
  const [approvalModalMode, setApprovalModalMode] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [stageUploadOpen, setStageUploadOpen] = useState(false);

  const loadSetup = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/setups`);
      if (res.ok) {
        const data = await res.json();
        setSetupData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadSetup();
    }
  }, [caseId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
        Carregando visualizador tridimensional e Setup Virtual...
      </div>
    );
  }

  if (!setupData || !setupData.setups || setupData.setups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ color: 'var(--amber-warning)', marginBottom: '16px', fontSize: '1.05rem' }}>
          Nenhum Setup Virtual publicado para este caso no momento.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => router.push('/dashboard')} className="btn-secondary">
            Voltar ao Dashboard
          </button>
          {canPublishSetup && (
            <button
              onClick={() => setStageUploadOpen(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Upload size={16} />
              <span>Publicar Setup v1 (Multi-STL)</span>
            </button>
          )}
        </div>

        {canPublishSetup && (
          <StageUploadModal
            isOpen={stageUploadOpen}
            onClose={() => setStageUploadOpen(false)}
            caseId={caseId}
            caseCode={setupData?.caseCode || 'Caso'}
            nextVersion={1}
            onSuccess={() => {
              loadSetup();
            }}
          />
        )}
      </div>
    );
  }

  const activeSetup = setupData.setups[selectedSetupIndex] || setupData.setups[0];
  const isApproved = activeSetup.status === 'APPROVED';
  const isRejected = activeSetup.status === 'REJECTED';

  const iprList = Array.isArray(activeSetup.iprSchedule)
    ? activeSetup.iprSchedule
    : typeof activeSetup.iprSchedule === 'string' && activeSetup.iprSchedule.trim()
    ? (() => {
        try {
          return JSON.parse(activeSetup.iprSchedule);
        } catch {
          return [];
        }
      })()
    : [];

  const attList = Array.isArray(activeSetup.attachmentSchedule)
    ? activeSetup.attachmentSchedule
    : typeof activeSetup.attachmentSchedule === 'string' && activeSetup.attachmentSchedule.trim()
    ? (() => {
        try {
          return JSON.parse(activeSetup.attachmentSchedule);
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan-primary)', fontSize: '1.1rem' }}>
                {setupData.caseCode}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                Visualizador 3D do Setup Virtual (v{activeSetup.versionNumber})
              </h1>

              {isApproved && (
                <span className="badge-status-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <CheckCircle2 size={13} /> Aprovado / Em Produção
                </span>
              )}
              {isRejected && (
                <span className="badge-status-rejected" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <AlertCircle size={13} /> Ajuste Solicitado
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              Paciente: <strong style={{ color: 'var(--text-main)' }}>{setupData.patient?.fullName}</strong> • Responsável: Dr(a). {setupData.doctor?.fullName} (CRO: {setupData.doctor?.professionalIdCro || 'Ativo'})
            </p>
          </div>
        </div>

        {/* Ações e Métricas do Topo */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Seletor de Versão Histórica (F5.05) */}
          {setupData.setups.length > 1 && (
            <div className="glass-panel" style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={15} color="var(--cyan-primary)" />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Versão:</span>
              <select
                value={selectedSetupIndex}
                onChange={(e) => setSelectedSetupIndex(Number(e.target.value))}
                style={{
                  background: 'transparent',
                  color: 'var(--cyan-primary)',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {setupData.setups.map((s: any, idx: number) => (
                  <option key={s.id} value={idx} style={{ background: '#0a192f', color: '#fff' }}>
                    v{s.versionNumber} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão de Chat Clínico */}
          <button
            onClick={() => setChatOpen(true)}
            className="btn-secondary"
            style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <MessageSquare size={16} color="var(--cyan-primary)" />
            <span>Chat Clínico</span>
          </button>

          {/* Botão de Upload / Publicar Novo Setup (Multi-STL) */}
          {canPublishSetup && (
            <button
              id="btn-publish-setup-multi-stl"
              type="button"
              onClick={() => setStageUploadOpen(true)}
              className="btn-secondary"
              style={{
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--cyan-primary)',
                borderColor: 'var(--border-hover)',
              }}
            >
              <Upload size={16} />
              <span>Publicar Setup (Multi-STL)</span>
            </button>
          )}

          {/* Botões de Decisão Clínica (Aprovar / Rejeitar) */}
          {!isApproved && (
            <>
              {canRequestRevision && (
                <button
                  onClick={() => setApprovalModalMode('REJECT')}
                  className="btn-secondary"
                  style={{
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Solicitar Ajustes</span>
                </button>
              )}

              {canApproveSetupAction && (
                <button
                  onClick={() => setApprovalModalMode('APPROVE')}
                  className="btn-primary"
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Aprovar Setup (RN-02)</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Visualizador 3D WebGL Interativo */}
      <div style={{ marginBottom: '20px' }}>
        <DentalViewer3D
          maxStages={Math.max(activeSetup.upperAlignersCount, activeSetup.lowerAlignersCount) || 14}
          iprSchedule={iprList}
          attachmentSchedule={attList}
          stagesData={activeSetup.stages}
        />
      </div>

      {/* Parecer do Planejador Ortodôntico */}
      {activeSetup.plannerComments && (
        <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid var(--cyan-primary)', marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
            Parecer Técnico do Planejador 3D (FyAlign Lab) • Setup v{activeSetup.versionNumber}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {activeSetup.plannerComments}
          </p>
        </div>
      )}

      {/* Modais de Chat e Aprovação/Rejeição */}
      <CaseChatModal
        caseId={caseId}
        caseCode={setupData.caseCode}
        patientName={setupData.patient?.fullName || 'Paciente'}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {approvalModalMode && (
        <SetupApprovalModal
          isOpen={true}
          onClose={() => setApprovalModalMode(null)}
          caseId={caseId}
          setupId={activeSetup.id}
          setupVersion={activeSetup.versionNumber}
          upperCount={activeSetup.upperAlignersCount}
          lowerCount={activeSetup.lowerAlignersCount}
          doctorName={setupData.doctor?.fullName}
          doctorCro={setupData.doctor?.professionalIdCro}
          mode={approvalModalMode}
          onSuccess={() => {
            loadSetup();
          }}
        />
      )}

      {/* Modal de Publicação de Setup via Múltiplos STLs */}
      <StageUploadModal
        isOpen={stageUploadOpen}
        onClose={() => setStageUploadOpen(false)}
        caseId={caseId}
        caseCode={setupData.caseCode}
        nextVersion={(setupData.setups?.[0]?.versionNumber || 0) + 1}
        onSuccess={() => {
          loadSetup();
        }}
      />
    </div>
  );
}

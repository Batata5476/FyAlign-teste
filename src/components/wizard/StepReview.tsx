'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Edit2,
  User,
  Activity,
  Compass,
  FileCheck,
  ShieldCheck,
  Send,
  Loader2,
  ArrowLeft,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { WizardDraftState, WizardStepNumber } from './types';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
  TREATMENT_ACTION,
} from '@/lib/types/clinical';

interface StepReviewProps {
  draft: WizardDraftState;
  onGoToStep: (step: WizardStepNumber) => void;
  onSubmitCase: () => Promise<void>;
  onBack: () => void;
}

export function StepReview({
  draft,
  onGoToStep,
  onSubmitCase,
  onBack,
}: StepReviewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  const totalSlots = 13;
  const completedSlots = Object.values(draft.files).filter((s) => s.status === 'UPLOADED').length;
  const filesReady = completedSlots === totalSlots;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitCase();
      setIsSubmittedSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Erro ao submeter caso clínico.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMidline = (val: string) => {
    switch (val) {
      case MIDLINE_POSITION.CENTERED:
        return 'Centralizada';
      case MIDLINE_POSITION.DEVIATED_RIGHT:
        return 'Desviada à Direita (→)';
      case MIDLINE_POSITION.DEVIATED_LEFT:
        return 'Desviada à Esquerda (←)';
      default:
        return val;
    }
  };

  const formatClass = (val: string) => {
    switch (val) {
      case OCCLUSION_CLASS.CLASS_I:
        return 'Classe I';
      case OCCLUSION_CLASS.CLASS_II:
        return 'Classe II';
      case OCCLUSION_CLASS.CLASS_III:
        return 'Classe III';
      default:
        return val;
    }
  };

  const formatAction = (val: string) => {
    return val === TREATMENT_ACTION.IMPROVE ? 'Melhorar' : 'Manter';
  };

  if (isSubmittedSuccess) {
    return (
      <div
        style={{
          padding: '48px 32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--badge-approved-bg)',
            border: '2px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
          }}
        >
          <CheckCircle2 size={40} />
        </div>

        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            Caso Clínico Submetido com Sucesso!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto' }}>
            O caso <strong style={{ color: 'var(--cyan-primary)' }}>{draft.caseCode || 'FyAlign'}</strong> foi
            encaminhado para a equipe de ortodontistas e planejadores 3D. Acompanhe a evolução na lista de casos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '14px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href={draft.caseId ? `/dashboard/cases/${draft.caseId}` : '/dashboard/cases'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #009b9c 100%)',
              color: '#ffffff',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.92rem',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            }}
          >
            <span>Ver Detalhes do Caso</span>
            <ExternalLink size={16} />
          </a>
          <a
            href="/dashboard/cases"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.92rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span>Voltar aos Meus Casos</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
          Etapa 7 — Revisão Geral e Submissão Clínica
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Revise atentamente todas as informações do caso antes do envio definitivo para o laboratório FyAlign.
        </p>
      </div>

      {/* Cartões de Revisão */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 1. Profissional */}
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              <Building2 size={18} />
              <span>1. PROFISSIONAL RESPONSÁVEL</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={13} />
              <span>Visualizar</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Nome: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.professional?.fullName || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>CRO: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.professional?.cro || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Clínica: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.professional?.clinicName || '—'}</strong>
            </div>
          </div>
        </div>

        {/* 2. Paciente */}
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              <User size={18} />
              <span>2. PACIENTE</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(2)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Nome Completo: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.patient.fullName || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Data de Nascimento: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.patient.birthDate || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Sexo: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.patient.gender || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Telefone: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.patient.phone || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>E-mail: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.patient.email || '—'}</strong>
            </div>
          </div>
        </div>

        {/* 3. Condição Clínica */}
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              <Activity size={18} />
              <span>3. CONDIÇÃO CLÍNICA INICIAL</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(3)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.86rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Linha Média Sup: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatMidline(draft.condition.upperMidline)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Linha Média Inf: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatMidline(draft.condition.lowerMidline)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Canino Direito: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatClass(draft.condition.canineRight)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Canino Esquerdo: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatClass(draft.condition.canineLeft)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Molar Direito: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatClass(draft.condition.molarRight)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Molar Esquerdo: </span>
              <strong style={{ color: 'var(--text-main)' }}>{formatClass(draft.condition.molarLeft)}</strong>
            </div>
          </div>
        </div>

        {/* 4. Plano de Tratamento */}
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              <Compass size={18} />
              <span>4. PLANO DE TRATAMENTO E PRESCRIÇÃO</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(4)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.86rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Linha Média Sup/Inf: </span>
              <strong style={{ color: 'var(--text-main)' }}>
                {formatAction(draft.treatmentPlan.upperMidline)} / {formatAction(draft.treatmentPlan.lowerMidline)}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Overjet / Overbite: </span>
              <strong style={{ color: 'var(--text-main)' }}>
                {formatAction(draft.treatmentPlan.overjet)} / {formatAction(draft.treatmentPlan.overbite)}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Forma Arco / Expansão: </span>
              <strong style={{ color: 'var(--text-main)' }}>
                {formatAction(draft.treatmentPlan.archForm)} / {formatAction(draft.treatmentPlan.expansion)}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>IPR / Attachments: </span>
              <strong style={{ color: 'var(--text-main)' }}>
                {draft.treatmentPlan.ipr ? 'Sim' : 'Não'} / {draft.treatmentPlan.attachment ? 'Sim' : 'Não'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Elásticos: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.treatmentPlan.intermaxillaryElastic}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Classe II / III: </span>
              <strong style={{ color: 'var(--text-main)' }}>
                {draft.treatmentPlan.classIICorrection} / {draft.treatmentPlan.classIIICorrection}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Diastemas: </span>
              <strong style={{ color: 'var(--text-main)' }}>{draft.treatmentPlan.diastemas}</strong>
            </div>
            {draft.treatmentPlan.smartAttachments && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)' }}>Smart Attachments: </span>
                <span style={{ color: 'var(--text-main)' }}>{draft.treatmentPlan.smartAttachments}</span>
              </div>
            )}
            {draft.treatmentPlan.additionalInstructions && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)' }}>Instruções: </span>
                <span style={{ color: 'var(--text-main)' }}>{draft.treatmentPlan.additionalInstructions}</span>
              </div>
            )}
          </div>
        </div>

        {/* 5. Arquivos Clínicos */}
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              <FileCheck size={18} />
              <span>5. ARQUIVOS CLÍNICOS E MODELOS 3D</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(5)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: filesReady ? 'var(--badge-approved-text)' : 'var(--badge-warning-text)',
                background: filesReady ? 'var(--badge-approved-bg)' : 'var(--badge-warning-bg)',
                border: filesReady ? '1px solid var(--badge-approved-border)' : '1px solid var(--badge-warning-border)',
                padding: '4px 14px',
                borderRadius: '999px',
              }}
            >
              {filesReady ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{completedSlots} / {totalSlots} Arquivos Concluídos</span>
            </span>
            <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              {filesReady
                ? 'Todos os 13 arquivos (fotos, panorâmica, telerradiografia e STLs) foram validados.'
                : 'Atenção: Os 13 arquivos obrigatórios devem ser concluídos antes da submissão.'}
            </span>
          </div>
        </div>

        {/* 6. Consentimento */}
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              <ShieldCheck size={18} />
              <span>6. TERMO DE CONSENTIMENTO E ASSINATURA</span>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(6)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: draft.consent.agreed ? '#059669' : '#dc2626',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{draft.consent.agreed ? 'Termo Aceito' : 'Termo Pendente'}</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: draft.consent.signatureBase64 ? '#059669' : '#dc2626',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{draft.consent.signatureBase64 ? 'Assinatura Digital Registrada' : 'Assinatura Pendente'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Erro de Submissão */}
      {submitError && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--badge-danger-bg)',
            border: '1px solid var(--badge-danger-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--badge-danger-text)',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Navigation & Submit Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 22px',
            borderRadius: '8px',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Voltar</span>
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !filesReady || !draft.consent.agreed}
          className="btn-glow"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 32px',
            borderRadius: '8px',
            background:
              !filesReady || !draft.consent.agreed
                ? 'var(--badge-draft-bg)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: !filesReady || !draft.consent.agreed ? 'var(--text-muted)' : '#ffffff',
            fontWeight: 800,
            fontSize: '1rem',
            border: 'none',
            cursor: !filesReady || !draft.consent.agreed || isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: filesReady && draft.consent.agreed ? '0 4px 20px rgba(16, 185, 129, 0.4)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spin" />
              <span>Processando Submissão...</span>
            </>
          ) : (
            <>
              <Send size={18} />
              <span>Enviar Caso Clínico para FyAlign</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  AlignCenter,
  ArrowRight as ArrowRightIcon,
  ArrowLeft as ArrowLeftIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
  MidlinePosition,
  OcclusionClass,
} from '@/lib/types/clinical';
import { ClinicalConditionFormData } from './types';

interface StepClinicalConditionProps {
  caseId: string | null;
  conditionData: ClinicalConditionFormData;
  onChange: (data: ClinicalConditionFormData) => void;
  onNext: () => void;
  onBack: () => void;
  isSaving?: boolean;
}

export function StepClinicalCondition({
  caseId,
  conditionData,
  onChange,
  onNext,
  onBack,
  isSaving = false,
}: StepClinicalConditionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // Carrega diagnóstico existente via GET caso o draft ainda esteja vazio
  useEffect(() => {
    async function loadExistingCondition() {
      if (!caseId || hasAttemptedFetch) return;

      const hasSomeData =
        conditionData.upperMidline ||
        conditionData.lowerMidline ||
        conditionData.canineRight ||
        conditionData.canineLeft ||
        conditionData.molarRight ||
        conditionData.molarLeft;

      if (hasSomeData) {
        setHasAttemptedFetch(true);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/clinical-condition`);
        if (res.ok) {
          const data = await res.json();
          if (data.clinicalCondition) {
            onChange({
              upperMidline: data.clinicalCondition.upperMidline || '',
              lowerMidline: data.clinicalCondition.lowerMidline || '',
              canineRight: data.clinicalCondition.canineRight || '',
              canineLeft: data.clinicalCondition.canineLeft || '',
              molarRight: data.clinicalCondition.molarRight || '',
              molarLeft: data.clinicalCondition.molarLeft || '',
            });
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar a condição clínica via GET:', err);
      } finally {
        setIsLoading(false);
        setHasAttemptedFetch(true);
      }
    }

    loadExistingCondition();
  }, [caseId, hasAttemptedFetch, conditionData, onChange]);

  const updateField = (field: keyof ClinicalConditionFormData, value: any) => {
    onChange({
      ...conditionData,
      [field]: value,
    });
  };

  const midlineOptions: Array<{ value: MidlinePosition; label: string; icon: any }> = [
    { value: MIDLINE_POSITION.CENTERED, label: 'Centralizada', icon: AlignCenter },
    { value: MIDLINE_POSITION.DEVIATED_RIGHT, label: 'Desviada à direita', icon: ArrowRightIcon },
    { value: MIDLINE_POSITION.DEVIATED_LEFT, label: 'Desviada à esquerda', icon: ArrowLeftIcon },
  ];

  const occlusionOptions: Array<{ value: OcclusionClass; label: string; sub: string }> = [
    { value: OCCLUSION_CLASS.CLASS_I, label: 'Classe I', sub: 'Neutroclusão' },
    { value: OCCLUSION_CLASS.CLASS_II, label: 'Classe II', sub: 'Disto-oclusão' },
    { value: OCCLUSION_CLASS.CLASS_III, label: 'Classe III', sub: 'Mésio-oclusão' },
  ];

  // Contagem de preenchimento dos 6 campos obrigatórios
  const fields = [
    conditionData.upperMidline,
    conditionData.lowerMidline,
    conditionData.canineRight,
    conditionData.canineLeft,
    conditionData.molarRight,
    conditionData.molarLeft,
  ];
  const filledCount = fields.filter((f) => !!f).length;
  const isComplete = filledCount === 6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header com Status de Preenchimento */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Etapa 3 — Diagnóstico Oclusal & Condição Clínica
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Mapeie o diagnóstico dentofacial inicial: linha média e chave de caninos/molares de Angle.
          </p>
        </div>

        {/* Badge Dinâmico de Progresso */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            background: isComplete ? 'rgba(16, 185, 129, 0.12)' : 'var(--badge-setup-bg)',
            border: isComplete ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-card)',
            color: isComplete ? '#10b981' : 'var(--cyan-primary)',
            fontSize: '0.85rem',
            fontWeight: 700,
            transition: 'all 0.2s ease',
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>Carregando dados...</span>
            </>
          ) : isComplete ? (
            <>
              <CheckCircle2 size={16} />
              <span>6 de 6 diagnósticos selecionados</span>
            </>
          ) : (
            <>
              <Activity size={16} />
              <span>{filledCount} de 6 campos preenchidos</span>
            </>
          )}
        </div>
      </div>

      {/* Seção 1: Linhas Médias Dentais */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} />
            <span>1. Linha Média Dental</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Avalie o desvio em relação ao plano sagital mediano da face
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Linha Média Superior */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Linha Média Superior <span style={{ color: '#ef4444' }}>*</span>
              </span>
              {conditionData.upperMidline && (
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {midlineOptions.map((opt) => {
                const isSelected = conditionData.upperMidline === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('upperMidline', opt.value)}
                    style={{
                      padding: '13px 16px',
                      background: isSelected ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                      border: isSelected ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      fontSize: '0.88rem',
                      boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={16} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linha Média Inferior */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Linha Média Inferior <span style={{ color: '#ef4444' }}>*</span>
              </span>
              {conditionData.lowerMidline && (
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {midlineOptions.map((opt) => {
                const isSelected = conditionData.lowerMidline === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('lowerMidline', opt.value)}
                    style={{
                      padding: '13px 16px',
                      background: isSelected ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                      border: isSelected ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      fontSize: '0.88rem',
                      boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={16} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Seção 2: Relação Canina (Angle) */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} />
            <span>2. Relação Canina (Angle)</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Classificação sagital canina direita e esquerda
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {/* Lado Direito */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Canino Direito <span style={{ color: '#ef4444' }}>*</span>
              </span>
              {conditionData.canineRight && (
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {occlusionOptions.map((opt) => {
                const isSelected = conditionData.canineRight === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('canineRight', opt.value)}
                    style={{
                      padding: '11px 16px',
                      background: isSelected ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                      border: isSelected ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.88rem',
                      boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '0.78rem', color: isSelected ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lado Esquerdo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Canino Esquerdo <span style={{ color: '#ef4444' }}>*</span>
              </span>
              {conditionData.canineLeft && (
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {occlusionOptions.map((opt) => {
                const isSelected = conditionData.canineLeft === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('canineLeft', opt.value)}
                    style={{
                      padding: '11px 16px',
                      background: isSelected ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                      border: isSelected ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.88rem',
                      boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '0.78rem', color: isSelected ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Seção 3: Relação Molar (Angle) */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} />
            <span>3. Relação Molar (Angle)</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Classificação sagital de molares permanentes
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {/* Lado Direito */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Molar Direito <span style={{ color: '#ef4444' }}>*</span>
              </span>
              {conditionData.molarRight && (
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {occlusionOptions.map((opt) => {
                const isSelected = conditionData.molarRight === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('molarRight', opt.value)}
                    style={{
                      padding: '11px 16px',
                      background: isSelected ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                      border: isSelected ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.88rem',
                      boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '0.78rem', color: isSelected ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lado Esquerdo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Molar Esquerdo <span style={{ color: '#ef4444' }}>*</span>
              </span>
              {conditionData.molarLeft && (
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {occlusionOptions.map((opt) => {
                const isSelected = conditionData.molarLeft === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('molarLeft', opt.value)}
                    style={{
                      padding: '11px 16px',
                      background: isSelected ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                      border: isSelected ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                      borderRadius: '8px',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.88rem',
                      boxShadow: isSelected ? '0 0 12px rgba(2, 132, 199, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '0.78rem', color: isSelected ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Navegação e Ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onBack}
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
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Voltar para Paciente</span>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            onClick={onNext}
            disabled={!isComplete || isSaving}
            className={isComplete && !isSaving ? 'btn-glow' : ''}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '13px 32px',
              borderRadius: '8px',
              background: isComplete && !isSaving
                ? 'linear-gradient(135deg, #0284c7 0%, #009b9c 100%)'
                : 'rgba(2, 132, 199, 0.2)',
              color: isComplete && !isSaving ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.95rem',
              border: isComplete && !isSaving ? 'none' : '1px solid var(--border-card)',
              cursor: isComplete && !isSaving ? 'pointer' : 'not-allowed',
              boxShadow: isComplete && !isSaving ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Salvando diagnóstico...</span>
              </>
            ) : (
              <>
                <span>Continuar</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {!isComplete && (
            <span style={{ fontSize: '0.78rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={13} />
              <span>Selecione todos os 6 campos para habilitar o avanço</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

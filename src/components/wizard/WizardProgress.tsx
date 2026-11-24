'use client';

import React from 'react';
import {
  UserCheck,
  Users,
  Activity,
  Compass,
  UploadCloud,
  FileCheck2,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { WizardStepNumber, WizardStepMeta } from './types';

export const WIZARD_STEPS: WizardStepMeta[] = [
  {
    number: 1,
    title: 'Profissional',
    shortTitle: 'Doutor',
    description: 'Dados de sessão e CRO',
  },
  {
    number: 2,
    title: 'Paciente',
    shortTitle: 'Paciente',
    description: 'Prontuário e cadastro',
  },
  {
    number: 3,
    title: 'Condição Clínica',
    shortTitle: 'Condição',
    description: 'Linha média e oclusão',
  },
  {
    number: 4,
    title: 'Plano de Tratamento',
    shortTitle: 'Plano',
    description: 'Ações biomecânicas e IPR',
  },
  {
    number: 5,
    title: 'Arquivos Clínicos',
    shortTitle: '13 Slots',
    description: 'Fotos, raios-x e STLs',
  },
  {
    number: 6,
    title: 'Consentimento',
    shortTitle: 'TCLE',
    description: 'Termo e assinatura',
  },
  {
    number: 7,
    title: 'Revisão & Envio',
    shortTitle: 'Revisão',
    description: 'Conferência final',
  },
];

const STEP_ICONS = {
  1: UserCheck,
  2: Users,
  3: Activity,
  4: Compass,
  5: UploadCloud,
  6: FileCheck2,
  7: CheckCircle2,
};

interface WizardProgressProps {
  currentStep: WizardStepNumber;
  maxReachedStep?: WizardStepNumber;
  onStepClick?: (step: WizardStepNumber) => void;
}

export function WizardProgress({
  currentStep,
  maxReachedStep = currentStep,
  onStepClick,
}: WizardProgressProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        marginBottom: '28px',
        borderRadius: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="wizard-steps-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        {WIZARD_STEPS.map((stepMeta) => {
          const isCurrent = currentStep === stepMeta.number;
          const isCompleted = currentStep > stepMeta.number;
          const isClickable = onStepClick && stepMeta.number <= maxReachedStep;
          const Icon = STEP_ICONS[stepMeta.number];

          return (
            <button
              key={stepMeta.number}
              onClick={() => isClickable && onStepClick(stepMeta.number)}
              disabled={!isClickable}
              style={{
                background: isCurrent
                  ? 'var(--badge-setup-bg)'
                  : isCompleted
                  ? 'var(--badge-approved-bg)'
                  : 'var(--input-bg)',
                border: isCurrent
                  ? '1.5px solid var(--cyan-primary)'
                  : isCompleted
                  ? '1px solid var(--badge-approved-border)'
                  : '1px solid var(--border-card)',
                borderRadius: '10px',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                textAlign: 'center',
                boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {/* Indicador Numérico / Ícone */}
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: isCurrent
                    ? 'var(--cyan-primary)'
                    : isCompleted
                    ? '#10b981'
                    : 'var(--bg-card)',
                  color: isCurrent
                    ? '#ffffff'
                    : isCompleted
                    ? '#ffffff'
                    : 'var(--text-dim)',
                  border: isCompleted || isCurrent ? 'none' : '1px solid var(--border-card)',
                  boxShadow: isCurrent ? '0 0 10px var(--cyan-glow)' : 'none',
                }}
              >
                {isCompleted ? <Check size={16} strokeWidth={3} /> : <Icon size={14} />}
              </div>

              {/* Rótulo e Etapa */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: isCurrent
                      ? 'var(--cyan-primary)'
                      : isCompleted
                      ? 'var(--badge-approved-text)'
                      : 'var(--text-dim)',
                  }}
                >
                  Etapa {stepMeta.number}
                </div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: isCurrent ? 700 : 600,
                    color: isCurrent
                      ? 'var(--text-main)'
                      : isCompleted
                      ? 'var(--text-secondary)'
                      : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {stepMeta.shortTitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

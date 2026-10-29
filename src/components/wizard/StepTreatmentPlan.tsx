'use client';

import React from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Layers,
  Scissors,
  FileText,
} from 'lucide-react';
import {
  TREATMENT_ACTION,
  ELASTIC_OPTION,
  CORRECTION_OPTION,
  DIASTEMA_OPTION,
  TreatmentAction,
} from '@/lib/types/clinical';
import { TreatmentPlanFormData } from './types';

interface StepTreatmentPlanProps {
  planData: TreatmentPlanFormData;
  onChange: (data: TreatmentPlanFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ActionItem {
  key: keyof Pick<
    TreatmentPlanFormData,
    | 'upperMidline'
    | 'lowerMidline'
    | 'overjet'
    | 'overbite'
    | 'archForm'
    | 'expansion'
    | 'canineRelationship'
    | 'molarRelationship'
  >;
  label: string;
  description: string;
}

const ACTION_ITEMS: ActionItem[] = [
  { key: 'upperMidline', label: 'Linha Média Superior', description: 'Posição em relação à face' },
  { key: 'lowerMidline', label: 'Linha Média Inferior', description: 'Coincidência com a superior' },
  { key: 'overjet', label: 'Overjet (Trespasse Horizontal)', description: 'Distância vestibular incisivos' },
  { key: 'overbite', label: 'Overbite (Trespasse Vertical)', description: 'Cobertura vertical incisivos' },
  { key: 'archForm', label: 'Forma do Arco', description: 'Harmonização parabólica' },
  { key: 'expansion', label: 'Expansão de Arcadas', description: 'Desenvolvimento transversal' },
  { key: 'canineRelationship', label: 'Relação Canina', description: 'Guia canina e chave de Angle' },
  { key: 'molarRelationship', label: 'Relação Molar', description: 'Oclusão posterior de molares' },
];

export function StepTreatmentPlan({
  planData,
  onChange,
  onNext,
  onBack,
}: StepTreatmentPlanProps) {
  const updateField = <K extends keyof TreatmentPlanFormData>(
    field: K,
    value: TreatmentPlanFormData[K]
  ) => {
    onChange({
      ...planData,
      [field]: value,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
          Etapa 4 — Prescrição e Plano de Tratamento
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Defina as diretrizes biomecânicas e objetivos desejados para o setup de alinhadores transparentes.
        </p>
      </div>

      {/* 1. Matriz de Ações Clínicas */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--cyan-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Compass size={18} />
          <span>1. Objetivos Clínicos por Parâmetro</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ACTION_ITEMS.map((item) => {
            const currentVal = planData[item.key];

            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.94rem' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {item.description}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => updateField(item.key, TREATMENT_ACTION.MAINTAIN)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border:
                        currentVal === TREATMENT_ACTION.MAINTAIN
                          ? '1.5px solid var(--cyan-primary)'
                          : '1px solid var(--border-card)',
                      background:
                        currentVal === TREATMENT_ACTION.MAINTAIN
                          ? 'var(--badge-setup-bg)'
                          : 'var(--bg-card)',
                      color:
                        currentVal === TREATMENT_ACTION.MAINTAIN
                          ? 'var(--cyan-primary)'
                          : 'var(--text-secondary)',
                      boxShadow: currentVal === TREATMENT_ACTION.MAINTAIN ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Manter</span>
                    {currentVal === TREATMENT_ACTION.MAINTAIN && <CheckCircle2 size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateField(item.key, TREATMENT_ACTION.IMPROVE)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border:
                        currentVal === TREATMENT_ACTION.IMPROVE
                          ? '1.5px solid #10b981'
                          : '1px solid var(--border-card)',
                      background:
                        currentVal === TREATMENT_ACTION.IMPROVE
                          ? 'var(--badge-approved-bg)'
                          : 'var(--bg-card)',
                      color:
                        currentVal === TREATMENT_ACTION.IMPROVE
                          ? 'var(--badge-approved-text)'
                          : 'var(--text-secondary)',
                      boxShadow: currentVal === TREATMENT_ACTION.IMPROVE ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Melhorar</span>
                    {currentVal === TREATMENT_ACTION.IMPROVE && <CheckCircle2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Preferências Biomecânicas (IPR, Attachments, Elásticos) */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--cyan-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Scissors size={18} />
          <span>2. Recursos e Acessórios Biomecânicos</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* IPR */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '4px' }}>
              IPR (Desgaste Interproximal)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', minHeight: '34px' }}>
              Autorizar desgastes para ganho de espaço ou resolução de apinhamento.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => updateField('ipr', false)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: !planData.ipr
                    ? '1.5px solid var(--cyan-primary)'
                    : '1px solid var(--border-card)',
                  background: !planData.ipr ? 'var(--badge-setup-bg)' : 'var(--bg-card)',
                  color: !planData.ipr ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                  boxShadow: !planData.ipr ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => updateField('ipr', true)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: planData.ipr
                    ? '1.5px solid var(--cyan-primary)'
                    : '1px solid var(--border-card)',
                  background: planData.ipr ? 'var(--badge-setup-bg)' : 'var(--bg-card)',
                  color: planData.ipr ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                  boxShadow: planData.ipr ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Sim
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '4px' }}>
              Attachments Convencionais
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', minHeight: '34px' }}>
              Utilizar attachments para retenção e ancoragem de movimentos.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => updateField('attachment', false)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: !planData.attachment
                    ? '1.5px solid var(--cyan-primary)'
                    : '1px solid var(--border-card)',
                  background: !planData.attachment ? 'var(--badge-setup-bg)' : 'var(--bg-card)',
                  color: !planData.attachment ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                  boxShadow: !planData.attachment ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => updateField('attachment', true)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: planData.attachment
                    ? '1.5px solid var(--cyan-primary)'
                    : '1px solid var(--border-card)',
                  background: planData.attachment ? 'var(--badge-setup-bg)' : 'var(--bg-card)',
                  color: planData.attachment ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                  boxShadow: planData.attachment ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Sim
              </button>
            </div>
          </div>

          {/* Elásticos Intermaxilares */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '4px' }}>
              Elásticos Intermaxilares
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', minHeight: '34px' }}>
              Recortes (precision cuts) ou botões para uso de elásticos.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[
                { val: ELASTIC_OPTION.NO, label: 'Não' },
                { val: ELASTIC_OPTION.IF_NECESSARY, label: 'Se necessário' },
                { val: ELASTIC_OPTION.YES, label: 'Sim' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => updateField('intermaxillaryElastic', opt.val)}
                  style={{
                    padding: '9px 4px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    border:
                      planData.intermaxillaryElastic === opt.val
                        ? '1.5px solid var(--cyan-primary)'
                        : '1px solid var(--border-card)',
                    background:
                      planData.intermaxillaryElastic === opt.val
                        ? 'var(--badge-setup-bg)'
                        : 'var(--bg-card)',
                    color:
                      planData.intermaxillaryElastic === opt.val
                        ? 'var(--cyan-primary)'
                        : 'var(--text-secondary)',
                    boxShadow: planData.intermaxillaryElastic === opt.val ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Correções Sagitais (Classe II e III) */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--cyan-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Layers size={18} />
          <span>3. Correção Sagital de Classe (Angle)</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Classe II */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '4px' }}>
              Correção de Classe II
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Distalização sequencial superior / avanço mandibular.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => updateField('classIICorrection', CORRECTION_OPTION.CORRECT)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border:
                    planData.classIICorrection === CORRECTION_OPTION.CORRECT
                      ? '1.5px solid var(--cyan-primary)'
                      : '1px solid var(--border-card)',
                  background:
                    planData.classIICorrection === CORRECTION_OPTION.CORRECT
                      ? 'var(--badge-setup-bg)'
                      : 'var(--bg-card)',
                  color:
                    planData.classIICorrection === CORRECTION_OPTION.CORRECT
                      ? 'var(--cyan-primary)'
                      : 'var(--text-secondary)',
                  boxShadow: planData.classIICorrection === CORRECTION_OPTION.CORRECT ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Corrigir
              </button>
              <button
                type="button"
                onClick={() => updateField('classIICorrection', CORRECTION_OPTION.DO_NOT_CORRECT)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border:
                    planData.classIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT
                      ? '1.5px solid var(--cyan-primary)'
                      : '1px solid var(--border-card)',
                  background:
                    planData.classIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT
                      ? 'var(--badge-setup-bg)'
                      : 'var(--bg-card)',
                  color:
                    planData.classIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT
                      ? 'var(--cyan-primary)'
                      : 'var(--text-secondary)',
                  boxShadow: planData.classIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Não corrigir
              </button>
            </div>
          </div>

          {/* Classe III */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '4px' }}>
              Correção de Classe III
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Distalização inferior / proclinação incisivos superiores.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => updateField('classIIICorrection', CORRECTION_OPTION.CORRECT)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border:
                    planData.classIIICorrection === CORRECTION_OPTION.CORRECT
                      ? '1.5px solid var(--cyan-primary)'
                      : '1px solid var(--border-card)',
                  background:
                    planData.classIIICorrection === CORRECTION_OPTION.CORRECT
                      ? 'var(--badge-setup-bg)'
                      : 'var(--bg-card)',
                  color:
                    planData.classIIICorrection === CORRECTION_OPTION.CORRECT
                      ? 'var(--cyan-primary)'
                      : 'var(--text-secondary)',
                  boxShadow: planData.classIIICorrection === CORRECTION_OPTION.CORRECT ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Corrigir
              </button>
              <button
                type="button"
                onClick={() => updateField('classIIICorrection', CORRECTION_OPTION.DO_NOT_CORRECT)}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border:
                    planData.classIIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT
                      ? '1.5px solid var(--cyan-primary)'
                      : '1px solid var(--border-card)',
                  background:
                    planData.classIIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT
                      ? 'var(--badge-setup-bg)'
                      : 'var(--bg-card)',
                  color:
                    planData.classIIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT
                      ? 'var(--cyan-primary)'
                      : 'var(--text-secondary)',
                  boxShadow: planData.classIIICorrection === CORRECTION_OPTION.DO_NOT_CORRECT ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Não corrigir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Smart Attachments, Diastemas e Instruções */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--cyan-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={18} />
          <span>4. Fechamento de Diastemas e Instruções Adicionais</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Diastemas */}
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '8px' }}>
              Diastemas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                { val: DIASTEMA_OPTION.NONE, label: 'Nenhum' },
                { val: DIASTEMA_OPTION.CLOSE_ALL, label: 'Fechar todos' },
                { val: DIASTEMA_OPTION.CLOSE_SELECTED, label: 'Fechar selecionados' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => updateField('diastemas', opt.val)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    border:
                      planData.diastemas === opt.val
                        ? '1.5px solid var(--cyan-primary)'
                        : '1px solid var(--border-card)',
                    background:
                      planData.diastemas === opt.val
                        ? 'var(--badge-setup-bg)'
                        : 'var(--bg-card)',
                    color:
                      planData.diastemas === opt.val
                        ? 'var(--cyan-primary)'
                        : 'var(--text-secondary)',
                    boxShadow: planData.diastemas === opt.val ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Smart Attachments */}
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '6px' }}>
              Smart Attachments / Especificações de Attachments
            </div>
            <input
              type="text"
              value={planData.smartAttachments || ''}
              onChange={(e) => updateField('smartAttachments', e.target.value)}
              placeholder="Ex: Otimizados para rotação nos caninos ou extrusão nos incisivos..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                color: 'var(--input-text)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Instruções adicionais */}
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} />
              <span>Instruções Adicionais para o Planejador 3D / Ortodontista</span>
            </div>
            <textarea
              rows={4}
              value={planData.additionalInstructions || ''}
              onChange={(e) => updateField('additionalInstructions', e.target.value)}
              placeholder="Descreva detalhes específicos de prioridade, restrições a dentes com implante/endodontia, preferência de estadiamento..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                color: 'var(--input-text)',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '10px',
        }}
      >
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
          <span>Voltar</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="btn-glow"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0284c7 0%, #009b9c 100%)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Continuar para Arquivos Clínicos</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

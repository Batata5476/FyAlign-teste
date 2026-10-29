'use client';

import React, { useState } from 'react';
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Camera,
  Activity,
  Box,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { SLOTS_METADATA } from '@/lib/storage/validator';
import { getCaseFileTypeBySlot } from '@/lib/types/clinical';
import { FileSlotInfo } from './types';
import { ClinicalFileSlot } from './ClinicalFileSlot';
import { ClinicalProtocolExampleGuide } from './ClinicalProtocolExampleGuide';

interface StepClinicalFilesProps {
  caseId: string | null;
  files: Record<number, FileSlotInfo>;
  onSlotChange: (slotNumber: number, updated: Partial<FileSlotInfo>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepClinicalFiles({
  caseId,
  files,
  onSlotChange,
  onNext,
  onBack,
}: StepClinicalFilesProps) {
  // Calcula estatísticas dos 13 slots
  const totalSlots = 13;
  const completedSlots = Object.values(files).filter((s) => s.status === 'UPLOADED').length;
  const isAllComplete = completedSlots === totalSlots;
  const progressPercent = Math.round((completedSlots / totalSlots) * 100);

  // Começa por padrão na aba "Exemplo de Preenchimento" se nenhum slot foi preenchido ainda
  const [filterCategory, setFilterCategory] = useState<string>(
    completedSlots === 0 ? 'EXAMPLE_GUIDE' : 'ALL'
  );

  const categories = [
    { key: 'EXAMPLE_GUIDE', label: '📖 Exemplo de Preenchimento', icon: Sparkles, highlight: true },
    { key: 'ALL', label: 'Todos os Slots (13)', icon: Layers },
    { key: 'EXTRAORAL', label: 'Fotos Extraorais (3)', icon: Camera },
    { key: 'INTRAORAL', label: 'Fotos Intraorais (5)', icon: Activity },
    { key: 'RADIOGRAPH', label: 'Radiografias (2)', icon: FileText },
    { key: 'SCAN_3D', label: 'Escaneamento 3D (3)', icon: Box },
  ];

  const slotsList = Array.from({ length: 13 }, (_, i) => i + 1);

  const filteredSlots = slotsList.filter((slotNum) => {
    if (filterCategory === 'ALL') return true;
    return SLOTS_METADATA[slotNum]?.category === filterCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Etapa 5 — Documentação e Arquivos Clínicos (13 Slots)
          </h2>
          {filterCategory === 'EXAMPLE_GUIDE' && (
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 210, 211, 0.15)',
                color: 'var(--cyan-primary)',
                border: '1px solid rgba(0, 210, 211, 0.3)',
              }}
            >
              Guia Visual
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          O protocolo FyAlign exige o envio completo de 13 arquivos padronizados (fotos, radiografias e escaneamentos STL).
        </p>
      </div>

      {/* Card de Progresso Geral */}
      <div
        style={{
          padding: '22px 24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Progresso do Protocolo Clínico
            </span>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '3px 12px',
                borderRadius: '999px',
                background: isAllComplete ? 'var(--badge-approved-bg)' : 'var(--badge-setup-bg)',
                color: isAllComplete ? 'var(--badge-approved-text)' : 'var(--cyan-primary)',
                border: isAllComplete ? '1px solid var(--badge-approved-border)' : '1px solid var(--badge-setup-border)',
              }}
            >
              {completedSlots} de {totalSlots} concluídos ({progressPercent}%)
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            {isAllComplete
              ? 'Todos os 13 arquivos obrigatórios foram processados e validados com sucesso.'
              : 'Faça o upload dos arquivos em cada slot correspondente para habilitar o envio do caso.'}
          </div>
        </div>

        {/* Barra de progresso e botão de atalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ width: '180px' }}>
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '999px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: isAllComplete
                    ? '#10b981'
                    : 'linear-gradient(90deg, var(--cyan-primary) 0%, #0284c7 100%)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {filterCategory !== 'EXAMPLE_GUIDE' && (
            <button
              type="button"
              onClick={() => setFilterCategory('EXAMPLE_GUIDE')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'rgba(0, 210, 211, 0.1)',
                border: '1px solid rgba(0, 210, 211, 0.3)',
                color: 'var(--cyan-primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <BookOpen size={13} />
              <span>Ver Guia de Exemplo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtro por Categorias (com a primeira aba de Exemplo de Preenchimento) */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map((cat) => {
          const isSelected = filterCategory === cat.key;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setFilterCategory(cat.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: isSelected
                  ? '1.5px solid var(--cyan-primary)'
                  : cat.highlight
                  ? '1px solid rgba(0, 210, 211, 0.35)'
                  : '1px solid var(--border-card)',
                background: isSelected
                  ? 'var(--badge-setup-bg)'
                  : cat.highlight
                  ? 'rgba(0, 210, 211, 0.05)'
                  : 'var(--bg-card)',
                color: isSelected
                  ? 'var(--cyan-primary)'
                  : cat.highlight
                  ? 'var(--cyan-primary)'
                  : 'var(--text-secondary)',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(0, 210, 211, 0.2)'
                  : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL: ABA DE EXEMPLO vs GRID DE UPLOAD DOS SLOTS */}
      {filterCategory === 'EXAMPLE_GUIDE' ? (
        <ClinicalProtocolExampleGuide
          onGoToSlots={(targetCategory) => setFilterCategory(targetCategory || 'ALL')}
          completedSlotsCount={completedSlots}
          totalSlotsCount={totalSlots}
        />
      ) : (
        <>
          {/* Grid com os 13 Slots */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '18px',
            }}
          >
            {filteredSlots.map((slotNum) => {
              const slotMeta = SLOTS_METADATA[slotNum];
              const slotType = getCaseFileTypeBySlot(slotNum);
              const currentSlotInfo: FileSlotInfo = files[slotNum] || {
                slotNumber: slotNum,
                title: slotMeta.title,
                category: slotMeta.category,
                type: slotType!,
                description: slotMeta.description,
                allowedExtensions: slotMeta.allowedExtensions,
                maxSizeBytes: slotMeta.maxSizeBytes,
                required: slotMeta.required,
                status: 'EMPTY',
              };

              return (
                <ClinicalFileSlot
                  key={slotNum}
                  caseId={caseId}
                  slotInfo={currentSlotInfo}
                  onSlotChange={onSlotChange}
                />
              );
            })}
          </div>

          {/* Alerta caso faltem slots (Ajustado com alto contraste para Light e Dark) */}
          {!isAllComplete && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                background: 'var(--badge-warning-bg)',
                border: '1px solid var(--badge-warning-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <AlertTriangle size={22} style={{ color: 'var(--badge-warning-text)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.88rem', color: 'var(--badge-warning-text)', lineHeight: 1.45, fontWeight: 500 }}>
                <strong style={{ fontWeight: 700 }}>Atenção:</strong> Todos os 13 slots devem estar concluídos para finalizar o envio clínico à FyAlign.
                Você ainda pode avançar para revisar as outras etapas e retornar a qualquer momento.
              </div>
            </div>
          )}
        </>
      )}

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
          <span>Voltar para Plano de Tratamento</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {filterCategory === 'EXAMPLE_GUIDE' ? (
            <button
              type="button"
              onClick={() => setFilterCategory('ALL')}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 24px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <span>Preencher Slots ({completedSlots}/13)</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 24px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <span>Avançar para Termo de Consentimento</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

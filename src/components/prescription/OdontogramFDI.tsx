'use client';

import React from 'react';
import { Lock, Ban, ShieldAlert, Sparkles, AlertCircle, Info } from 'lucide-react';

interface OdontogramProps {
  restrictedTeeth: string[]; // Dentes que NÃO devem mover (implantes, etc.)
  extractedTeeth?: string[]; // Dentes planejados para extração
  onChange: (restricted: string[], extracted: string[]) => void;
  readOnly?: boolean;
}

export function OdontogramFDI({
  restrictedTeeth,
  extractedTeeth = [],
  onChange,
  readOnly = false,
}: OdontogramProps) {
  // Notação Dentária FDI (32 dentes permanentes organizados em quadrantes)
  const upperRight = ['18', '17', '16', '15', '14', '13', '12', '11'];
  const upperLeft = ['21', '22', '23', '24', '25', '26', '27', '28'];
  const lowerRight = ['48', '47', '46', '45', '44', '43', '42', '41'];
  const lowerLeft = ['31', '32', '33', '34', '35', '36', '37', '38'];

  const handleToothClick = (tooth: string) => {
    if (readOnly) return;

    const isRestricted = restrictedTeeth.includes(tooth);
    const isExtracted = extractedTeeth.includes(tooth);

    if (!isRestricted && !isExtracted) {
      // Normal -> Não Movimentar
      onChange([...restrictedTeeth, tooth], extractedTeeth);
    } else if (isRestricted && !isExtracted) {
      // Não Movimentar -> Extração Planejada
      onChange(
        restrictedTeeth.filter((t) => t !== tooth),
        [...extractedTeeth, tooth]
      );
    } else {
      // Extração Planejada -> Normal
      onChange(
        restrictedTeeth.filter((t) => t !== tooth),
        extractedTeeth.filter((t) => t !== tooth)
      );
    }
  };

  const getToothStyle = (tooth: string) => {
    const isRestricted = restrictedTeeth.includes(tooth);
    const isExtracted = extractedTeeth.includes(tooth);

    if (isRestricted) {
      return {
        background: 'var(--badge-danger-bg)',
        border: '1.5px solid var(--badge-danger-border)',
        color: 'var(--badge-danger-text)',
        shadow: '0 0 10px rgba(239, 68, 68, 0.3)',
      };
    }
    if (isExtracted) {
      return {
        background: 'var(--badge-warning-bg)',
        border: '1.5px solid var(--badge-warning-border)',
        color: 'var(--badge-warning-text)',
        shadow: '0 0 10px rgba(245, 158, 11, 0.3)',
      };
    }
    return {
      background: 'var(--tooth-normal-bg)',
      border: '1px solid var(--tooth-normal-border)',
      color: 'var(--text-main)',
      shadow: 'var(--shadow-sm)',
    };
  };

  const renderTooth = (tooth: string) => {
    const style = getToothStyle(tooth);
    const isRestricted = restrictedTeeth.includes(tooth);
    const isExtracted = extractedTeeth.includes(tooth);

    return (
      <button
        key={tooth}
        type="button"
        onClick={() => handleToothClick(tooth)}
        disabled={readOnly}
        title={
          isRestricted
            ? `Dente #${tooth}: Não movimentar (Implante/Prótese)`
            : isExtracted
            ? `Dente #${tooth}: Extração Planejada`
            : `Dente #${tooth}: Movimentação Liberada (Clique para alterar)`
        }
        style={{
          width: '42px',
          height: '52px',
          borderRadius: '8px',
          background: style.background,
          border: style.border,
          color: style.color,
          boxShadow: style.shadow,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>
          {tooth}
        </span>
        <div style={{ height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRestricted ? (
            <Lock size={12} color="var(--crimson-danger)" />
          ) : isExtracted ? (
            <Ban size={12} color="var(--amber-warning)" />
          ) : (
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header do Odontograma */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--cyan-primary)" />
            <span>Odontograma Interativo (Notação FDI)</span>
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Clique no dente para alternar entre: <strong>Normal</strong> ➔ <strong>Não Movimentar (Implante/Prótese)</strong> ➔ <strong>Extração</strong>.
          </p>
        </div>

        {/* Legenda dos Estados */}
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(15, 33, 61, 0.9)', border: '1px solid rgba(255,255,255,0.2)' }} />
            <span style={{ color: 'var(--text-dim)' }}>Normal (Mover)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid var(--crimson-danger)' }} />
            <span style={{ color: '#fca5a5', fontWeight: 600 }}>Não Movimentar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.3)', border: '1px solid var(--amber-warning)' }} />
            <span style={{ color: '#fcd34d', fontWeight: 600 }}>Extração</span>
          </div>
        </div>
      </div>

      {/* Grid de Arcadas Anatômicas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        {/* ARCADA SUPERIOR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Arcada Superior (Maxila)
          </span>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            {/* Quadrante 1 (Direito) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {upperRight.map(renderTooth)}
            </div>
            {/* Linha Média Central Superior */}
            <div style={{ width: '2px', background: 'rgba(0, 210, 211, 0.4)', margin: '0 4px', borderRadius: '1px' }} />
            {/* Quadrante 2 (Esquerdo) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {upperLeft.map(renderTooth)}
            </div>
          </div>
        </div>

        {/* Linha Divisória de Oclusão */}
        <div style={{ width: '90%', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

        {/* ARCADA INFERIOR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            {/* Quadrante 4 (Direito) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {lowerRight.map(renderTooth)}
            </div>
            {/* Linha Média Central Inferior */}
            <div style={{ width: '2px', background: 'rgba(0, 210, 211, 0.4)', margin: '0 4px', borderRadius: '1px' }} />
            {/* Quadrante 3 (Esquerdo) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {lowerLeft.map(renderTooth)}
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
            Arcada Inferior (Mandíbula)
          </span>
        </div>
      </div>

      {/* Resumo de Restrições Ativas */}
      {(restrictedTeeth.length > 0 || extractedTeeth.length > 0) && (
        <div style={{
          marginTop: '20px',
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} color="var(--cyan-primary)" />
            <span>
              Restrições Registradas para o Planejador CAD 3D:
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            {restrictedTeeth.length > 0 && (
              <span style={{ color: '#fca5a5' }}>
                <strong>{restrictedTeeth.length}</strong> não movimentar ({restrictedTeeth.map(t => `#${t}`).join(', ')})
              </span>
            )}
            {extractedTeeth.length > 0 && (
              <span style={{ color: '#fcd34d' }}>
                <strong>{extractedTeeth.length}</strong> extrações ({extractedTeeth.map(t => `#${t}`).join(', ')})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle,
  Truck,
  Box,
  Eye,
  MessageSquare,
  ShieldCheck,
  Send,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CaseChatModal } from '@/components/chat/CaseChatModal';
import { useAuth } from '@/lib/auth/AuthContext';

interface KanbanCase {
  id: string;
  caseCode: string;
  status: string;
  treatedArches: string;
  hoursElapsed: number;
  remainingHours: number;
  isSlaBreached: boolean;
  clinic: { tradeName: string; city: string; state: string };
  patient: { fullName: string };
  doctor: { fullName: string; professionalIdCro?: string | null };
  assignedPlanner?: { id: string; fullName: string } | null;
  activeSetup?: { id: string; versionNumber: number; upperAlignersCount: number; lowerAlignersCount: number } | null;
  activeOrder?: { orderCode: string; trackingCode?: string | null } | null;
}

const COLUMNS_CONFIG = [
  { key: 'SUBMITTED', title: '1. Triagem Técnica', color: '#00d2d3' },
  { key: 'CAD_DESIGN', title: '2. Modelagem CAD 3D', color: '#38bdf8' },
  { key: 'WAITING_DOCTOR_APPROVAL', title: '3. Aguardando Doutor', color: '#fbbf24' },
  { key: 'APPROVED', title: '4. Aprovado / Gerar OP', color: '#10b981' },
  { key: 'IN_PRODUCTION', title: '5. Termoformagem & Corte', color: '#818cf8' },
  { key: 'QUALITY_CONTROL', title: '6. Controle de Qualidade', color: '#c084fc' },
  { key: 'DISPATCHED', title: '7. Expedição / Trânsito', color: '#f472b6' },
  { key: 'DELIVERED', title: '8. Entregue à Clínica', color: '#4ade80' },
];

export default function LabKanbanPage() {
  const router = useRouter();
  const { can, canAny } = useAuth();
  const canViewSetup = can('SETUP_READ');
  const canExecuteQc = canAny(['QC_EXECUTE', 'PRODUCTION_QC_RELEASE']);
  const canDispatch = canAny(['SHIPMENT_DISPATCH', 'DISPATCH_MANAGE']);
  const canStartCad = canAny(['CASE_UPDATE', 'PRODUCTION_UPDATE', 'TRIAGE_CASE']);
  const canMoveProduction = can('PRODUCTION_UPDATE');

  const [columns, setColumns] = useState<Record<string, KanbanCase[]>>({});
  const [totalCases, setTotalCases] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modais
  const [activeChatCase, setActiveChatCase] = useState<KanbanCase | null>(null);
  const [qcModalCase, setQcModalCase] = useState<KanbanCase | null>(null);
  const [dispatchModalCase, setDispatchModalCase] = useState<KanbanCase | null>(null);

  // Estados dos modais de ação
  const [carrierName, setCarrierName] = useState('Correios Sedex');
  const [trackingCode, setTrackingCode] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Controle de Deslize do Carrossel da Esteira
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const checkScrollLimits = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 15);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 15);
    // Cada coluna tem 295px + 16px de gap = 311px
    const idx = Math.round(el.scrollLeft / 311);
    setCurrentSlideIndex(Math.min(COLUMNS_CONFIG.length - 1, Math.max(0, idx)));
  }, []);

  const slideKanban = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const amount = 311 * 2; // Desliza exatamente 2 colunas
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const scrollToIndex = (index: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      left: index * 311,
      behavior: 'smooth',
    });
  };

  const [qcChecklist, setQcChecklist] = useState({
    laserMarkingVerified: true,
    edgeLaserCutVerified: true,
    opticalClarityVerified: true,
    noBubblesOrDefects: true,
    alignersQuantityVerified: true,
  });
  const [qcLoading, setQcLoading] = useState(false);

  const fetchKanban = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/lab/kanban');
      if (res.ok) {
        const data = await res.json();
        setColumns(data.columns || {});
        setTotalCases(data.totalCases || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKanban();
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const timer = setTimeout(checkScrollLimits, 250);
    el.addEventListener('scroll', checkScrollLimits, { passive: true });
    window.addEventListener('resize', checkScrollLimits);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkScrollLimits);
      window.removeEventListener('resize', checkScrollLimits);
    };
  }, [columns, checkScrollLimits]);

  const handleMoveStatus = async (caseId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchKanban();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePerformQc = async () => {
    if (!qcModalCase) return;
    try {
      setQcLoading(true);
      const res = await fetch(`/api/cases/${qcModalCase.id}/qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qcChecklist),
      });
      if (res.ok) {
        setQcModalCase(null);
        fetchKanban();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQcLoading(false);
    }
  };

  const handlePerformDispatch = async () => {
    if (!dispatchModalCase || !trackingCode) return;
    try {
      setDispatchLoading(true);
      const res = await fetch(`/api/cases/${dispatchModalCase.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrierName, trackingCode }),
      });
      if (res.ok) {
        setDispatchModalCase(null);
        setTrackingCode('');
        fetchKanban();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDispatchLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header do Kanban */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="var(--cyan-primary)" />
            Esteira Fabril & Gestão Operacional (Kanban Lab)
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Monitoramento em tempo real do fluxo de manufatura • SLA alvo de 72h úteis para setup CAD
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Controles de Deslize do Carrossel no Header */}
          <div className="kanban-carousel-controller">
            <button
              type="button"
              onClick={() => slideKanban('left')}
              disabled={!canScrollLeft}
              className="carousel-ctrl-btn"
              title="Deslizar esteira para a esquerda"
              aria-label="Deslizar esteira para a esquerda"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="carousel-step-indicators">
              {COLUMNS_CONFIG.map((col, idx) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => scrollToIndex(idx)}
                  className={`carousel-dot ${currentSlideIndex === idx ? 'active' : ''}`}
                  title={`Ir para etapa ${col.title}`}
                  style={{ '--dot-color': col.color } as React.CSSProperties}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => slideKanban('right')}
              disabled={!canScrollRight}
              className="carousel-ctrl-btn"
              title="Deslizar esteira para a direita"
              aria-label="Deslizar esteira para a direita"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
            Total em Esteira: <strong style={{ color: 'var(--cyan-primary)' }}>{totalCases} casos</strong>
          </div>
          <button onClick={fetchKanban} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            Atualizar
          </button>
        </div>
      </div>

      {/* Wrapper do Carrossel com Setas Flutuantes */}
      <div className="kanban-carousel-wrapper">
        {/* Seta Flutuante Esquerda */}
        <button
          type="button"
          onClick={() => slideKanban('left')}
          className={`kanban-carousel-btn kanban-carousel-btn-left ${!canScrollLeft ? 'disabled' : ''}`}
          aria-label="Deslizar esteira para a esquerda"
          title="Deslizar esteira para a esquerda"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Seta Flutuante Direita */}
        <button
          type="button"
          onClick={() => slideKanban('right')}
          className={`kanban-carousel-btn kanban-carousel-btn-right ${!canScrollRight ? 'disabled' : ''}`}
          aria-label="Deslizar esteira para a direita"
          title="Deslizar esteira para a direita"
        >
          <ChevronRight size={22} />
        </button>

        {/* Grid de Colunas do Kanban com Scroll Ref */}
        <div ref={scrollContainerRef} className="kanban-board-scroll">
          <div className="kanban-columns-container">
            {COLUMNS_CONFIG.map((col) => {
              const caseList = columns[col.key] || [];
              return (
                <div key={col.key} className="kanban-column">
                  <div className="column-header" style={{ borderTop: `3px solid ${col.color}` }}>
                    <div className="column-title-group">
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                      <span className="column-title">{col.title}</span>
                    </div>
                    <span className="column-count-badge">{caseList.length}</span>
                  </div>

                  <div className="column-cards-container">
                  {caseList.map((c) => (
                    <div key={c.id} className={`kanban-card ${c.isSlaBreached ? 'card-sla-breached' : ''}`}>
                      {/* SLA Alert Badge */}
                      <div className="card-top-row">
                        <span className="card-code">{c.caseCode}</span>
                        {c.isSlaBreached ? (
                          <span className="sla-badge-alert">
                            <AlertTriangle size={12} /> SLA +{c.hoursElapsed}h
                          </span>
                        ) : (
                          <span className="sla-badge-ok">
                            <Clock size={12} /> {c.remainingHours}h restantes
                          </span>
                        )}
                      </div>

                      {/* Dados Clínicos */}
                      <div className="card-patient-name">{c.patient.fullName}</div>
                      <div className="card-clinic-info">
                        {c.clinic.tradeName} ({c.clinic.city}-{c.clinic.state})
                      </div>

                      {/* Setup Info */}
                      {c.activeSetup && (
                        <div className="card-setup-badge">
                          Setup v{c.activeSetup.versionNumber} ({c.activeSetup.upperAlignersCount}U / {c.activeSetup.lowerAlignersCount}L)
                        </div>
                      )}

                      {/* Tracking Info */}
                      {c.activeOrder?.trackingCode && (
                        <div className="card-tracking-badge">
                          <Truck size={12} /> {c.activeOrder.trackingCode}
                        </div>
                      )}

                      {/* Ações do Card */}
                      <div className="card-actions-row">
                        {c.activeSetup && canViewSetup && (
                          <button
                            title="Visualizar Setup 3D"
                            className="btn-card-action"
                            onClick={() => router.push(`/dashboard/cases/${c.id}/setup`)}
                          >
                            <Eye size={14} />
                          </button>
                        )}

                        <button
                          title="Abrir Chat Clínico"
                          className="btn-card-action"
                          onClick={() => setActiveChatCase(c)}
                        >
                          <MessageSquare size={14} />
                        </button>

                        {/* Ações por fase */}
                        {col.key === 'IN_PRODUCTION' && canExecuteQc && (
                          <button
                            title="Inspecionar Controle de Qualidade (QC)"
                            className="btn-card-action-highlight"
                            onClick={() => setQcModalCase(c)}
                          >
                            <ShieldCheck size={14} /> QC
                          </button>
                        )}

                        {col.key === 'QUALITY_CONTROL' && canDispatch && (
                          <button
                            title="Despachar com Rastreamento"
                            className="btn-card-action-highlight"
                            onClick={() => setDispatchModalCase(c)}
                          >
                            <Truck size={14} /> Despachar
                          </button>
                        )}

                        {/* Avançar status rápido */}
                        {col.key === 'SUBMITTED' && canStartCad && (
                          <button
                            className="btn-card-action-next"
                            onClick={() => handleMoveStatus(c.id, 'CAD_DESIGN')}
                          >
                            Iniciar CAD →
                          </button>
                        )}
                        {col.key === 'APPROVED' && canMoveProduction && (
                          <button
                            className="btn-card-action-next"
                            onClick={() => handleMoveStatus(c.id, 'IN_PRODUCTION')}
                          >
                            Produzir →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {caseList.length === 0 && (
                    <div className="column-empty-placeholder">
                      <div className="column-empty-icon">
                        <Box size={22} strokeWidth={1.5} />
                      </div>
                      <span>Aguardando casos nesta etapa</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Modal de Chat Contextual */}
      {activeChatCase && (
        <CaseChatModal
          caseId={activeChatCase.id}
          caseCode={activeChatCase.caseCode}
          patientName={activeChatCase.patient.fullName}
          isOpen={true}
          onClose={() => setActiveChatCase(null)}
        />
      )}

      {/* Modal de QC Inspection */}
      {qcModalCase && (
        <div className="modal-backdrop">
          <div className="action-modal-card">
            <h3>Controle de Qualidade (QC) • {qcModalCase.caseCode}</h3>
            <p>Confirme os 5 itens da inspeção fabril antes de liberar o lote para despacho:</p>

            <div className="checklist-items">
              <label>
                <input
                  type="checkbox"
                  checked={qcChecklist.laserMarkingVerified}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, laserMarkingVerified: e.target.checked })}
                />
                <span>Gravação a laser do identificador do alinhador inspecionada</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qcChecklist.edgeLaserCutVerified}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, edgeLaserCutVerified: e.target.checked })}
                />
                <span>Corte a laser das margens gengivais liso e sem rebarbas</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qcChecklist.opticalClarityVerified}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, opticalClarityVerified: e.target.checked })}
                />
                <span>Transparência ótica e ausência de manchas nos alinhadores</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qcChecklist.noBubblesOrDefects}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, noBubblesOrDefects: e.target.checked })}
                />
                <span>Ausência de bolhas ou deformações na termoformagem</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qcChecklist.alignersQuantityVerified}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, alignersQuantityVerified: e.target.checked })}
                />
                <span>Contagem quantitativa total de alinhadores verificada</span>
              </label>
            </div>

            <div className="modal-actions-footer">
              <button className="btn-secondary" onClick={() => setQcModalCase(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handlePerformQc} disabled={qcLoading}>
                {qcLoading ? 'Gravando...' : 'Aprovar QC & Liberar para Expedição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Despacho e Rastreamento */}
      {dispatchModalCase && (
        <div className="modal-backdrop">
          <div className="action-modal-card">
            <h3>Expedição & Rastreamento • {dispatchModalCase.caseCode}</h3>
            <p>Informe a transportadora e código de rastreamento para notificar a clínica:</p>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                Transportadora:
              </label>
              <select
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="form-input"
                style={{ marginBottom: '12px' }}
              >
                <option value="Correios Sedex">Correios Sedex</option>
                <option value="Loggi Express">Loggi Express</option>
                <option value="Total Express">Total Express</option>
                <option value="DHL Express">DHL Express</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Código de Rastreamento*:
              </label>
              <input
                type="text"
                placeholder="Ex: QB123456789BR"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="modal-actions-footer" style={{ marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setDispatchModalCase(null)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handlePerformDispatch}
                disabled={dispatchLoading || !trackingCode}
              >
                {dispatchLoading ? 'Despachando...' : 'Confirmar Envio'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }
        .action-modal-card {
          width: 100%;
          max-width: 480px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 12px;
          padding: 1.5rem;
          color: var(--text-main);
          box-shadow: var(--shadow-elevated);
        }
        .checklist-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 1rem 0;
        }
        .checklist-items label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .modal-actions-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}

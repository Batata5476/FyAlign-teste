'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

function formatBrlFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function getContractBadge(contract: any) {
  if (!contract) {
    return (
      <span
        style={{
          fontSize: '0.73rem',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '12px',
          background: 'rgba(148, 163, 184, 0.14)',
          color: '#cbd5e1',
          border: '1px solid rgba(148, 163, 184, 0.35)',
        }}
      >
        Sem Proposta
      </span>
    );
  }

  if (contract.status === 'CONFIRMED' || contract.status === 'AMENDED') {
    return (
      <span
        style={{
          fontSize: '0.73rem',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.14)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.35)',
        }}
      >
        {contract.status === 'AMENDED'
          ? `Aditado (v${contract.versionNumber})`
          : `Confirmado (v${contract.versionNumber})`}
      </span>
    );
  }

  if (contract.status === 'DRAFT') {
    return (
      <span
        style={{
          fontSize: '0.73rem',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '12px',
          background: 'rgba(245, 158, 11, 0.14)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.35)',
        }}
      >
        Aguardando Confirmação
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: '0.73rem',
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: '12px',
        background: 'rgba(239, 68, 68, 0.14)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.35)',
      }}
    >
      {contract.status}
    </span>
  );
}

export default function ContractsPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const canReadPatient = can('PATIENT_READ');

  const [items, setItems] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    totalTreatments: 0,
    withoutProposal: 0,
    awaitingConfirmation: 0,
    activeConfirmed: 0,
    pendingCommercialRefinements: 0,
    totalConfirmedCents: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'ALL') qs.set('status', statusFilter);
      if (search.trim()) qs.set('search', search.trim());

      const res = await fetch(`/api/contracts?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erro ao carregar contratos comerciais.');
        return;
      }
      setItems(json.items || []);
      if (json.kpis) setKpis(json.kpis);
    } catch {
      setError('Falha de comunicação ao carregar contratos.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  return (
    <div>
      {/* Banner de Governança Comercial & LGPD */}
      {!canReadPatient && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 20px',
            marginBottom: '22px',
            borderLeft: '4px solid var(--cyan-primary)',
            background: 'rgba(0, 210, 211, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <ShieldCheck size={20} color="var(--cyan-primary)" />
          <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-main)' }}>
              Modo Estritamente Comercial (LGPD):
            </strong>{' '}
            Pacientes identificados exclusivamente por código pseudonimizado (<code>PAC-XXXX</code>),
            sem exposição de fotografias, escaneamentos STL, diagnóstico ou planejamento 3D.
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
            Contratos Comerciais & Fechamentos
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Propostas contratuais, homologação do gatilho comercial de produção, aditivos versionados e decisões de refinamento.
          </p>
        </div>

        <button
          type="button"
          onClick={loadContracts}
          className="btn-secondary"
          style={{ padding: '10px 16px', fontSize: '0.84rem' }}
        >
          <RefreshCw size={15} />
          <span>Atualizar Fila</span>
        </button>
      </div>

      {/* KPIs Comerciais */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '26px',
        }}
      >
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Aguardando Confirmação
            </span>
            <Clock size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fbbf24' }}>
            {kpis.awaitingConfirmation}
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Propostas DRAFT para fechamento
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Sem Proposta Emitida
            </span>
            <FileText size={18} color="#94a3b8" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {kpis.withoutProposal}
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Tratamentos submetidos sem orçamento
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '18px', border: '1px solid rgba(16, 185, 129, 0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
              Contratos Ativos
            </span>
            <CheckCircle2 size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399' }}>
            {kpis.activeConfirmed}
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Volume confirmado: {formatBrlFromCents(kpis.totalConfirmedCents)}
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
              Refinamentos Pendentes
            </span>
            <AlertTriangle size={18} color="#f87171" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: kpis.pendingCommercialRefinements > 0 ? '#f87171' : 'var(--text-main)' }}>
            {kpis.pendingCommercialRefinements}
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Extra-franquia retidos para aprovação
          </p>
        </div>
      </div>

      {/* Filtros & Busca */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'DRAFT', label: 'Aguardando Confirmação' },
              { id: 'WITHOUT_PROPOSAL', label: 'Sem Proposta' },
              { id: 'CONFIRMED', label: 'Confirmados / Aditados' },
              { id: 'PENDING_REFINEMENT', label: 'Refinamento Extra Pendente' },
            ].map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    border: active
                      ? '1px solid var(--cyan-primary)'
                      : '1px solid var(--border-subtle)',
                    background: active ? 'rgba(0, 210, 211, 0.14)' : 'var(--btn-ghost-bg)',
                    color: active ? 'var(--cyan-primary)' : 'var(--text-muted)',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', minWidth: '280px' }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder={
                canReadPatient
                  ? 'Buscar por caso, contrato, clínica, doutor ou paciente...'
                  : 'Buscar por caso, PAC-XXXX, contrato, clínica ou doutor...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px', fontSize: '0.83rem' }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Carregando carteira de contratos comerciais...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Nenhum tratamento/contrato encontrado para os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tratamento / Paciente</th>
                  <th>Clínica & Responsável</th>
                  <th>Contrato & Pacote</th>
                  <th>Valor & Pares</th>
                  <th>Gatilho Duplo</th>
                  <th>Entregas</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.caseId}>
                    <td>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: 'var(--cyan-primary)',
                          fontSize: '0.86rem',
                        }}
                      >
                        {item.caseCode}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        {item.patient.fullName
                          ? `${item.patient.fullName} (${item.patient.patientCode})`
                          : item.patient.patientCode}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, fontSize: '0.84rem' }}>
                        <Building2 size={13} color="var(--cyan-primary)" />
                        <span>{item.clinic.tradeName}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {item.doctor.fullName}
                      </div>
                    </td>

                    <td>
                      <div style={{ marginBottom: '4px' }}>{getContractBadge(item.contract)}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.contract
                          ? `${item.contract.contractCode} · ${item.contract.packageName}`
                          : 'Aguardando emissão de proposta'}
                      </div>
                      {item.pendingCommercialRefinementsCount > 0 && (
                        <div style={{ fontSize: '0.73rem', color: '#f87171', fontWeight: 700, marginTop: '3px' }}>
                          ⚠ {item.pendingCommercialRefinementsCount} refinamento(s) aguardando aprovação comercial
                        </div>
                      )}
                    </td>

                    <td>
                      {item.contract ? (
                        <>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            {formatBrlFromCents(item.contract.totalPriceCents)}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            {item.contract.contractedAligners} pares · {item.contract.includedRefinements} ref. franquia
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: item.doubleTrigger.hasInitialApprovedSetup ? '#34d399' : '#fbbf24' }}>
                          {item.doubleTrigger.hasInitialApprovedSetup ? '✓ Setup aprovado' : '⏳ Setup pendente'}
                        </span>
                        <span style={{ color: item.doubleTrigger.isContractConfirmed ? '#34d399' : '#fbbf24' }}>
                          {item.doubleTrigger.isContractConfirmed ? '✓ Contrato confirmado' : '⏳ Contrato pendente'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                        <strong>{item.deliveries.shippedPairs}</strong> / {item.deliveries.contractedAligners || '—'} expedidos
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {item.deliveries.allocatedPairs} alocados em lotes
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/cases/${item.caseId}?tab=COMMERCIAL`)
                        }
                        className="btn-primary"
                        style={{ fontSize: '0.79rem', padding: '7px 13px' }}
                      >
                        <span>Plano & Contrato</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


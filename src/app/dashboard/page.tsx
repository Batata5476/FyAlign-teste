'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderPlus,
  Box,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Edit3,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

type CaseFilterTab = 'ALL' | 'SETUP_READY' | 'PLANNING' | 'PRODUCTION' | 'DRAFT' | 'DELIVERED';

export default function DashboardPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const canReadCases = can('CASE_READ');
  const canReadContracts = can('CONTRACT_READ');
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseFilterTab>('ALL');

  // Redirecionamento automático inteligente para personas estritamente comerciais (ex: FINANCE / Dr. Paulo)
  useEffect(() => {
    if (!canReadCases && canReadContracts) {
      router.replace('/dashboard/contracts');
    }
  }, [canReadCases, canReadContracts, router]);

  useEffect(() => {
    async function loadCases() {
      if (!canReadCases) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/cases');
        if (res.ok) {
          const data = await res.json();
          setCases(data.cases || []);
        }
      } catch (err) {
        console.error('Erro ao carregar casos:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, [canReadCases]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SETUP_AVAILABLE':
      case 'WAITING_DOCTOR_APPROVAL':
        return (
          <span className="badge badge-setup-ready">
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' }}></span>
            Setup Pronto para Análise
          </span>
        );
      case 'APPROVED':
      case 'APPROVED_BY_DOCTOR':
        return (
          <span className="badge badge-approved">
            <Check size={12} />
            Setup Aprovado
          </span>
        );
      case 'IN_PRODUCTION':
      case 'QUALITY_CONTROL':
      case 'QC':
        return (
          <span className="badge badge-production">
            <Clock size={12} />
            Em Fabricação 3D
          </span>
        );
      case 'COMPLETED':
      case 'DELIVERED':
      case 'DISPATCHED':
        return (
          <span className="badge badge-approved">
            <CheckCircle2 size={12} />
            Tratamento Entregue
          </span>
        );
      case 'SUBMITTED':
      case 'CAD_DESIGN':
      case 'IN_PLANNING_3D':
      case 'PLANNING':
        return (
          <span className="badge badge-draft" style={{ color: 'var(--cyan-primary)' }}>
            <Clock size={12} />
            Em Planejamento CAD
          </span>
        );
      case 'DRAFT':
        return (
          <span className="badge badge-draft">
            <FileText size={12} />
            Rascunho / Incompleto
          </span>
        );
      case 'PENDING_DOCS':
        return (
          <span className="badge badge-warning">
            <AlertCircle size={12} />
            Docs Pendentes
          </span>
        );
      case 'REJECTED':
      case 'REVISION_REQUESTED':
        return (
          <span className="badge badge-danger">
            <AlertCircle size={12} />
            Ajustes Solicitados
          </span>
        );
      default:
        return <span className="badge badge-draft">{status}</span>;
    }
  };

  const matchesStatusTab = (c: any, tab: CaseFilterTab): boolean => {
    if (tab === 'ALL') return true;
    if (tab === 'SETUP_READY') {
      return ['SETUP_AVAILABLE', 'WAITING_DOCTOR_APPROVAL'].includes(c.status);
    }
    if (tab === 'PLANNING') {
      return ['SUBMITTED', 'CAD_DESIGN', 'IN_PLANNING_3D', 'PLANNING', 'PENDING_DOCS', 'REJECTED'].includes(c.status);
    }
    if (tab === 'PRODUCTION') {
      return ['APPROVED', 'APPROVED_BY_DOCTOR', 'IN_PRODUCTION', 'QUALITY_CONTROL', 'QC'].includes(c.status);
    }
    if (tab === 'DRAFT') {
      return c.status === 'DRAFT';
    }
    if (tab === 'DELIVERED') {
      return ['DISPATCHED', 'DELIVERED', 'COMPLETED'].includes(c.status);
    }
    return true;
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      !searchTerm.trim() ||
      c.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseCode?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && matchesStatusTab(c, statusFilter);
  });

  const setupsReadyCount = cases.filter((c) =>
    ['SETUP_AVAILABLE', 'WAITING_DOCTOR_APPROVAL'].includes(c.status)
  ).length;
  const inProductionCount = cases.filter((c) =>
    ['APPROVED', 'APPROVED_BY_DOCTOR', 'IN_PRODUCTION', 'QUALITY_CONTROL'].includes(c.status)
  ).length;
  const draftsCount = cases.filter((c) => c.status === 'DRAFT').length;

  return (
    <div>
      {/* Banner Institucional de Conformidade e Governança */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 22px',
          marginBottom: '26px',
          borderLeft: '4px solid var(--cyan-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          background: 'rgba(0, 210, 211, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(0, 210, 211, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} color="var(--cyan-primary)" />
          </div>
          <div>
            <h4 style={{ fontSize: '0.96rem', color: 'var(--text-main)', marginBottom: '2px' }}>
              Portal FyAlign B2B — Ciclo Integrado de Tratamentos, Solicitações e Contratos
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Governança granular por vínculo, minimização de dados sensíveis (LGPD) e rastreabilidade operacional completa.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {can('CONTRACT_READ') && (
            <button
              onClick={() => router.push('/dashboard/contracts')}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              Contratos Comerciais
            </button>
          )}
          {can('AUDIT_READ') && (
            <button
              onClick={() => router.push('/dashboard/audit')}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              Trilha de Auditoria
            </button>
          )}
        </div>
      </div>

      {/* Header com Boas-Vindas e Ação Principal */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, marginBottom: '6px' }}>
            Painel de Tratamentos Ortodônticos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Acompanhe solicitações (Pedido Inicial, Segunda Leva e Refinamentos), prazos e Ficha 360° dos pacientes.
          </p>
        </div>

        {can('CASE_CREATE') && (
          <button
            onClick={() => router.push('/dashboard/cases/new')}
            className="btn-primary"
            style={{ padding: '12px 22px' }}
          >
            <FolderPlus size={18} />
            <span>+ Novo Pedido Inicial</span>
          </button>
        )}
      </div>

      {/* Métricas Interativas do Dashboard (Clicar filtra a tabela) */}
      <div
        className="responsive-grid-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <div
          onClick={() => setStatusFilter('ALL')}
          className="glass-panel"
          style={{
            padding: '20px',
            cursor: 'pointer',
            border:
              statusFilter === 'ALL'
                ? '1.5px solid var(--cyan-primary)'
                : '1px solid var(--border-card)',
          }}
          title="Mostrar todos os tratamentos"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total de Tratamentos
            </span>
            <FileText size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {cases.length}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Vinculados à organização ativa
          </p>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'SETUP_READY' ? 'ALL' : 'SETUP_READY')}
          className="glass-panel"
          style={{
            padding: '20px',
            cursor: 'pointer',
            border:
              statusFilter === 'SETUP_READY'
                ? '1.5px solid var(--cyan-primary)'
                : '1px solid rgba(0, 210, 211, 0.3)',
          }}
          title="Filtrar tratamentos com Setup 3D pronto para análise"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--cyan-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Setups Prontos
            </span>
            <Box size={20} color="var(--cyan-primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
            {setupsReadyCount}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-cyan)', marginTop: '4px' }}>
            Aguardando aprovação clínica
          </p>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'PRODUCTION' ? 'ALL' : 'PRODUCTION')}
          className="glass-panel"
          style={{
            padding: '20px',
            cursor: 'pointer',
            border:
              statusFilter === 'PRODUCTION'
                ? '1.5px solid var(--cyan-primary)'
                : '1px solid var(--border-card)',
          }}
          title="Filtrar tratamentos em produção fabril"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>
              Em Fabricação
            </span>
            <Clock size={20} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {inProductionCount}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Impressão 3D, termoformagem e QC
          </p>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
          className="glass-panel"
          style={{
            padding: '20px',
            cursor: 'pointer',
            border:
              statusFilter === 'DRAFT'
                ? '1.5px solid var(--cyan-primary)'
                : '1px solid var(--border-card)',
          }}
          title="Filtrar rascunhos em preenchimento no Wizard"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Rascunhos
            </span>
            <AlertCircle size={20} color="#94a3b8" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {draftsCount}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Pendente conclusão no Wizard
          </p>
        </div>
      </div>

      {/* Seção da Tabela de Casos */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Tratamentos & Solicitações</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Clique em qualquer tratamento para abrir sua Ficha 360° completa ({user?.organization?.tradeName || 'sua organização'})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '1 1 260px', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Buscar por paciente ou código..."
                className="form-input"
                style={{ paddingLeft: '36px', paddingRight: '12px', height: '40px', fontSize: '0.85rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Barra de Filtros Rápidos Ativa */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {(
            [
              { id: 'ALL', label: `Todos (${cases.length})` },
              { id: 'SETUP_READY', label: `Setups Prontos (${setupsReadyCount})` },
              { id: 'PLANNING', label: 'Em Planejamento CAD' },
              { id: 'PRODUCTION', label: `Em Fabricação (${inProductionCount})` },
              { id: 'DELIVERED', label: 'Entregues' },
              { id: 'DRAFT', label: `Rascunhos (${draftsCount})` },
            ] as { id: CaseFilterTab; label: string }[]
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
                  background: active ? 'rgba(0, 210, 211, 0.14)' : 'var(--btn-ghost-bg)',
                  color: active ? 'var(--cyan-primary)' : 'var(--text-muted)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {!canReadCases ? (
          <div style={{ textAlign: 'center', padding: '56px 16px' }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '8px' }}>
              Redirecionando para a Carteira de Contratos Comerciais...
            </p>
            {canReadContracts && (
              <button
                onClick={() => router.push('/dashboard/contracts')}
                className="btn-primary"
                style={{ padding: '12px 24px', marginTop: '10px' }}
              >
                <FileText size={16} />
                <span>Abrir Gestão de Contratos</span>
              </button>
            )}
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Carregando tratamentos...
          </div>
        ) : filteredCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Nenhum tratamento encontrado para o filtro selecionado.
            </p>
            {statusFilter !== 'ALL' || searchTerm ? (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchTerm('');
                }}
                className="btn-secondary"
              >
                Limpar Filtros
              </button>
            ) : (
              can('CASE_CREATE') && (
                <button onClick={() => router.push('/dashboard/cases/new')} className="btn-primary">
                  Criar Primeiro Pedido Inicial
                </button>
              )
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Paciente</th>
                  <th>Arcadas</th>
                  <th>Status Operacional</th>
                  <th>Alinhadores</th>
                  <th>Data Registro</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const latestSetup = c.setups?.[0];
                  const isDraft = c.status === 'DRAFT';
                  const isSetupReady = ['SETUP_AVAILABLE', 'WAITING_DOCTOR_APPROVAL'].includes(c.status);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan-primary)' }}>
                        {c.caseCode}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {c.patient?.fullName}
                        </div>
                        {c.chiefComplaint && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {c.chiefComplaint.length > 48
                              ? `${c.chiefComplaint.substring(0, 48)}...`
                              : c.chiefComplaint}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {c.treatedArches === 'BOTH' ? 'Superior & Inferior' : c.treatedArches}
                        </span>
                      </td>
                      <td>{getStatusBadge(c.status)}</td>
                      <td>
                        {latestSetup ? (
                          <div style={{ fontSize: '0.82rem' }}>
                            <strong style={{ color: 'var(--cyan-primary)' }}>{latestSetup.upperAlignersCount}</strong> Sup /{' '}
                            <strong style={{ color: 'var(--cyan-primary)' }}>{latestSetup.lowerAlignersCount}</strong> Inf
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Em planejamento</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {isDraft && can('CASE_CREATE') && (
                            <button
                              onClick={() => router.push(`/dashboard/cases/new?caseId=${c.id}`)}
                              className="btn-primary"
                              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                              title="Retomar preenchimento deste pedido no Wizard"
                            >
                              <Edit3 size={13} />
                              <span>Continuar Pedido</span>
                            </button>
                          )}

                          {isSetupReady && can('SETUP_READ') && (
                            <button
                              onClick={() => router.push(`/dashboard/cases/${c.id}/setup`)}
                              className="btn-primary"
                              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                            >
                              <span>Analisar Setup 3D</span>
                              <ArrowUpRight size={13} />
                            </button>
                          )}

                          <button
                            onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                          >
                            <span>Ficha 360°</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

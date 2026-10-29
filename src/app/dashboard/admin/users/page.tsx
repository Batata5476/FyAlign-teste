'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Stethoscope,
  Users,
  FileText,
  AlertCircle,
  Loader2,
  X,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface QueueItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  organizationId: string;
  organizationName: string;
  taxId: string;
  croNumber?: string;
  croUf?: string;
  croStatus: string;
  croVerifiedAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface OrgMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  croStatus?: string;
}

interface Organization {
  id: string;
  tradeName: string;
  legalName: string;
  taxId: string;
  type: string;
  status: string;
  city?: string;
  state?: string;
  createdAt: string;
  totalCases: number;
  totalPatients: number;
  totalMembers: number;
  members: OrgMember[];
}

export default function PlatformAdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'cro' | 'orgs'>('cro');

  // Fila de CRO
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, verified: 0, rejected: 0 });
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  // Organizações
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Modal de Decisão de CRO
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [decisionType, setDecisionType] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

  // Erro Geral
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fetchCroQueue = async () => {
    try {
      setLoadingQueue(true);
      setGeneralError(null);
      const res = await fetch('/api/admin/cro-queue');
      if (!res.ok) {
        if (res.status === 403) {
          setGeneralError('Acesso restrito: Apenas SUPER_ADMIN pode acessar a fila de habilitação profissional.');
          return;
        }
        throw new Error('Falha ao consultar fila de CRO.');
      }
      const data = await res.json();
      setQueue(data.queue || []);
      setSummary(data.summary || { total: 0, pending: 0, verified: 0, rejected: 0 });
    } catch (err: any) {
      setGeneralError(err.message || 'Erro de conexão.');
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const res = await fetch('/api/admin/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  useEffect(() => {
    fetchCroQueue();
  }, []);

  useEffect(() => {
    if (activeTab === 'orgs' && organizations.length === 0) {
      fetchOrganizations();
    }
  }, [activeTab, organizations.length]);

  const handleOpenDecision = (item: QueueItem, decision: 'VERIFIED' | 'REJECTED') => {
    setSelectedItem(item);
    setDecisionType(decision);
    setDecisionNotes('');
    setDecisionError(null);
    setDecisionSuccess(null);
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setDecisionLoading(true);
    setDecisionError(null);
    setDecisionSuccess(null);

    try {
      const res = await fetch(`/api/admin/cro/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionType,
          notes: decisionNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDecisionError(data.error || 'Erro ao registrar decisão de CRO.');
        return;
      }

      setDecisionSuccess(data.message || 'Decisão registrada e auditada com sucesso.');
      await fetchCroQueue();

      setTimeout(() => {
        setSelectedItem(null);
        setDecisionSuccess(null);
      }, 1500);
    } catch (err: any) {
      setDecisionError(err.message || 'Erro de rede.');
    } finally {
      setDecisionLoading(false);
    }
  };

  if (generalError) {
    return (
      <div
        style={{
          padding: '32px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <ShieldAlert size={32} style={{ flexShrink: 0 }} />
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Acesso Restrito ao Painel Master</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{generalError}</p>
        </div>
      </div>
    );
  }

  // Filtragem da Fila
  const filteredQueue = queue.filter((item) => {
    const matchesFilter = queueFilter === 'ALL' || item.croStatus === queueFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      item.fullName.toLowerCase().includes(searchLower) ||
      item.email.toLowerCase().includes(searchLower) ||
      item.organizationName.toLowerCase().includes(searchLower) ||
      (item.croNumber && item.croNumber.includes(searchLower));

    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Principal */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(0, 210, 211, 0.15)',
                color: 'var(--cyan-primary)',
                textTransform: 'uppercase',
              }}
            >
              Governança Master
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              margin: '4px 0 6px',
            }}
          >
            Administração da Plataforma & Validação Regulatória
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
            Fila de habilitação de Cirurgiões-Dentistas (CRO) e visão global de organizações cadastradas.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-card)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => setActiveTab('cro')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'cro' ? 'rgba(0, 210, 211, 0.15)' : 'transparent',
              color: activeTab === 'cro' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <Stethoscope size={16} />
            Fila de Validação CRO
            {summary.pending > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#05101f',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {summary.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orgs')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'orgs' ? 'rgba(0, 210, 211, 0.15)' : 'transparent',
              color: activeTab === 'orgs' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <Building2 size={16} />
            Organizações & Clínicas
          </button>
        </div>
      </div>

      {activeTab === 'cro' && (
        <>
          {/* Métricas da Fila de CRO */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
            }}
          >
            <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Pendentes de Validação
                </span>
                <Clock size={20} color="#f59e0b" />
              </div>
              <p style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f59e0b', margin: '8px 0 0' }}>
                {summary.pending}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Aguardando conferência documental
              </span>
            </div>

            <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  Habilitados (Verificados)
                </span>
                <CheckCircle2 size={20} color="#10b981" />
              </div>
              <p style={{ fontSize: '1.9rem', fontWeight: 800, color: '#10b981', margin: '8px 0 0' }}>
                {summary.verified}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Aptos para aprovação de setups
              </span>
            </div>

            <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                  Documentação Rejeitada
                </span>
                <XCircle size={20} color="#ef4444" />
              </div>
              <p style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ef4444', margin: '8px 0 0' }}>
                {summary.rejected}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Necessitam retificação cadastral
              </span>
            </div>

            <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total de Dentistas
                </span>
                <Users size={20} color="var(--cyan-primary)" />
              </div>
              <p style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '8px 0 0' }}>
                {summary.total}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Cadastrados no ecossistema
              </span>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-card)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                width: '320px',
              }}
            >
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Buscar por médico, clínica ou CRO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  width: '100%',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(['PENDING', 'VERIFIED', 'REJECTED', 'ALL'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setQueueFilter(filterKey)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: queueFilter === filterKey ? 'rgba(0, 210, 211, 0.15)' : 'var(--bg-card)',
                    color: queueFilter === filterKey ? 'var(--cyan-primary)' : 'var(--text-muted)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {filterKey === 'PENDING'
                    ? `Pendentes (${summary.pending})`
                    : filterKey === 'VERIFIED'
                    ? `Habilitados (${summary.verified})`
                    : filterKey === 'REJECTED'
                    ? `Rejeitados (${summary.rejected})`
                    : `Todos (${summary.total})`}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela da Fila de CRO */}
          <div className="card-glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Fila de Verificação de Documentação Odontológica
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Apenas cirurgiões-dentistas com CRO ativo e verificado têm autorização para aprovação de casos.
                </p>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Exibindo {filteredQueue.length} {filteredQueue.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {loadingQueue ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--cyan-primary)' }} />
                <p style={{ margin: 0 }}>Carregando registros de habilitação...</p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto 10px', color: '#10b981' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Nenhum cirurgião-dentista com esse filtro na fila.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--btn-ghost-bg)' }}>
                      <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Cirurgião-Dentista
                      </th>
                      <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Clínica Vinculada
                      </th>
                      <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Registro CRO
                      </th>
                      <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Status do CRO
                      </th>
                      <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>
                        Ações Regulatórias
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: 'rgba(0, 210, 211, 0.15)',
                                color: 'var(--cyan-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                              }}
                            >
                              {item.fullName.charAt(0)}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {item.fullName}
                              </p>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.email}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {item.organizationName}
                          </p>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>CNPJ: {item.taxId}</span>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          {item.croNumber ? (
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              CRO-{item.croUf || 'BR'} {item.croNumber}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontStyle: 'italic' }}>
                              Não preenchido
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '12px',
                                width: 'fit-content',
                                background:
                                  item.croStatus === 'VERIFIED'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : item.croStatus === 'PENDING'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color:
                                  item.croStatus === 'VERIFIED'
                                    ? '#10b981'
                                    : item.croStatus === 'PENDING'
                                    ? '#f59e0b'
                                    : '#ef4444',
                                border: `1px solid ${
                                  item.croStatus === 'VERIFIED'
                                    ? '#10b981'
                                    : item.croStatus === 'PENDING'
                                    ? '#f59e0b'
                                    : '#ef4444'
                                }`,
                              }}
                            >
                              {item.croStatus === 'VERIFIED'
                                ? 'HABILITADO'
                                : item.croStatus === 'PENDING'
                                ? 'PENDENTE'
                                : 'REJEITADO'}
                            </span>
                            {item.croVerifiedAt && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                Em: {new Date(item.croVerifiedAt).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {item.croStatus !== 'VERIFIED' && (
                              <button
                                onClick={() => handleOpenDecision(item, 'VERIFIED')}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  border: '1px solid #10b981',
                                  color: '#10b981',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <CheckCircle2 size={14} />
                                Validar CRO
                              </button>
                            )}

                            {item.croStatus !== 'REJECTED' && (
                              <button
                                onClick={() => handleOpenDecision(item, 'REJECTED')}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <XCircle size={14} />
                                Rejeitar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab: Organizações & Clínicas */}
      {activeTab === 'orgs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loadingOrgs ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--cyan-primary)' }} />
              <p style={{ margin: 0 }}>Consultando ecossistema de organizações...</p>
            </div>
          ) : (
            organizations.map((org) => (
              <div
                key={org.id}
                className="card-glass"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: org.type === 'FYALIGN' ? 'rgba(0, 210, 211, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                        border: `1px solid ${org.type === 'FYALIGN' ? 'var(--cyan-primary)' : 'var(--blue-vibrant)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: org.type === 'FYALIGN' ? 'var(--cyan-primary)' : 'var(--blue-vibrant)',
                      }}
                    >
                      <Building2 size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {org.tradeName}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: org.type === 'FYALIGN' ? 'rgba(0, 210, 211, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                            color: org.type === 'FYALIGN' ? 'var(--cyan-primary)' : 'var(--blue-vibrant)',
                          }}
                        >
                          {org.type === 'FYALIGN' ? 'Laboratório Matriz' : 'Clínica Parceira'}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {org.legalName} • CNPJ: {org.taxId} {org.city ? `• ${org.city}/${org.state}` : ''}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Casos
                      </span>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {org.totalCases}
                      </p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Pacientes
                      </span>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {org.totalPatients}
                      </p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Membros
                      </span>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--cyan-primary)' }}>
                        {org.totalMembers}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lista de Membros da Org */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Corpo de Membros Cadastrados:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {org.members.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{m.fullName}</span>
                        <span style={{ color: 'var(--text-dim)' }}>({m.role})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Decisão de CRO */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(4, 9, 18, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '16px',
          }}
          onClick={() => !decisionLoading && setSelectedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              boxShadow: 'var(--shadow-elevated)',
              overflow: 'hidden',
              animation: 'modalFadeIn 0.2s ease-out',
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}
                >
                  <ShieldCheck size={20} color={decisionType === 'VERIFIED' ? '#10b981' : '#ef4444'} />
                  {decisionType === 'VERIFIED' ? 'Aprovar Habilitação de CRO' : 'Rejeitar Documentação de CRO'}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Decisão formal registrada imutavelmente na trilha de auditoria.
                </p>
              </div>

              <button
                disabled={decisionLoading}
                onClick={() => setSelectedItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmDecision} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {decisionError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{decisionError}</span>
                </div>
              )}

              {decisionSuccess && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{decisionSuccess}</span>
                </div>
              )}

              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Profissional:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedItem.fullName}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Clínica:</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {selectedItem.organizationName}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>CRO Declarado:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cyan-primary)' }}>
                    {selectedItem.croNumber ? `CRO-${selectedItem.croUf || 'BR'} ${selectedItem.croNumber}` : 'Não informado'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {decisionType === 'VERIFIED'
                    ? 'Notas de Validação (Opcional)'
                    : 'Motivo da Rejeição / Pendência Documental *'}
                </label>
                <textarea
                  rows={3}
                  required={decisionType === 'REJECTED'}
                  placeholder={
                    decisionType === 'VERIFIED'
                      ? 'Ex: Registro conferido junto ao Conselho Regional de Odontologia.'
                      : 'Ex: Documento ilegível ou número de registro divergente do cadastro do CFO.'
                  }
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                <button
                  type="button"
                  disabled={decisionLoading}
                  onClick={() => setSelectedItem(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'none',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={decisionLoading}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-sm)',
                    background: decisionType === 'VERIFIED' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: decisionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {decisionLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : decisionType === 'VERIFIED' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  {decisionType === 'VERIFIED' ? 'Confirmar Habilitação' : 'Confirmar Rejeição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Check
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const canReadCases = can('CASE_READ');
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
        return (
          <span className="badge badge-setup-ready">
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' }}></span>
            Setup Pronto para Análise
          </span>
        );
      case 'APPROVED_BY_DOCTOR':
        return (
          <span className="badge badge-approved">
            <Check size={12} />
            Setup Aprovado
          </span>
        );
      case 'IN_PRODUCTION':
        return (
          <span className="badge badge-production">
            <Clock size={12} />
            Em Fabricação 3D
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
        return (
          <span className="badge badge-danger">
            <AlertCircle size={12} />
            Ajustes Solicitados
          </span>
        );
      default:
        return (
          <span className="badge badge-draft">
            {status}
          </span>
        );
    }
  };

  const filteredCases = cases.filter(c =>
    c.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.caseCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const setupsReadyCount = cases.filter(c => c.status === 'SETUP_AVAILABLE').length;
  const inProductionCount = cases.filter(c => c.status === 'IN_PRODUCTION').length;
  const draftsCount = cases.filter(c => c.status === 'DRAFT').length;

  return (
    <div>
      {/* Banner de Auditoria da Fase 1 */}
      <div className="glass-panel" style={{
        padding: '18px 24px',
        marginBottom: '28px',
        borderLeft: '4px solid var(--cyan-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0, 210, 211, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(0, 210, 211, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={24} color="var(--cyan-primary)" />
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '2px' }}>
              Fase 1 Concluída com Sucesso: Arquitetura Base, Multi-Tenancy e RBAC
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Banco relacional ativo com 10 modelos mapeados, isolamento estrito por clínica, autenticação JWT/Cookies e auditoria integrada.
            </p>
          </div>
        </div>

        {can('AUDIT_READ') && (
          <button
            onClick={() => router.push('/dashboard/audit')}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            Ver Checklist de Auditoria
          </button>
        )}
      </div>

      {/* Header com Boas-Vindas e Ação Principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, marginBottom: '6px' }}>
            Painel de Casos Clínicos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Acompanhe o planejamento ortodôntico e a produção de alinhadores dos seus pacientes.
          </p>
        </div>

        {can('CASE_CREATE') && (
          <button
            onClick={() => router.push('/dashboard/cases/new')}
            className="btn-primary"
            style={{ padding: '12px 22px' }}
          >
            <FolderPlus size={18} />
            <span>+ Novo Caso Clínico</span>
          </button>
        )}
      </div>

      {/* Métricas do Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total de Casos
            </span>
            <FileText size={20} color="#64748b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {cases.length}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Cadastrados na sua clínica
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(0, 210, 211, 0.3)' }}>
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
            Aguardando sua aprovação formal
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--amber-warning)', fontWeight: 600, textTransform: 'uppercase' }}>
              Em Fabricação
            </span>
            <Clock size={20} color="var(--amber-warning)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {inProductionCount}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Impressão 3D e corte laser
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
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
            Pendente envio de arquivos
          </p>
        </div>
      </div>

      {/* Seção da Tabela de Casos */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Casos em Andamento</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Lista de casos vinculados a {user?.organization?.tradeName || 'sua organização'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar por paciente ou código..."
                className="form-input"
                style={{ paddingLeft: '36px', paddingRight: '12px', height: '40px', fontSize: '0.85rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button className="btn-secondary" style={{ height: '40px', padding: '0 14px' }}>
              <Filter size={16} />
              <span>Filtrar</span>
            </button>
          </div>
        </div>

        {!canReadCases ? (
          <div style={{ textAlign: 'center', padding: '56px 16px' }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Seu vínculo atual ({user?.role}) opera com escopo administrativo/financeiro sem acesso a prontuários clínicos (LGPD).
            </p>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Carregando casos clínicos...
          </div>
        ) : filteredCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Nenhum caso clínico encontrado.</p>
            {can('CASE_CREATE') && (
              <button
                onClick={() => router.push('/dashboard/cases/new')}
                className="btn-primary"
              >
                Criar Primeiro Caso
              </button>
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
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => {
                  const latestSetup = c.setups?.[0];
                  return (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--cyan-primary)' }}>
                        {c.caseCode}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {c.patient?.fullName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {c.chiefComplaint?.substring(0, 45)}...
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {c.treatedArches === 'BOTH' ? 'Superior & Inferior' : c.treatedArches}
                        </span>
                      </td>
                      <td>
                        {getStatusBadge(c.status)}
                      </td>
                      <td>
                        {latestSetup ? (
                          <div style={{ fontSize: '0.82rem' }}>
                            <strong style={{ color: 'var(--cyan-primary)' }}>{latestSetup.upperAlignersCount}</strong> Sup / <strong style={{ color: 'var(--cyan-primary)' }}>{latestSetup.lowerAlignersCount}</strong> Inf
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Não planejado</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {c.status === 'SETUP_AVAILABLE' && can('SETUP_READ') ? (
                          <button
                            onClick={() => router.push(`/dashboard/cases/${c.id}/setup`)}
                            className="btn-primary"
                            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          >
                            <span>Analisar Setup 3D</span>
                            <ArrowUpRight size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                            className="btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          >
                            <span>Visualizar Caso</span>
                          </button>
                        )}
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

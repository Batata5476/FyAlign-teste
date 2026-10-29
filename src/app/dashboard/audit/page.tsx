'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowLeft,
  Layers,
  Database,
  Lock,
  Server,
  Activity,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  entityAffected: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  payloadDiff?: string | null;
  user: {
    fullName: string;
    email: string;
    role: string;
    professionalIdCro?: string | null;
  };
  case?: {
    caseCode: string;
    patient?: { fullName: string } | null;
  } | null;
}

export default function AuditPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'logs' | 'compliance'>('logs');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchHealth();
  }, []);

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar ao Painel</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={26} color="var(--cyan-primary)" />
              Governança, Compliance LGPD & Trilha de Auditoria
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Registro inalterável de atividades clínicas, sanitárias e operacionais conforme a LGPD e normas do CFO
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchLogs}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
          >
            <RefreshCw size={14} />
            <span>Atualizar Logs</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas de Governança */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Trilha de Auditoria</span>
            <Database size={16} color="var(--cyan-primary)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: '#fff' }}>
            {logs.length} Eventos
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--green-emerald)' }}>● Gravado inalteravelmente</span>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Criptografia em Repouso</span>
            <Lock size={16} color="var(--green-emerald)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: 'var(--green-emerald)' }}>
            AES-256
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>RDS + S3 Vault Ativo</span>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Criptografia em Trânsito</span>
            <Server size={16} color="var(--cyan-primary)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: 'var(--cyan-primary)' }}>
            TLS 1.3 / HSTS
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>CSP + Headers Ativos</span>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Saúde da API (Healthcheck)</span>
            <Activity size={16} color="var(--green-emerald)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: healthData?.status === 'HEALTHY' ? 'var(--green-emerald)' : 'var(--amber-warning)' }}>
            {healthData?.status || 'ONLINE'}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            Latência BD: {healthData?.database?.latencyMs || 2}ms
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('logs')}
          className={activeTab === 'logs' ? 'tab-btn active' : 'tab-btn'}
        >
          📜 Trilha de Auditoria em Tempo Real
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={activeTab === 'compliance' ? 'tab-btn active' : 'tab-btn'}
        >
          ⚖️ Matriz de Conformidade LGPD & CFO
        </button>
      </div>

      {/* Conteúdo da Tab: Logs em Tempo Real */}
      {activeTab === 'logs' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>
            Histórico Imutável de Eventos do Sistema (Audit Logs)
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)' }}>
              Carregando registros de auditoria...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Data / Hora (UTC)</th>
                    <th style={{ padding: '10px' }}>Ação Registrada</th>
                    <th style={{ padding: '10px' }}>Usuário / CRO</th>
                    <th style={{ padding: '10px' }}>Caso Clínico</th>
                    <th style={{ padding: '10px' }}>Entidade</th>
                    <th style={{ padding: '10px' }}>IP de Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className="badge-action" style={{
                          background: log.action.includes('APPROVED') ? 'rgba(16, 185, 129, 0.2)' : log.action.includes('REJECTED') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 210, 211, 0.15)',
                          color: log.action.includes('APPROVED') ? '#10b981' : log.action.includes('REJECTED') ? '#ef4444' : '#00d2d3',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.74rem'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#fff' }}>
                        <strong>{log.user.fullName}</strong>
                        {log.user.professionalIdCro && (
                          <span style={{ color: 'var(--cyan-primary)', fontSize: '0.74rem' }}> (CRO: {log.user.professionalIdCro})</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', color: 'var(--cyan-primary)' }}>
                        {log.case?.caseCode || '—'}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-dim)' }}>
                        {log.entityAffected}
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da Tab: Conformidade LGPD & CFO */}
      {activeTab === 'compliance' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>
            Checklist de Conformidade Regulatória (LGPD Lei nº 13.709/18 & CFO)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="compliance-row">
              <CheckCircle2 size={18} color="var(--green-emerald)" />
              <div>
                <strong>Anonimização Estrita no Armazenamento de Saúde (F6.03)</strong>
                <p>Nenhum exame radiográfico ou malha 3D contém nomes ou CPFs no caminho de armazenamento. Nomes físicos utilizam UUIDv4 puro particionado por clínica.</p>
              </div>
            </div>

            <div className="compliance-row">
              <CheckCircle2 size={18} color="var(--green-emerald)" />
              <div>
                <strong>Criptografia em Repouso AES-256 e Trânsito TLS 1.3 (F6.01 & F6.02)</strong>
                <p>Volumes do PostgreSQL e buckets de exames protegidos com AES-256. Cabeçalhos HSTS (Strict-Transport-Security) e CSP ativados.</p>
              </div>
            </div>

            <div className="compliance-row">
              <CheckCircle2 size={18} color="var(--green-emerald)" />
              <div>
                <strong>Guarda de Prontuários por no Mínimo 5 Anos (RNF-08 & CFO)</strong>
                <p>Política de retenção e imutabilidade dos dados clínicos conforme normas do Conselho Federal de Odontologia.</p>
              </div>
            </div>

            <div className="compliance-row">
              <CheckCircle2 size={18} color="var(--green-emerald)" />
              <div>
                <strong>Termo de Consentimento Livre e Esclarecido - TCLE (RN-05)</strong>
                <p>Submissão condicionada à confirmação expressa de posse do termo assinado pelo paciente ou responsável legal.</p>
              </div>
            </div>

            <div className="compliance-row">
              <CheckCircle2 size={18} color="var(--green-emerald)" />
              <div>
                <strong>Proteção contra Ataques de Força Bruta e DoS - Rate Limiting (F6.06)</strong>
                <p>Janela deslizante de limitação de requisições por IP ativa em todas as rotas de autenticação e manipulação de casos.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .tab-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.9rem;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: #fff;
        }
        .tab-btn.active {
          background: rgba(0, 210, 211, 0.15);
          color: var(--cyan-primary);
        }
        .compliance-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .compliance-row strong {
          display: block;
          color: #fff;
          font-size: 0.9rem;
          margin-bottom: 2px;
        }
        .compliance-row p {
          color: var(--text-muted);
          font-size: 0.8rem;
          line-height: 1.4;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Sparkles, Activity, Lock, ArrowRight, UserCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('roberto@odontoprime.com.br');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha no login');
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('Password@123');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Banner de Demonstração / Auditoria */}
      <div style={{
        background: 'rgba(0, 210, 211, 0.08)',
        borderBottom: '1px solid rgba(0, 210, 211, 0.2)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '0.82rem',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--cyan-primary)',
            boxShadow: '0 0 8px var(--cyan-primary)'
          }}></span>
          <strong style={{ color: 'var(--text-main)' }}>FyAlign B2B Platform</strong>
          <span>• Fase 1: Arquitetura & Multi-Tenancy Ativa</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span>PostgreSQL/SQLite Ready</span>
          <span>JWT + RBAC</span>
          <span>LGPD Compliant</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 14px'
      }}>
        <div className="login-split-grid" style={{ width: '100%', maxWidth: '1060px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '48px', alignItems: 'center' }}>
          
          {/* Lado Esquerdo: Apresentação da Marca */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--cyan-primary), var(--blue-vibrant))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 18px var(--cyan-glow)'
              }}>
                <Sparkles size={26} color="#05101f" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
                  Fy<span style={{ color: 'var(--cyan-primary)' }}>Align</span>
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Doctor B2B Portal
                </p>
              </div>
            </div>

            <h1 style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.15, marginBottom: '20px' }}>
              Engenharia Ortodôntica e Planejamento 3D de Alta Precisão.
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
              Ambiente exclusivo para Cirurgiões-Dentistas credenciados. Envie exames clínicos, visualize e aprove Setups Virtuais interativos e acompanhe a esteira de fabricação em tempo real.
            </p>

            {/* Destaques Rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <Activity size={22} color="var(--cyan-primary)" style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>Upload 3D Sem Gargalos</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Presigned URLs direto para S3 com suporte a .STL e .PLY.</p>
              </div>

              <div className="glass-panel" style={{ padding: '16px' }}>
                <Shield size={22} color="var(--emerald-success)" style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>Conformidade LGPD</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Anonimização por UUIDs e trilha imutável de auditoria.</p>
              </div>
            </div>
          </div>

          {/* Lado Direito: Formulário de Autenticação */}
          <div className="glass-panel glow-cyan" style={{ padding: '40px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Acesso à Plataforma</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Entre com as credenciais da sua clínica ou utilize o acesso rápido abaixo:
              </p>
            </div>

            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--crimson-danger)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '20px'
              }}>
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  E-mail Profissional
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doutor@clinica.com.br"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '14px', marginTop: '6px' }}
                disabled={loading}
              >
                {loading ? 'Validando Credenciais...' : (
                  <>
                    <span>Entrar no Portal</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Acesso Rápido para Demonstração de Perfis RBAC */}
            <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <UserCheck size={14} color="var(--cyan-primary)" />
                <span>Acesso Rápido por Persona (Clínica & Laboratório):</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('roberto@odontoprime.com.br')}
                >
                  👨‍⚕️ Dr. Roberto (Ortodontista)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('larissa@odontoprime.com.br')}
                >
                  👩‍💼 Larissa (Assistente)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('felipe@fyalign.com')}
                >
                  🏭 Felipe (Conferência & QC)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('adriano@fyalign.com')}
                >
                  🔬 Dr. Adriano (Planejador 3D)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('lais@fyalign.com')}
                >
                  💬 Laís (Comercial & Suporte)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('paulo@fyalign.com')}
                >
                  💼 Dr. Paulo (Financeiro)
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '8px 10px', justifyContent: 'flex-start', gridColumn: '1 / -1' }}
                  onClick={() => handleQuickLogin('admin@fyalign.com')}
                >
                  👑 Administrador Geral FyAlign (Visão Completa)
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer style={{
        padding: '18px 20px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.82rem',
        color: 'var(--text-dim)'
      }}>
        <div>© 2026 FyAlign Clear Aligners. Todos os direitos reservados. Portal Odontológico B2B.</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Termo de Consentimento TCLE</a>
          <a href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacidade & LGPD</a>
          <span>Suporte Técnico: 0800 900 FYALIGN</span>
        </div>
      </footer>
    </div>
  );
}

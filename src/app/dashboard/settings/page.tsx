'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  KeyRound,
  LogOut,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Shield,
  Stethoscope,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  CLINIC_ADMIN: 'Administrador da Clínica',
  DOCTOR: 'Cirurgião-Dentista',
  CLINIC_ASSISTANT: 'Assistente Clínico',
  PLANNER_3D: 'Planejador CAD 3D',
  PRODUCTION_QC: 'Controle de Qualidade & Produção',
  FINANCE: 'Financeiro & Contratos',
  SUPPORT: 'Comercial & Suporte Operacional',
  SUPER_ADMIN: 'Administrador Geral FyAlign',
};

interface AccountPayload {
  account: {
    id: string;
    shortId: string;
    fullName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    passwordChangedAt: string | null;
    twoFactorEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  };
  activeOrganization: {
    id: string;
    tradeName: string;
    legalName: string;
    taxId: string;
    type: string;
    status: string;
    city: string | null;
    state: string | null;
    phone: string | null;
  } | null;
  activeMembership: {
    id: string;
    role: string;
    status: string;
    croNumber: string | null;
    croUf: string | null;
    croStatus: string;
    croVerifiedAt: string | null;
    permissions: string[];
    createdAt: string;
  } | null;
  memberships: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    organizationType: string;
    organizationStatus: string;
    role: string;
    status: string;
    croNumber: string | null;
    croUf: string | null;
    croStatus: string;
    isCurrent: boolean;
    permissionsCount: number;
  }>;
  sessions: Array<{
    id: string;
    ipAddress: string;
    userAgent: string;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }>;
  emailTransport: {
    configured: boolean;
    provider: string;
    fromAddress: string;
    hint?: string;
  } | null;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [data, setData] = useState<AccountPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edição de Perfil
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Sessões
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/account');
      if (!res.ok) {
        throw new Error('Falha ao carregar informações da conta.');
      }
      const json: AccountPayload = await res.json();
      setData(json);
      setFullName(json.account.fullName || '');
      setPhone(json.account.phone || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar configurações da conta.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao atualizar perfil.');
      }
      setProfileSuccess(json.message || 'Dados atualizados com sucesso.');
      await refreshUser();
      await loadAccount();
    } catch (err: any) {
      setProfileError(err.message || 'Falha ao salvar alterações.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível alterar a senha.');
      }
      setPasswordSuccess(json.message || 'Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser();
      await loadAccount();
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingSessions(true);
    setSessionMessage(null);
    try {
      const res = await fetch('/api/account/sessions', { method: 'DELETE' });
      const json = await res.json();
      if (res.ok) {
        setSessionMessage(json.message || 'Outras sessões encerradas.');
        await loadAccount();
      }
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <Loader2
          size={36}
          className="animate-spin"
          style={{ margin: '0 auto 14px', color: 'var(--cyan-primary)' }}
        />
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Carregando informações da conta e segurança...
        </p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div
        className="card-glass"
        style={{
          padding: '28px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
        }}
      >
        <p style={{ margin: 0 }}>{errorMsg || 'Conta indisponível.'}</p>
      </div>
    );
  }

  const { account, activeOrganization, activeMembership, memberships, sessions, emailTransport } =
    data;

  const hasMinLen = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabeçalho da Área de Configurações + Botão de Encerrar Sessão */}
      <div
        className="card-glass"
        style={{
          padding: '24px 28px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0, 210, 211, 0.2), rgba(14, 165, 233, 0.2))',
              border: '2px solid var(--cyan-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--cyan-primary)',
            }}
          >
            {account.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  margin: 0,
                }}
              >
                {account.fullName}
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(0, 210, 211, 0.14)',
                  color: 'var(--cyan-primary)',
                  border: '1px solid rgba(0, 210, 211, 0.3)',
                }}
              >
                {account.shortId}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                CONTA ATIVA
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {account.email} •{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {activeMembership ? ROLE_LABELS[activeMembership.role] || activeMembership.role : ''}
              </strong>{' '}
              em{' '}
              <strong style={{ color: 'var(--cyan-primary)' }}>
                {activeOrganization?.tradeName || 'FyAlign'}
              </strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
          }}
        >
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          Encerrar Sessão
        </button>
      </div>

      {/* Grid Principal: Dados da Conta + Organização & Vínculos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Card 1: Dados Pessoais & Identidade da Conta */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <User size={20} color="var(--cyan-primary)" />
            <div>
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Informações da Conta
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Seus dados cadastrais e identificadores de acesso no FyAlign.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {profileError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.83rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontSize: '0.83rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{profileSuccess}</span>
              </div>
            )}

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                E-mail Corporativo / Login (Identificador Único)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  disabled
                  value={account.email}
                  className="form-input"
                  style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Telefone / WhatsApp Profissional
              </label>
              <input
                type="text"
                placeholder="(11) 99999-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--btn-ghost-bg)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Conta criada em</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {new Date(account.createdAt).toLocaleDateString('pt-BR')}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Último acesso</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {account.lastLoginAt
                    ? new Date(account.lastLoginAt).toLocaleString('pt-BR')
                    : 'Sessão atual'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={profileSaving}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.86rem' }}
              >
                {profileSaving ? 'Salvando...' : 'Salvar Dados da Conta'}
              </button>
            </div>
          </form>
        </div>

        {/* Card 2: Organização Ativa, Vínculos & Credencial CRO */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Building2 size={20} color="var(--cyan-primary)" />
            <div>
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Organização, Vínculos & Habilitação
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Contexto multi-tenant ativo e prerrogativas granulares concedidas.
              </p>
            </div>
          </div>

          {activeOrganization && activeMembership && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--btn-ghost-bg)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.96rem', color: 'var(--text-main)' }}>
                    {activeOrganization.tradeName}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      background: 'rgba(0, 210, 211, 0.14)',
                      color: 'var(--cyan-primary)',
                    }}
                  >
                    {activeOrganization.type === 'FYALIGN' ? 'LABORATÓRIO MATRIZ' : 'CLÍNICA PARCEIRA'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Razão Social: {activeOrganization.legalName} • CNPJ: {activeOrganization.taxId}
                </p>
                {(activeOrganization.city || activeOrganization.state) && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '2px 0 0' }}>
                    Localidade: {[activeOrganization.city, activeOrganization.state].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>

              {/* Status CRO se DOCTOR */}
              {activeMembership.role === 'DOCTOR' && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      activeMembership.croStatus === 'VERIFIED'
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${
                      activeMembership.croStatus === 'VERIFIED'
                        ? 'rgba(16, 185, 129, 0.3)'
                        : 'rgba(245, 158, 11, 0.3)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Stethoscope
                    size={18}
                    color={activeMembership.croStatus === 'VERIFIED' ? '#10b981' : '#f59e0b'}
                  />
                  <div style={{ fontSize: '0.82rem' }}>
                    <strong style={{ color: 'var(--text-main)', display: 'block' }}>
                      Registro Profissional:{' '}
                      {activeMembership.croNumber
                        ? `CRO-${activeMembership.croUf || 'BR'} ${activeMembership.croNumber}`
                        : 'CRO Pendente'}
                    </strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Status regulatório:{' '}
                      <strong>
                        {activeMembership.croStatus === 'VERIFIED'
                          ? 'Verificado e habilitado para aprovações clínicas'
                          : 'Em análise pela governança regulatória'}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Lista de Vínculos */}
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    marginBottom: '8px',
                  }}
                >
                  Vínculos da Conta ({memberships.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {memberships.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: m.isCurrent
                          ? '1px solid var(--cyan-primary)'
                          : '1px solid var(--border-subtle)',
                        background: m.isCurrent ? 'rgba(0, 210, 211, 0.08)' : 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>
                          {ROLE_LABELS[m.role] || m.role}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>
                          {m.organizationName} • {m.permissionsCount} permissões efetivas
                        </span>
                      </div>
                      {m.isCurrent && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '8px',
                            background: 'var(--cyan-primary)',
                            color: '#04101f',
                          }}
                        >
                          EM USO
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnóstico de Transporte de E-mail (visível para gestores de equipe) */}
              {emailTransport && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: emailTransport.configured
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${
                      emailTransport.configured
                        ? 'rgba(16, 185, 129, 0.25)'
                        : 'rgba(245, 158, 11, 0.3)'
                    }`,
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <Mail
                      size={14}
                      color={emailTransport.configured ? '#10b981' : '#f59e0b'}
                    />
                    <span style={{ color: 'var(--text-main)' }}>
                      Disparo de Convites por E-mail:{' '}
                      {emailTransport.configured
                        ? `Ativo (${emailTransport.provider})`
                        : 'Aguardando Credenciais SMTP / Resend no .env'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                    Remetente: <code>{emailTransport.fromAddress}</code>
                    {emailTransport.hint ? ` — ${emailTransport.hint}` : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid Inferior: Redefinição de Senha + Sessões Ativas e Encerramento */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Card 3: Segurança & Alteração de Senha */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <KeyRound size={20} color="var(--cyan-primary)" />
              <div>
                <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Segurança & Redefinição de Senha
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {account.passwordChangedAt
                    ? `Última alteração em ${new Date(account.passwordChangedAt).toLocaleString('pt-BR')}`
                    : 'Altere sua senha periodicamente para manter sua conta protegida.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPasswords ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {passwordError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.83rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontSize: '0.83rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Senha Atual
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Informe sua senha atual"
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Nova Senha Pessoal
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Confirmar Nova Senha
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ color: hasMinLen ? '#10b981' : 'var(--text-dim)' }}>
                {hasMinLen ? '✓' : '○'} Mínimo de 8 caracteres
              </span>
              <span style={{ color: hasUpper ? '#10b981' : 'var(--text-dim)' }}>
                {hasUpper ? '✓' : '○'} Letra maiúscula (A–Z)
              </span>
              <span style={{ color: hasLower ? '#10b981' : 'var(--text-dim)' }}>
                {hasLower ? '✓' : '○'} Letra minúscula (a–z)
              </span>
              <span style={{ color: hasDigit ? '#10b981' : 'var(--text-dim)' }}>
                {hasDigit ? '✓' : '○'} Pelo menos um número (0–9)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={passwordSaving}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.86rem' }}
              >
                {passwordSaving ? 'Atualizando Senha...' : 'Redefinir Senha'}
              </button>
            </div>
          </form>
        </div>

        {/* Card 4: Sessões Ativas & Encerramento de Sessão */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Monitor size={20} color="var(--cyan-primary)" />
              <div>
                <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Sessões Ativas & Encerramento
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Dispositivos autenticados na sua conta e controle de saída.
                </p>
              </div>
            </div>

            {sessions.length > 1 && (
              <button
                type="button"
                onClick={handleRevokeOtherSessions}
                disabled={revokingSessions}
                style={{
                  background: 'var(--btn-ghost-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Trash2 size={13} />
                Encerrar Outras ({sessions.length - 1})
              </button>
            )}
          </div>

          {sessionMessage && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontSize: '0.82rem',
                marginBottom: '12px',
              }}
            >
              {sessionMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: s.isCurrent
                    ? '1px solid rgba(0, 210, 211, 0.35)'
                    : '1px solid var(--border-subtle)',
                  background: s.isCurrent ? 'rgba(0, 210, 211, 0.06)' : 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>
                      IP: {s.ipAddress}
                    </strong>
                    {s.isCurrent && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '8px',
                          background: 'rgba(16, 185, 129, 0.18)',
                          color: '#10b981',
                        }}
                      >
                        SESSÃO ATUAL
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      margin: '3px 0 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={s.userAgent}
                  >
                    {s.userAgent}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    Iniciada em {new Date(s.createdAt).toLocaleString('pt-BR')} • Expira em{' '}
                    {new Date(s.expiresAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Deseja desconectar sua conta deste navegador agora?
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: loggingOut ? 'not-allowed' : 'pointer',
              }}
            >
              <LogOut size={16} />
              Encerrar Sessão Atual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

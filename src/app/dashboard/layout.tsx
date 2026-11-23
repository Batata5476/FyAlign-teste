'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderPlus,
  Users,
  Box,
  Building2,
  LogOut,
  Sparkles,
  ShieldCheck,
  Bell,
  Layers,
  FileText,
  UserCheck,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Lock,
  Settings,
  KeyRound,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OrganizationSwitcher } from '@/components/auth/OrganizationSwitcher';
import { Permission, userHasPermission } from '@/lib/auth/rbac';
import {
  AuthProvider,
  FrontendAuthUser,
  canAccessDashboardRoute,
  getRequiredRoutePermission,
} from '@/lib/auth/AuthContext';

interface NavItem {
  label: string;
  href: string;
  icon: any;
  permission?: Permission | null;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<FrontendAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();
      setUser(data.user);
    } catch {
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleSwitchSuccess = async () => {
    setLoading(true);
    await loadUser();
    router.refresh();
  };

  const [firstAccessCurrentPassword, setFirstAccessCurrentPassword] = useState('');
  const [firstAccessNewPassword, setFirstAccessNewPassword] = useState('');
  const [firstAccessConfirmPassword, setFirstAccessConfirmPassword] = useState('');
  const [firstAccessLoading, setFirstAccessLoading] = useState(false);
  const [firstAccessError, setFirstAccessError] = useState<string | null>(null);

  const handleFirstAccessPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstAccessLoading(true);
    setFirstAccessError(null);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: firstAccessCurrentPassword,
          newPassword: firstAccessNewPassword,
          confirmPassword: firstAccessConfirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao redefinir senha temporária.');
      }
      setFirstAccessCurrentPassword('');
      setFirstAccessNewPassword('');
      setFirstAccessConfirmPassword('');
      await loadUser();
    } catch (err: any) {
      setFirstAccessError(err.message || 'Erro ao salvar nova senha.');
    } finally {
      setFirstAccessLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--cyan-primary)',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          ></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Carregando Portal FyAlign e validando permissões...
          </p>
        </div>
      </div>
    );
  }

  // 1. Definição das seções e rotas organizadas semanticamente
  // NOTA: O módulo 'Financeiro' (Ordens & Faturamento) está oculto visualmente no momento,
  // mantendo toda a estrutura de rotas (/dashboard/orders), permissões e APIs intactas para ativação futura.
  const ENABLE_FINANCIAL_MODULE = false;

  const isInternalFyAlign = user?.organization?.type === 'FYALIGN';

  const navSections: NavSection[] = [
    {
      title: 'Clínico & Pacientes',
      items: [
        { label: 'Painel de Tratamentos', href: '/dashboard', icon: LayoutDashboard, permission: 'CASE_READ' },
        { label: 'Novo Pedido Inicial', href: '/dashboard/cases/new', icon: FolderPlus, permission: 'CASE_CREATE' },
        { label: 'Pacientes (Ficha 360°)', href: '/dashboard/patients', icon: Users, permission: 'PATIENT_READ' },
        { label: 'Setups Virtuais 3D', href: '/dashboard/setups', icon: Box, permission: 'SETUP_READ' },
        {
          label: isInternalFyAlign ? 'Equipe & Vínculos' : 'Equipe da Clínica',
          href: '/dashboard/team',
          icon: UserCheck,
          permission: 'TEAM_READ',
        },
      ],
    },
    {
      title: 'Comercial & Contratos',
      items: [
        { label: 'Contratos', href: '/dashboard/contracts', icon: FileText, permission: 'CONTRACT_READ' },
      ],
    },
    {
      title: 'Laboratório & Qualidade',
      items: [
        { label: 'Esteira Fabril (Lab)', href: '/dashboard/lab/kanban', icon: Layers, permission: 'PRODUCTION_READ' },
      ],
    },
    ...(ENABLE_FINANCIAL_MODULE
      ? [
          {
            title: 'Financeiro',
            items: [
              { label: 'Ordens & Faturamento', href: '/dashboard/orders', icon: FileText, permission: 'ORDER_READ' as Permission },
            ],
          },
        ]
      : []),
    {
      title: 'Governança & Plataforma',
      items: [
        { label: 'Usuários & Fila CRO', href: '/dashboard/admin/users', icon: ShieldCheck, permission: 'SYSTEM_ADMIN' },
        { label: 'Trilha de Auditoria', href: '/dashboard/audit', icon: FileCheck, permission: 'AUDIT_READ' },
      ],
    },
    {
      title: 'Conta & Preferências',
      items: [
        { label: 'Configurações da Conta', href: '/dashboard/settings', icon: Settings, permission: null },
      ],
    },
  ];

  // 2. Filtragem dinâmica exclusivamente via user.permissions (fonte oficial de /api/auth/me)
  const allowedSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || userHasPermission(user, item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0);

  // 3. Proteção uniforme de páginas em navegação direta por URL
  const requiredRoutePermission = getRequiredRoutePermission(pathname || '');
  const isRouteAllowed = canAccessDashboardRoute(user, pathname || '');

  return (
    <div className="app-container">
      {/* Sidebar Lateral */}
      <aside className="app-sidebar">
        {/* Brand Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--cyan-primary), var(--blue-vibrant))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px var(--cyan-glow)',
            }}
          >
            <Sparkles size={20} color="#05101f" />
          </div>
          <div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Fy<span style={{ color: 'var(--cyan-primary)' }}>Align</span>
            </h2>
            <p
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: 0,
              }}
            >
              {user?.organization?.type === 'FYALIGN' ? 'Laboratório Central' : 'Doctor Portal B2B'}
            </p>
          </div>
        </div>

        {/* Card do Tenant Ativo */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--btn-ghost-bg)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Building2 size={15} color="var(--cyan-primary)" />
            <span
              style={{
                fontSize: '0.73rem',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              Organização Ativa
            </span>
          </div>
          <p
            title={user?.organization?.tradeName}
            style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
            }}
          >
            {user?.organization?.tradeName || 'FyAlign Laboratório'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--cyan-primary)',
              }}
            >
              Papel: {user?.role}
            </span>
            {user?.role === 'DOCTOR' && user?.croStatus && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  background:
                    user.croStatus === 'VERIFIED'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : user.croStatus === 'PENDING'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    user.croStatus === 'VERIFIED'
                      ? '#10b981'
                      : user.croStatus === 'PENDING'
                      ? '#f59e0b'
                      : '#ef4444',
                  border: `1px solid ${
                    user.croStatus === 'VERIFIED'
                      ? '#10b981'
                      : user.croStatus === 'PENDING'
                      ? '#f59e0b'
                      : '#ef4444'
                  }`,
                }}
              >
                CRO {user.croStatus}
              </span>
            )}
          </div>
        </div>

        {/* Menu de Navegação Dinâmico */}
        <nav
          className="sidebar-nav"
          style={{
            flex: 1,
            minHeight: 0,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
          }}
        >
          {allowedSections.map((section, sIndex) => (
            <div key={sIndex} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text-dim)',
                  padding: '4px 12px',
                  marginBottom: '2px',
                }}
              >
                {section.title}
              </span>

              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: active ? 'rgba(0, 210, 211, 0.12)' : 'transparent',
                      color: active ? 'var(--cyan-primary)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.86rem',
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      borderLeft: active ? '3px solid var(--cyan-primary)' : '3px solid transparent',
                    }}
                  >
                    <Icon size={18} color={active ? 'var(--cyan-primary)' : 'var(--text-dim)'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Card & Logout no rodapé da Sidebar */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--btn-ghost-bg)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div
              onClick={() => router.push('/dashboard/settings')}
              title="Abrir Configurações da Conta"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: 'rgba(0, 210, 211, 0.15)',
                  border: '1px solid var(--cyan-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: 'var(--cyan-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {user?.fullName?.charAt(0) || user?.role?.charAt(0) || 'U'}
              </div>
              <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <p
                  title={user?.fullName || user?.role || ''}
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    margin: 0,
                  }}
                >
                  {user?.fullName || user?.role || 'Usuário'}
                </p>
                <p
                  title={user?.email || ''}
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    margin: 0,
                  }}
                >
                  {user?.email || 'Acesso Ativo'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Encerrar Sessão"
              className="sidebar-logout-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="app-main">
        {/* Top Header */}
        <header
          className="app-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Lado Esquerdo: Switcher de Organização e Vínculo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {user && (
              <OrganizationSwitcher
                user={user}
                onSwitchSuccess={handleSwitchSuccess}
              />
            )}

            {/* Aviso de CRO para DOCTOR */}
            {user?.role === 'DOCTOR' && (
              <div>
                {user.croStatus === 'VERIFIED' ? (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <CheckCircle size={14} />
                    CRO Habilitado: {user.professionalIdCro || 'Verificado'}
                  </span>
                ) : user.croStatus === 'PENDING' ? (
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <AlertTriangle size={14} />
                    CRO em Análise (Aprovações restritas)
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ShieldAlert size={14} />
                    CRO Rejeitado (Contate o suporte)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lado Direito: Sessão Auditada + Notificações + ThemeToggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                background: 'var(--badge-approved-bg)',
                color: 'var(--badge-approved-text)',
                border: '1px solid var(--badge-approved-border)',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.73rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <ShieldCheck size={13} />
              Sessão Auditada
            </span>

            <ThemeToggle />

            <button
              title="Notificações"
              style={{
                background: 'var(--btn-ghost-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Bell size={16} />
            </button>
          </div>
        </header>

        {/* Content Area com Contexto Oficial de Permissões, Orientação de 1º Acesso e Proteção de Rota */}
        <AuthProvider user={user} refreshUser={loadUser}>
          <main className="app-content">
            {user?.mustChangePassword ? (
              <div
                className="glass-panel"
                style={{
                  maxWidth: '560px',
                  margin: '36px auto',
                  padding: '32px',
                  border: '1px solid rgba(0, 210, 211, 0.35)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'rgba(0, 210, 211, 0.14)',
                      border: '1px solid var(--cyan-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <KeyRound size={24} color="var(--cyan-primary)" />
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--cyan-primary)',
                      }}
                    >
                      Primeiro Acesso • Convite de Equipe
                    </span>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0' }}>
                      Redefina sua Senha Temporária
                    </h2>
                  </div>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '20px' }}>
                  Olá, <strong style={{ color: 'var(--text-main)' }}>{user.fullName}</strong>! Você acessou a organização{' '}
                  <strong style={{ color: 'var(--cyan-primary)' }}>{user.organization?.tradeName}</strong> com uma senha
                  temporária enviada por e-mail. Por segurança, defina agora sua nova senha pessoal para liberar o painel.
                </p>

                {firstAccessError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#f87171',
                      fontSize: '0.84rem',
                      marginBottom: '16px',
                    }}
                  >
                    {firstAccessError}
                  </div>
                )}

                <form
                  onSubmit={handleFirstAccessPasswordSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                >
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
                      Senha Temporária (Recebida por E-mail)
                    </label>
                    <input
                      type="password"
                      required
                      value={firstAccessCurrentPassword}
                      onChange={(e) => setFirstAccessCurrentPassword(e.target.value)}
                      placeholder="Digite a senha temporária do convite"
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
                      Nova Senha Definitiva (mín. 8 caracteres, maiúscula, minúscula e número)
                    </label>
                    <input
                      type="password"
                      required
                      value={firstAccessNewPassword}
                      onChange={(e) => setFirstAccessNewPassword(e.target.value)}
                      placeholder="Crie sua senha pessoal"
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
                      type="password"
                      required
                      value={firstAccessConfirmPassword}
                      onChange={(e) => setFirstAccessConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginTop: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn-secondary"
                      style={{ padding: '10px 16px', fontSize: '0.84rem' }}
                    >
                      Encerrar Sessão
                    </button>
                    <button
                      type="submit"
                      disabled={firstAccessLoading}
                      className="btn-primary"
                      style={{ padding: '11px 22px', fontSize: '0.88rem' }}
                    >
                      {firstAccessLoading ? 'Salvando Nova Senha...' : 'Salvar Senha e Liberar Acesso'}
                    </button>
                  </div>
                </form>
              </div>
            ) : isRouteAllowed ? (
              children
            ) : (
              <div
                className="glass-panel"
                style={{
                  maxWidth: '580px',
                  margin: '56px auto',
                  padding: '32px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.06)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <Lock size={24} color="#f87171" />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Acesso Restrito por Permissão
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
                  O seu vínculo atual na organização{' '}
                  <strong style={{ color: 'var(--text-main)' }}>
                    {user?.organization?.tradeName}
                  </strong>{' '}
                  não possui a permissão{' '}
                  <code style={{ color: 'var(--cyan-primary)', fontWeight: 700 }}>
                    {requiredRoutePermission}
                  </code>{' '}
                  necessária para acessar esta página.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="btn-primary"
                  style={{ padding: '10px 20px' }}
                >
                  Voltar ao Painel Principal
                </button>
              </div>
            )}
          </main>
        </AuthProvider>
      </div>
    </div>
  );
}

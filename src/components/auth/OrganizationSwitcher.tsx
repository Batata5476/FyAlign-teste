'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Layers,
  Shield,
  Sparkles,
  Stethoscope,
  UserCheck,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export interface MembershipItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  role: string;
  status: string;
  croStatus?: string;
}

interface OrganizationSwitcherProps {
  user: {
    fullName: string;
    email: string;
    role: string;
    croStatus?: string;
    activeMembershipId: string;
    organization: {
      id: string;
      tradeName: string;
      type: string;
    };
    memberships?: MembershipItem[];
  };
  onSwitchSuccess?: () => void;
}

const ROLE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  SUPER_ADMIN: { label: 'Administrador da Plataforma', icon: Sparkles, color: 'var(--cyan-primary)' },
  PLANNER_3D: { label: 'Planejador CAD 3D', icon: Layers, color: 'var(--blue-vibrant)' },
  PRODUCTION_QC: { label: 'Controle de Qualidade (QC)', icon: Shield, color: '#f59e0b' },
  FINANCE: { label: 'Financeiro & Faturamento', icon: Building2, color: '#10b981' },
  SUPPORT: { label: 'Suporte Técnico', icon: UserCheck, color: 'var(--text-secondary)' },
  CLINIC_ADMIN: { label: 'Administrador da Clínica', icon: Building2, color: '#a855f7' },
  DOCTOR: { label: 'Cirurgião-Dentista', icon: Stethoscope, color: 'var(--cyan-primary)' },
  CLINIC_ASSISTANT: { label: 'Assistente Clínico', icon: UserCheck, color: 'var(--blue-vibrant)' },
};

export function OrganizationSwitcher({ user, onSwitchSuccess }: OrganizationSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const memberships = user.memberships || [];
  const hasMultiple = memberships.length > 1;

  const currentRoleMeta = ROLE_LABELS[user.role] || {
    label: user.role,
    icon: Building2,
    color: 'var(--text-main)',
  };
  const CurrentIcon = currentRoleMeta.icon;

  const handleSwitch = async (targetMembershipId: string) => {
    if (targetMembershipId === user.activeMembershipId || switchingId) {
      return;
    }

    setSwitchingId(targetMembershipId);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/switch-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: targetMembershipId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Falha ao alternar organização.');
        setSwitchingId(null);
        return;
      }

      setIsOpen(false);
      setSwitchingId(null);

      if (onSwitchSuccess) {
        onSwitchSuccess();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de rede ao alternar contexto.');
      setSwitchingId(null);
    }
  };

  return (
    <>
      {/* Botão de Trigger no Header/Sidebar */}
      <button
        onClick={() => setIsOpen(true)}
        className="org-switcher-trigger"
        title={hasMultiple ? 'Clique para alternar organização ou perfil' : user.organization.tradeName}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          cursor: hasMultiple ? 'pointer' : 'default',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: user.organization.type === 'FYALIGN'
              ? 'rgba(0, 210, 211, 0.15)'
              : 'rgba(14, 165, 233, 0.15)',
            border: `1px solid ${currentRoleMeta.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentRoleMeta.color,
            flexShrink: 0,
          }}
        >
          <CurrentIcon size={16} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.organization.tradeName}
            </span>
            {user.organization.type === 'FYALIGN' && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(0, 210, 211, 0.2)',
                  color: 'var(--cyan-primary)',
                }}
              >
                Lab
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentRoleMeta.label}
          </span>
        </div>

        {hasMultiple && (
          <div
            style={{
              marginLeft: '4px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{memberships.length}</span>
            <ChevronDown size={14} />
          </div>
        )}
      </button>

      {/* Modal / Dialog de Alternância de Contexto */}
      {isOpen && (
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
          onClick={() => !switchingId && setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              boxShadow: 'var(--shadow-elevated)',
              overflow: 'hidden',
              animation: 'modalFadeIn 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-card)',
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
                  <Building2 size={20} color="var(--cyan-primary)" />
                  Alternar Organização ou Perfil
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Selecione a clínica ou papel de atuação para trocar o contexto ativo da sessão.
                </p>
              </div>

              <button
                disabled={!!switchingId}
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: switchingId ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div
                style={{
                  padding: '12px 24px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#f87171',
                  fontSize: '0.85rem',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Body / Memberships List */}
            <div
              style={{
                padding: '20px 24px',
                maxHeight: '420px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {memberships.map((m) => {
                const isActive = m.id === user.activeMembershipId;
                const isPendingSwitch = switchingId === m.id;
                const roleMeta = ROLE_LABELS[m.role] || {
                  label: m.role,
                  icon: Building2,
                  color: 'var(--text-main)',
                };
                const RoleIcon = roleMeta.icon;

                return (
                  <div
                    key={m.id}
                    onClick={() => !isActive && !switchingId && handleSwitch(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive
                        ? 'rgba(0, 210, 211, 0.08)'
                        : 'var(--bg-card)',
                      border: isActive
                        ? '2px solid var(--cyan-primary)'
                        : '1px solid var(--border-subtle)',
                      cursor: isActive || switchingId ? 'default' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: m.organizationType === 'FYALIGN'
                            ? 'rgba(0, 210, 211, 0.15)'
                            : 'rgba(14, 165, 233, 0.15)',
                          border: `1px solid ${roleMeta.color}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: roleMeta.color,
                          flexShrink: 0,
                        }}
                      >
                        <RoleIcon size={20} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4
                            style={{
                              fontSize: '0.96rem',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              margin: 0,
                            }}
                          >
                            {m.organizationName}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: m.organizationType === 'FYALIGN'
                                ? 'rgba(0, 210, 211, 0.18)'
                                : 'rgba(14, 165, 233, 0.18)',
                              color: m.organizationType === 'FYALIGN'
                                ? 'var(--cyan-primary)'
                                : 'var(--blue-vibrant)',
                            }}
                          >
                            {m.organizationType === 'FYALIGN' ? 'Matriz' : 'Clínica'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.82rem', color: roleMeta.color, fontWeight: 600 }}>
                            {roleMeta.label}
                          </span>

                          {/* Badge de CRO para DOCTOR */}
                          {m.role === 'DOCTOR' && m.croStatus && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: m.croStatus === 'VERIFIED'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : m.croStatus === 'PENDING'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                                color: m.croStatus === 'VERIFIED'
                                  ? '#10b981'
                                  : m.croStatus === 'PENDING'
                                  ? '#f59e0b'
                                  : '#ef4444',
                                border: `1px solid ${
                                  m.croStatus === 'VERIFIED'
                                    ? '#10b981'
                                    : m.croStatus === 'PENDING'
                                    ? '#f59e0b'
                                    : '#ef4444'
                                }`,
                                fontWeight: 600,
                              }}
                            >
                              CRO: {m.croStatus === 'VERIFIED' ? 'Ativo' : m.croStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status / Ação */}
                    <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                      {isActive ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--cyan-primary)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(0, 210, 211, 0.12)',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          Ativo Agora
                        </div>
                      ) : isPendingSwitch ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--cyan-primary)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <Loader2 size={16} className="animate-spin" />
                          Alternando...
                        </div>
                      ) : (
                        <button
                          disabled={!!switchingId}
                          onClick={() => handleSwitch(m.id)}
                          style={{
                            background: 'var(--btn-ghost-bg)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Acessar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Sua autorização e escopo de dados são determinados pelo vínculo ativo.
              </span>

              <button
                disabled={!!switchingId}
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

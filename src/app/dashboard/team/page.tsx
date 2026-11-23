'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Stethoscope,
  Building2,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Ban,
  RotateCcw,
  Clock,
  X,
  Loader2,
  ShieldAlert,
  Shield,
  Key,
  Sliders,
} from 'lucide-react';
import { PermissionsMatrixSelector } from '@/components/team/PermissionsMatrixSelector';
import { PermissionModule } from '@/lib/auth/rbac';
import { useAuth } from '@/lib/auth/AuthContext';

interface Member {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  croNumber?: string;
  croUf?: string;
  croStatus?: string;
  mustChangePassword?: boolean;
  permissions: string[];
  createdAt: string;
  lastLoginAt?: string;
  isSelf: boolean;
}

interface Invitation {
  id: string;
  fullName?: string | null;
  email: string;
  role: string;
  status: string;
  emailDeliveryStatus?: string;
  emailSentAt?: string | null;
  emailError?: string | null;
  croNumber?: string;
  croUf?: string;
  permissions: string[];
  expiresAt: string;
  createdAt: string;
  invitedByName: string;
}

const ROLE_LABELS: Record<string, string> = {
  CLINIC_ADMIN: 'Administrador da Clínica',
  DOCTOR: 'Cirurgião-Dentista',
  CLINIC_ASSISTANT: 'Assistente Clínico',
  PLANNER_3D: 'Planejador CAD 3D',
  PRODUCTION_QC: 'Controle de Qualidade',
  FINANCE: 'Financeiro',
  SUPPORT: 'Suporte Técnico',
  SUPER_ADMIN: 'Administrador Geral',
};

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function TeamManagementPage() {
  const { can, refreshUser } = useAuth();
  const canInviteTeam = can('TEAM_INVITE');
  const canManageTeam = can('TEAM_MANAGE');

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [roleCeilings, setRoleCeilings] = useState<Record<string, string[]>>({});
  const [roleDefaults, setRoleDefaults] = useState<Record<string, string[]>>({});
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);

  const canonicalModuleKeys = useMemo(
    () => new Set(permissionModules.flatMap((m) => m.permissions.map((p) => p.key as string))),
    [permissionModules]
  );

  const countCanonicalPermissions = (perms?: string[]) => {
    if (!perms || perms.length === 0) return 0;
    if (canonicalModuleKeys.size === 0) return perms.length;
    return perms.filter((p) => canonicalModuleKeys.has(p)).length;
  };
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de Convite
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DOCTOR');
  const [inviteCroNumber, setInviteCroNumber] = useState('');
  const [inviteCroUf, setInviteCroUf] = useState('SP');
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Modal de Edição de Permissões de Membro Existente
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<Member | null>(null);
  const [memberEditingPermissions, setMemberEditingPermissions] = useState<string[]>([]);
  const [savingPermissionsLoading, setSavingPermissionsLoading] = useState(false);
  const [permissionsModalError, setPermissionsModalError] = useState<string | null>(null);
  const [permissionsModalSuccess, setPermissionsModalSuccess] = useState<string | null>(null);

  // Ação de Suspensão / Reativação / Reenvio de Convite
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [inviteActionFeedback, setInviteActionFeedback] = useState<string | null>(null);

  const handleResendInvitation = async (inv: Invitation) => {
    setActionLoadingId(inv.id);
    setInviteActionFeedback(null);
    try {
      const res = await fetch(`/api/team/invitations/${inv.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Falha ao reenviar convite.');
        return;
      }
      setInviteActionFeedback(data.message || `Convite reenviado para ${inv.email}.`);
      await fetchTeamData();
    } catch (err: any) {
      alert(err.message || 'Erro ao reenviar convite.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevokeInvitation = async (inv: Invitation) => {
    if (!window.confirm(`Deseja revogar o convite pendente para ${inv.email}?`)) return;
    setActionLoadingId(inv.id);
    setInviteActionFeedback(null);
    try {
      const res = await fetch(`/api/team/invitations/${inv.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Falha ao revogar convite.');
        return;
      }
      setInviteActionFeedback(data.message || 'Convite revogado com sucesso.');
      await fetchTeamData();
    } catch (err: any) {
      alert(err.message || 'Erro ao revogar convite.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const fetchTeamData = async () => {
    try {
      setErrorMsg(null);
      const res = await fetch('/api/team');
      if (!res.ok) {
        if (res.status === 403) {
          setErrorMsg('Acesso restrito: Você não possui prerrogativa de gerenciamento de equipe.');
          return;
        }
        throw new Error('Falha ao carregar dados da equipe.');
      }
      const data = await res.json();
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
      setAllowedRoles(data.allowedInviteRoles || ['DOCTOR', 'CLINIC_ASSISTANT']);
      setRoleCeilings(data.roleCeilings || {});
      setRoleDefaults(data.roleDefaults || {});
      setPermissionModules(data.permissionModules || []);

      if (data.allowedInviteRoles && data.allowedInviteRoles.length > 0) {
        const firstRole = data.allowedInviteRoles[0];
        setInviteRole(firstRole);
        if (data.roleDefaults?.[firstRole]) {
          setInvitePermissions(data.roleDefaults[firstRole]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão ao carregar equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const handleRoleChange = (newRole: string) => {
    setInviteRole(newRole);
    if (roleDefaults[newRole]) {
      setInvitePermissions([...roleDefaults[newRole]]);
    }
  };

  const handleOpenPermissionsModal = (member: Member) => {
    setSelectedMemberForPermissions(member);
    setMemberEditingPermissions([...(member.permissions || [])]);
    setPermissionsModalError(null);
    setPermissionsModalSuccess(null);
    setIsPermissionsModalOpen(true);
  };

  const handleSaveMemberPermissions = async () => {
    if (!selectedMemberForPermissions) return;
    setSavingPermissionsLoading(true);
    setPermissionsModalError(null);
    setPermissionsModalSuccess(null);

    try {
      const res = await fetch(`/api/team/members/${selectedMemberForPermissions.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: memberEditingPermissions }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao salvar permissões do membro.');
      }

      setPermissionsModalSuccess(data.message || 'Permissões atualizadas com sucesso.');
      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMemberForPermissions.id
            ? { ...m, permissions: data.permissions }
            : m
        )
      );

      if (selectedMemberForPermissions.isSelf) {
        await refreshUser();
      }

      setTimeout(() => {
        setIsPermissionsModalOpen(false);
        setPermissionsModalSuccess(null);
      }, 1200);
    } catch (err: any) {
      setPermissionsModalError(err.message || 'Erro de rede ao salvar permissões.');
    } finally {
      setSavingPermissionsLoading(false);
    }
  };

  const handleToggleMemberStatus = async (member: Member) => {
    const nextStatus = member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmText =
      nextStatus === 'SUSPENDED'
        ? `Tem certeza que deseja suspender o acesso de ${member.fullName}? As sessões ativas serão revogadas imediatamente.`
        : `Deseja reativar o acesso de ${member.fullName}?`;

    if (!window.confirm(confirmText)) return;

    setActionLoadingId(member.id);
    try {
      const res = await fetch(`/api/team/members/${member.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao alterar status do membro.');
        return;
      }

      await fetchTeamData();
    } catch (err: any) {
      alert(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: inviteFullName,
          email: inviteEmail,
          role: inviteRole,
          croNumber: inviteRole === 'DOCTOR' ? inviteCroNumber : undefined,
          croUf: inviteRole === 'DOCTOR' ? inviteCroUf : undefined,
          permissions: invitePermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || 'Falha ao emitir convite.');
        return;
      }

      setInviteSuccess(data.message || 'Convite registrado com sucesso.');
      setInviteFullName('');
      setInviteEmail('');
      setInviteCroNumber('');
      await fetchTeamData();

      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccess(null);
      }, 1500);
    } catch (err: any) {
      setInviteError(err.message || 'Erro de rede.');
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--cyan-primary)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Carregando gestão de equipe...</p>
      </div>
    );
  }

  if (errorMsg) {
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
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Acesso Negado</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  const activeMembersCount = members.filter((m) => m.status === 'ACTIVE').length;
  const verifiedDoctorsCount = members.filter((m) => m.role === 'DOCTOR' && m.croStatus === 'VERIFIED').length;
  const pendingInvitesCount = invitations.filter((inv) => inv.status === 'PENDING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header da Página */}
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
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              margin: '0 0 6px',
            }}
          >
            Gestão da Equipe Clínica
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
            Administração de membros, habilitação profissional e convites da clínica ativa.
          </p>
        </div>

        {canInviteTeam && (
          <button
            onClick={() => {
              setInviteError(null);
              setInviteSuccess(null);
              setIsInviteModalOpen(true);
            }}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--cyan-primary), var(--blue-vibrant))',
              color: '#05101f',
              fontWeight: 700,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--cyan-glow)',
            }}
          >
            <UserPlus size={18} />
            Convidar Membro
          </button>
        )}
      </div>

      {/* Cards de Métricas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Membros Ativos
            </span>
            <Users size={20} color="var(--cyan-primary)" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: '10px 0 0' }}>
            {activeMembersCount}
          </p>
        </div>

        <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Dentistas Habilitados
            </span>
            <Stethoscope size={20} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', margin: '10px 0 0' }}>
            {verifiedDoctorsCount}
          </p>
        </div>

        <div className="card-glass" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Convites Pendentes
            </span>
            <Mail size={20} color="#f59e0b" />
          </div>
          <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', margin: '10px 0 0' }}>
            {pendingInvitesCount}
          </p>
        </div>
      </div>

      {/* Tabela de Membros da Equipe */}
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
              Membros Vinculados
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Profissionais com acesso autorizado aos casos desta clínica.
            </p>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            Total: {members.length} {members.length === 1 ? 'membro' : 'membros'}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--btn-ghost-bg)' }}>
                <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Profissional
                </th>
                <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Cargo / Função
                </th>
                <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Acessos & Permissões
                </th>
                <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Habilitação CRO
                </th>
                <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isDoctor = member.role === 'DOCTOR';
                const isSuspended = member.status === 'SUSPENDED';

                return (
                  <tr
                    key={member.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: isDoctor ? 'rgba(0, 210, 211, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                            color: isDoctor ? 'var(--cyan-primary)' : 'var(--blue-vibrant)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {member.fullName.charAt(0)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {member.fullName}
                            </span>
                            {member.isSelf && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(0, 210, 211, 0.15)',
                                  color: 'var(--cyan-primary)',
                                }}
                              >
                                Você
                              </span>
                            )}
                            {member.mustChangePassword && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                }}
                                title="Usuário recebeu senha temporária por e-mail e será orientado a redefinir no 1º acesso"
                              >
                                1º Acesso Pendente
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{member.email}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                    </td>

                    {/* Coluna Acessos & Permissões */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '10px',
                            background: 'rgba(0, 210, 211, 0.1)',
                            color: 'var(--cyan-primary)',
                            border: '1px solid rgba(0, 210, 211, 0.25)',
                          }}
                        >
                          {countCanonicalPermissions(member.permissions)} ativas
                        </span>
                        {canManageTeam && (
                          <button
                            type="button"
                            onClick={() => handleOpenPermissionsModal(member)}
                            style={{
                              background: 'var(--btn-ghost-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '4px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease',
                            }}
                            title="Configurar prerrogativas granulares deste membro"
                          >
                            <Sliders size={12} color="var(--cyan-primary)" />
                            Configurar
                          </button>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      {isDoctor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {member.croNumber ? `CRO-${member.croUf || 'BR'} ${member.croNumber}` : 'CRO Não Informado'}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color:
                                member.croStatus === 'VERIFIED'
                                  ? '#10b981'
                                  : member.croStatus === 'PENDING'
                                  ? '#f59e0b'
                                  : '#ef4444',
                            }}
                          >
                            ● {member.croStatus === 'VERIFIED'
                              ? 'Habilitado para Aprovação'
                              : member.croStatus === 'PENDING'
                              ? 'Em Análise de Habilitação'
                              : 'Documentação Rejeitada'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Não aplicável</span>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: isSuspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isSuspended ? '#ef4444' : '#10b981',
                          border: `1px solid ${isSuspended ? '#ef4444' : '#10b981'}`,
                        }}
                      >
                        {isSuspended ? 'SUSPENSO' : 'ATIVO'}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      {member.isSelf ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Conta ativa</span>
                      ) : !canManageTeam ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Somente leitura</span>
                      ) : (
                        <button
                          disabled={actionLoadingId === member.id}
                          onClick={() => handleToggleMemberStatus(member)}
                          style={{
                            background: isSuspended ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${isSuspended ? '#10b981' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: isSuspended ? '#10b981' : '#f87171',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {actionLoadingId === member.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : isSuspended ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <RotateCcw size={13} /> Reativar
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Ban size={13} /> Suspender
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Convites Pendentes */}
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
              Convites Emitidos
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Histórico de links de entrada com papéis previamente fixados pelo administrador.
            </p>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            {invitations.length} {invitations.length === 1 ? 'convite' : 'convites'}
          </span>
        </div>

        {invitations.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Mail size={32} style={{ margin: '0 auto 8px', color: 'var(--text-dim)' }} />
            <p style={{ margin: 0, fontSize: '0.88rem' }}>Nenhum convite emitido no momento.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--btn-ghost-bg)' }}>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Destinatário
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Cargo Pré-definido
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Permissões Concedidas
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Emitido por
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Validade
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Entrega do E-mail
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Status Convite
                  </th>
                  <th style={{ padding: '14px 20px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {inv.fullName && (
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {inv.fullName}
                          </span>
                        )}
                        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                          {inv.email}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {ROLE_LABELS[inv.role] || inv.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '10px',
                          background: 'rgba(0, 210, 211, 0.1)',
                          color: 'var(--cyan-primary)',
                          border: '1px solid rgba(0, 210, 211, 0.25)',
                        }}
                      >
                        {countCanonicalPermissions(inv.permissions)} concedidas
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{inv.invitedByName}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        title={inv.emailError || 'E-mail com senha temporária'}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background:
                            inv.emailDeliveryStatus === 'SENT'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : inv.emailDeliveryStatus === 'UNCONFIGURED'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            inv.emailDeliveryStatus === 'SENT'
                              ? '#10b981'
                              : inv.emailDeliveryStatus === 'UNCONFIGURED'
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        {inv.emailDeliveryStatus === 'SENT'
                          ? 'E-MAIL ENVIADO'
                          : inv.emailDeliveryStatus === 'UNCONFIGURED'
                          ? 'AGUARDANDO SMTP (.ENV)'
                          : 'FALHA NO ENVIO'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background:
                            inv.status === 'PENDING'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : inv.status === 'ACCEPTED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            inv.status === 'PENDING'
                              ? '#f59e0b'
                              : inv.status === 'ACCEPTED'
                              ? '#10b981'
                              : '#ef4444',
                        }}
                      >
                        {inv.status === 'PENDING'
                          ? 'AGUARDANDO 1º ACESSO'
                          : inv.status === 'ACCEPTED'
                          ? 'SENHA REDEFINIDA'
                          : inv.status === 'REVOKED'
                          ? 'REVOGADO'
                          : 'EXPIRADO'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      {inv.status === 'PENDING' && (canInviteTeam || canManageTeam) ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {canInviteTeam && (
                            <button
                              type="button"
                              disabled={actionLoadingId === inv.id}
                              onClick={() => handleResendInvitation(inv)}
                              style={{
                                background: 'rgba(0, 210, 211, 0.12)',
                                border: '1px solid rgba(0, 210, 211, 0.3)',
                                color: 'var(--cyan-primary)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '5px 10px',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                              }}
                              title="Gera uma nova senha temporária e reenvia o e-mail de convite"
                            >
                              Reenviar E-mail
                            </button>
                          )}
                          {canManageTeam && (
                            <button
                              type="button"
                              disabled={actionLoadingId === inv.id}
                              onClick={() => handleRevokeInvitation(inv)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                padding: '5px 10px',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                              }}
                            >
                              Revogar
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Convidar Novo Membro */}
      {isInviteModalOpen && (
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
          onClick={() => !inviteLoading && setIsInviteModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '780px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
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
                flexShrink: 0,
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
                  <UserPlus size={20} color="var(--cyan-primary)" />
                  Convidar Profissional para a Clínica
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  O usuário receberá convite com função base e permissões granulares configuradas.
                </p>
              </div>

              <button
                disabled={inviteLoading}
                onClick={() => setIsInviteModalOpen(false)}
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

            {/* Form com Scroll */}
            <form onSubmit={handleSendInvite} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {inviteError && (
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
                  <span>{inviteError}</span>
                </div>
              )}

              {inviteSuccess && (
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
                  <span>{inviteSuccess}</span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nome Completo do Profissional *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Mariana Albuquerque"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  E-mail Corporativo ou Profissional *
                </label>
                <input
                  type="email"
                  required
                  placeholder="mariana@odontoprime.com.br"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Função Base (Define o Teto de Acesso) *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                >
                  {allowedRoles.map((roleKey) => (
                    <option key={roleKey} value={roleKey}>
                      {ROLE_LABELS[roleKey] || roleKey}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  A função base estabelece a fronteira máxima de segurança. O administrador pode restringir prerrogativas, mas nunca exceder o teto do cargo.
                </span>
              </div>

              {inviteRole === 'DOCTOR' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Número de Registro CRO
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123456"
                      value={inviteCroNumber}
                      onChange={(e) => setInviteCroNumber(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      UF do CRO
                    </label>
                    <select
                      value={inviteCroUf}
                      onChange={(e) => setInviteCroUf(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem',
                        outline: 'none',
                      }}
                    >
                      {UF_LIST.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Matriz de Permissões Granulares no Convite */}
              <div style={{ marginTop: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Permissões Granulares Concedidas (dentro do Teto da Função)
                </label>
                <PermissionsMatrixSelector
                  role={inviteRole}
                  roleName={ROLE_LABELS[inviteRole] || inviteRole}
                  roleCeilings={roleCeilings}
                  roleDefaults={roleDefaults}
                  permissionModules={permissionModules}
                  selectedPermissions={invitePermissions}
                  onChange={setInvitePermissions}
                />
              </div>

              {/* Botões do Modal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  disabled={inviteLoading}
                  onClick={() => setIsInviteModalOpen(false)}
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
                  disabled={inviteLoading}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, var(--cyan-primary), var(--blue-vibrant))',
                    color: '#05101f',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: inviteLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  Emitir Convite Seguro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestão Granular de Permissões de Membro */}
      {isPermissionsModalOpen && selectedMemberForPermissions && (
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
          onClick={() => !savingPermissionsLoading && setIsPermissionsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '780px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
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
                flexShrink: 0,
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
                  <Sliders size={20} color="var(--cyan-primary)" />
                  Permissões de Acesso — {selectedMemberForPermissions.fullName}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Cargo: <strong style={{ color: 'var(--text-secondary)' }}>{ROLE_LABELS[selectedMemberForPermissions.role] || selectedMemberForPermissions.role}</strong> (define o teto máximo inegociável deste membro)
                </p>
              </div>

              <button
                disabled={savingPermissionsLoading}
                onClick={() => setIsPermissionsModalOpen(false)}
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

            {/* Conteúdo com Scroll */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {permissionsModalError && (
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
                  <span>{permissionsModalError}</span>
                </div>
              )}

              {permissionsModalSuccess && (
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
                  <span>{permissionsModalSuccess}</span>
                </div>
              )}

              <div>
                <PermissionsMatrixSelector
                  role={selectedMemberForPermissions.role}
                  roleName={ROLE_LABELS[selectedMemberForPermissions.role] || selectedMemberForPermissions.role}
                  roleCeilings={roleCeilings}
                  roleDefaults={roleDefaults}
                  permissionModules={permissionModules}
                  selectedPermissions={memberEditingPermissions}
                  onChange={setMemberEditingPermissions}
                />
              </div>

              {/* Botões do Modal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  disabled={savingPermissionsLoading}
                  onClick={() => setIsPermissionsModalOpen(false)}
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
                  type="button"
                  onClick={handleSaveMemberPermissions}
                  disabled={savingPermissionsLoading}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, var(--cyan-primary), var(--blue-vibrant))',
                    color: '#05101f',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: savingPermissionsLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {savingPermissionsLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Salvar Permissões
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

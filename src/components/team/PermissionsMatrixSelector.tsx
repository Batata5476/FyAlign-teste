'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  Sliders,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { PermissionModule } from '@/lib/auth/rbac';

interface PermissionsMatrixSelectorProps {
  role: string;
  roleName?: string;
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  roleCeilings: Record<string, string[]>;
  roleDefaults: Record<string, string[]>;
  permissionModules: PermissionModule[];
  disabled?: boolean;
  freeEditMode?: boolean;
  onFreeEditModeChange?: (unlocked: boolean) => void;
}

export function PermissionsMatrixSelector({
  role,
  roleName,
  selectedPermissions,
  onChange,
  roleCeilings,
  roleDefaults,
  permissionModules,
  disabled = false,
  freeEditMode,
  onFreeEditModeChange,
}: PermissionsMatrixSelectorProps) {
  const [internalUnlocked, setInternalUnlocked] = useState(false);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);

  const isFreeEditUnlocked =
    freeEditMode !== undefined ? freeEditMode : internalUnlocked;

  const setUnlocked = (val: boolean) => {
    setInternalUnlocked(val);
    onFreeEditModeChange?.(val);
  };

  const ceiling = useMemo(() => roleCeilings[role] || [], [roleCeilings, role]);
  const defaults = useMemo(() => roleDefaults[role] || [], [roleDefaults, role]);

  const allModuleKeysArray = useMemo(
    () =>
      Array.from(
        new Set(permissionModules.flatMap((m) => m.permissions.map((p) => p.key as string)))
      ),
    [permissionModules]
  );

  const allModuleKeys = useMemo(() => new Set(allModuleKeysArray), [allModuleKeysArray]);

  // Se o membro já possui alguma permissão fora do teto salva anteriormente, inicia destravado
  useEffect(() => {
    if (
      ceiling.length > 0 &&
      selectedPermissions.some((p) => allModuleKeys.has(p) && !ceiling.includes(p))
    ) {
      setInternalUnlocked(true);
      onFreeEditModeChange?.(true);
    }
  }, [ceiling, selectedPermissions, allModuleKeys, onFreeEditModeChange]);

  const visibleCeilingKeys = useMemo(
    () => ceiling.filter((k) => allModuleKeys.has(k)),
    [ceiling, allModuleKeys]
  );

  const activeAllowedCount = useMemo(
    () =>
      selectedPermissions.filter((p) =>
        isFreeEditUnlocked
          ? allModuleKeys.has(p)
          : ceiling.includes(p) && allModuleKeys.has(p)
      ).length,
    [selectedPermissions, ceiling, allModuleKeys, isFreeEditUnlocked]
  );

  const { availableModules, lockedModules } = useMemo(() => {
    if (isFreeEditUnlocked) {
      return { availableModules: permissionModules, lockedModules: [] };
    }

    const available: PermissionModule[] = [];
    const locked: PermissionModule[] = [];

    for (const mod of permissionModules) {
      const hasAnyInCeiling = mod.permissions.some((p) => ceiling.includes(p.key));
      if (hasAnyInCeiling) {
        available.push(mod);
      } else {
        locked.push(mod);
      }
    }

    return { availableModules: available, lockedModules: locked };
  }, [permissionModules, ceiling, isFreeEditUnlocked]);

  const handleRequestUnlock = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (disabled) return;
    setShowConfirmAlert(true);
  };

  const handleConfirmUnlock = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowConfirmAlert(false);
    setUnlocked(true);
  };

  const handleLockBack = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowConfirmAlert(false);
    setUnlocked(false);
    // Filtra de volta para o teto da função ao travar
    onChange(selectedPermissions.filter((p) => ceiling.includes(p)));
  };

  const handleToggle = (permissionKey: string) => {
    if (disabled) return;

    // Se ainda não estiver em modo de edição livre, abre o alerta de confirmação
    if (!isFreeEditUnlocked) {
      setShowConfirmAlert(true);
      return;
    }

    if (selectedPermissions.includes(permissionKey)) {
      onChange(selectedPermissions.filter((p) => p !== permissionKey));
    } else {
      onChange([...selectedPermissions, permissionKey]);
    }
  };

  const handleToggleModule = (mod: PermissionModule, e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!isFreeEditUnlocked) {
      setShowConfirmAlert(true);
      return;
    }

    const modKeys = mod.permissions.map((p) => p.key as string);
    const allSelectedInMod = modKeys.every((k) => selectedPermissions.includes(k));

    if (allSelectedInMod) {
      onChange(selectedPermissions.filter((p) => !modKeys.includes(p)));
    } else {
      const merged = Array.from(new Set([...selectedPermissions, ...modKeys]));
      onChange(merged);
    }
  };

  const handleSelectAllSystemPermissions = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange([...allModuleKeysArray]);
  };

  const handleClearAllPermissions = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange([]);
  };

  const handleSelectAllInCeiling = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange([...visibleCeilingKeys]);
  };

  const handleResetToDefaults = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange(defaults.filter((p) => ceiling.includes(p)));
  };

  const displayRoleLabel = roleName || role;
  const totalDenominator = isFreeEditUnlocked
    ? allModuleKeysArray.length
    : visibleCeilingKeys.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginTop: '6px',
      }}
    >
      {/* Header com resumo e botão Editar Permissões / Controles de Edição Livre */}
      <div
        style={{
          background: 'var(--input-bg)',
          border: isFreeEditUnlocked
            ? '1px solid rgba(245, 158, 11, 0.45)'
            : '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {isFreeEditUnlocked ? (
                <Unlock size={16} color="#f59e0b" />
              ) : (
                <Shield size={16} color="var(--cyan-primary)" />
              )}
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {isFreeEditUnlocked
                  ? 'Modo de Edição Livre de Permissões (Todas Destravadas)'
                  : 'Permissões Efetivas no Teto da Função'}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: isFreeEditUnlocked
                    ? 'rgba(245, 158, 11, 0.14)'
                    : 'rgba(0, 210, 211, 0.12)',
                  color: isFreeEditUnlocked ? '#f59e0b' : 'var(--cyan-primary)',
                  border: isFreeEditUnlocked
                    ? '1px solid rgba(245, 158, 11, 0.35)'
                    : '1px solid rgba(0, 210, 211, 0.25)',
                }}
              >
                {activeAllowedCount} de {totalDenominator} concedidas
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
              {isFreeEditUnlocked ? (
                <>
                  Edição livre ativa para <strong style={{ color: 'var(--text-secondary)' }}>{displayRoleLabel}</strong>:
                  você pode selecionar <strong>todas as permissões do sistema</strong> ou marcar livremente apenas as desejadas.
                </>
              ) : (
                <>
                  Permissões padrão de <strong style={{ color: 'var(--text-secondary)' }}>{displayRoleLabel}</strong> aplicadas.
                  Clique em <strong>Editar Permissões</strong> para personalizar livremente ou liberar todas as permissões.
                </>
              )}
            </p>
          </div>

          {!disabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {!isFreeEditUnlocked ? (
                <button
                  type="button"
                  onClick={handleRequestUnlock}
                  style={{
                    background: 'linear-gradient(135deg, var(--cyan-primary), var(--blue-vibrant))',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#05101f',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 10px var(--cyan-glow)',
                  }}
                >
                  <Sliders size={14} />
                  Editar Permissões
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLockBack}
                  style={{
                    background: 'var(--btn-ghost-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Lock size={12} />
                  Voltar ao Modo Padrão
                </button>
              )}
            </div>
          )}
        </div>

        {/* Barra de Seleção Rápida quando Edição Livre está Ativa */}
        {isFreeEditUnlocked && !disabled && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSelectAllSystemPermissions}
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#10b981',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CheckSquare size={13} />
                Selecionar Todas as Permissões ({allModuleKeysArray.length})
              </button>

              <button
                type="button"
                onClick={handleClearAllPermissions}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#f87171',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Square size={13} />
                Desmarcar Todas (Escolher do Zero)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSelectAllInCeiling}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Apenas Teto ({visibleCeilingKeys.length})
              </button>

              <button
                type="button"
                onClick={handleResetToDefaults}
                style={{
                  background: 'rgba(0, 210, 211, 0.08)',
                  border: '1px solid rgba(0, 210, 211, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'var(--cyan-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCcw size={12} />
                Padrão da Função
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alerta de Certeza antes de Liberar a Edição Livre de Permissões */}
      {showConfirmAlert && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1.5px solid rgba(245, 158, 11, 0.45)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'modalFadeIn 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} color="#f59e0b" />
            </div>
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: '0 0 4px',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                }}
              >
                Tem certeza que deseja editar as permissões de forma livre?
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                Ao confirmar, o bloqueio de teto da função <strong>{displayRoleLabel}</strong> será
                desativado. Você poderá selecionar <strong>todas as permissões do sistema</strong> ou
                escolher livremente qualquer combinação de permissões para este usuário.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowConfirmAlert(false)}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmUnlock}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-sm)',
                background: '#f59e0b',
                border: 'none',
                color: '#05101f',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Unlock size={14} />
              Sim, Tenho Certeza — Liberar Edição Livre
            </button>
          </div>
        </div>
      )}

      {/* Área Rolável: Módulos de Permissões */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: '390px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          {availableModules.map((module) => {
            const modKeys = module.permissions.map((p) => p.key as string);
            const allModSelected = modKeys.every((k) => selectedPermissions.includes(k));

            return (
              <div
                key={module.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <h4
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        margin: 0,
                      }}
                    >
                      {module.name}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {module.description}
                    </span>
                  </div>

                  {isFreeEditUnlocked && !disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleModule(module, e)}
                      style={{
                        background: 'var(--btn-ghost-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: allModSelected ? 'var(--text-muted)' : 'var(--cyan-primary)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {allModSelected ? 'Desmarcar' : 'Marcar tudo'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {module.permissions.map((perm) => {
                    const isAllowedByCeiling = ceiling.includes(perm.key);
                    const isSelectable = isFreeEditUnlocked || isAllowedByCeiling;
                    const isChecked =
                      selectedPermissions.includes(perm.key) &&
                      (isFreeEditUnlocked || isAllowedByCeiling);

                    return (
                      <label
                        key={perm.key}
                        onClick={() => handleToggle(perm.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '9px',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: isChecked
                            ? 'rgba(0, 210, 211, 0.05)'
                            : !isSelectable
                            ? 'rgba(148, 163, 184, 0.04)'
                            : 'transparent',
                          border: isChecked
                            ? '1px solid rgba(0, 210, 211, 0.22)'
                            : '1px solid transparent',
                          cursor: !disabled ? 'pointer' : 'not-allowed',
                          opacity: isSelectable ? 1 : 0.6,
                          userSelect: 'none',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: isChecked
                              ? '1.5px solid var(--cyan-primary)'
                              : isSelectable
                              ? '1.5px solid var(--border-hover)'
                              : '1.5px solid var(--border-subtle)',
                            background: isChecked
                              ? 'var(--cyan-primary)'
                              : 'var(--input-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '2px',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {isChecked && <Check size={13} color="#05101f" strokeWidth={3} />}
                          {!isSelectable && <Lock size={10} color="var(--text-muted)" />}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.80rem',
                                fontWeight: isChecked ? 600 : 500,
                                color: isChecked
                                  ? 'var(--text-main)'
                                  : isSelectable
                                  ? 'var(--text-secondary)'
                                  : 'var(--text-muted)',
                              }}
                            >
                              {perm.label}
                            </span>
                            {!isAllowedByCeiling && !isFreeEditUnlocked && (
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(148, 163, 184, 0.14)',
                                  color: 'var(--text-muted)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <Lock size={9} /> Teto bloqueado
                              </span>
                            )}
                            {!isAllowedByCeiling && isFreeEditUnlocked && (
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(245, 158, 11, 0.14)',
                                  color: '#f59e0b',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <Unlock size={9} /> Destravado
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.71rem', color: 'var(--text-dim)', margin: '1px 0 0' }}>
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Domínios fora do teto padrão (apenas enquanto Edição Livre não foi ativada) */}
        {lockedModules.length > 0 && !isFreeEditUnlocked && (
          <div
            style={{
              background: 'rgba(148, 163, 184, 0.04)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={13} color="var(--text-muted)" />
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Domínios Bloqueados pelo Teto de {displayRoleLabel}
                </span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRequestUnlock}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cyan-primary)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Destravar todos os domínios
                </button>
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '8px',
              }}
            >
              {lockedModules.map((mod) => (
                <div
                  key={mod.id}
                  onClick={handleRequestUnlock}
                  title="Clique em Editar Permissões para destravar este domínio."
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    opacity: 0.7,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {mod.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-dim)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {mod.description}
                    </div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: 'rgba(148, 163, 184, 0.16)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Lock size={10} /> Bloqueado
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

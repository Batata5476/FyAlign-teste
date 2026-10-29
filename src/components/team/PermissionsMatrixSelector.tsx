'use client';

import React, { useMemo } from 'react';
import {
  Shield,
  Lock,
  RotateCcw,
  Check,
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
}: PermissionsMatrixSelectorProps) {
  const ceiling = useMemo(() => roleCeilings[role] || [], [roleCeilings, role]);
  const defaults = useMemo(() => roleDefaults[role] || [], [roleDefaults, role]);

  const allModuleKeys = useMemo(
    () => new Set(permissionModules.flatMap((m) => m.permissions.map((p) => p.key as string))),
    [permissionModules]
  );

  // Conta apenas permissões canônicas visíveis nos módulos para que o contador X de Y seja exato
  const visibleCeilingKeys = useMemo(
    () => ceiling.filter((k) => allModuleKeys.has(k)),
    [ceiling, allModuleKeys]
  );

  const activeAllowedCount = useMemo(
    () =>
      selectedPermissions.filter(
        (p) => ceiling.includes(p) && allModuleKeys.has(p)
      ).length,
    [selectedPermissions, ceiling, allModuleKeys]
  );

  const { availableModules, lockedModules } = useMemo(() => {
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
  }, [permissionModules, ceiling]);

  const handleToggle = (permissionKey: string) => {
    if (disabled || !ceiling.includes(permissionKey)) return;

    if (selectedPermissions.includes(permissionKey)) {
      onChange(selectedPermissions.filter((p) => p !== permissionKey));
    } else {
      onChange([...selectedPermissions, permissionKey]);
    }
  };

  const handleResetToDefaults = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange(defaults.filter((p) => ceiling.includes(p)));
  };

  const handleSelectAllInCeiling = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange([...ceiling]);
  };

  const displayRoleLabel = roleName || role;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginTop: '6px',
      }}
    >
      {/* Header com resumo do teto e botões de ação rápida */}
      <div
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Shield size={16} color="var(--cyan-primary)" />
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Permissões Efetivas no Teto da Função
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(0, 210, 211, 0.12)',
                color: 'var(--cyan-primary)',
                border: '1px solid rgba(0, 210, 211, 0.25)',
              }}
            >
              {activeAllowedCount} de {visibleCeilingKeys.length} concedidas
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
            Você pode restringir o acesso de <strong style={{ color: 'var(--text-secondary)' }}>{displayRoleLabel}</strong> desmarcando itens abaixo, mas não pode conceder permissões bloqueadas pelo teto (<Lock size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />).
          </p>
        </div>

        {!disabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSelectAllInCeiling}
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Teto Completo ({visibleCeilingKeys.length})
            </button>
            <button
              type="button"
              onClick={handleResetToDefaults}
              style={{
                background: 'rgba(0, 210, 211, 0.08)',
                border: '1px solid rgba(0, 210, 211, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.75rem',
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
        )}
      </div>

      {/* Área Rolável: Módulos Disponíveis + Módulos Bloqueados pelo Teto */}
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
        {/* 1. Módulos Disponíveis dentro do Teto da Role */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          {availableModules.map((module) => (
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
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {module.permissions.map((perm) => {
                  const isAllowedByCeiling = ceiling.includes(perm.key);
                  const isChecked = selectedPermissions.includes(perm.key) && isAllowedByCeiling;

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
                          : !isAllowedByCeiling
                          ? 'rgba(148, 163, 184, 0.04)'
                          : 'transparent',
                        border: isChecked
                          ? '1px solid rgba(0, 210, 211, 0.22)'
                          : '1px solid transparent',
                        cursor: !disabled && isAllowedByCeiling ? 'pointer' : 'not-allowed',
                        opacity: isAllowedByCeiling ? 1 : 0.55,
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
                            : isAllowedByCeiling
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
                        {!isAllowedByCeiling && <Lock size={10} color="var(--text-muted)" />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.80rem',
                              fontWeight: isChecked ? 600 : 500,
                              color: isChecked
                                ? 'var(--text-main)'
                                : isAllowedByCeiling
                                ? 'var(--text-secondary)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {perm.label}
                          </span>
                          {!isAllowedByCeiling && (
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
          ))}
        </div>

        {/* 2. Domínios Bloqueados pelo Teto da Função (🔒 Inacessíveis para esta Role) */}
        {lockedModules.length > 0 && (
          <div
            style={{
              background: 'rgba(148, 163, 184, 0.04)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Lock size={13} color="var(--text-muted)" />
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Domínios Bloqueados pelo Teto de {displayRoleLabel}
              </span>
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
                  title={`A função "${displayRoleLabel}" não permite conceder permissões de ${mod.name}.`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    opacity: 0.65,
                    cursor: 'not-allowed',
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

'use client';

import React from 'react';
import {
  Shield,
  Lock,
  RotateCcw,
  Check,
  AlertTriangle,
  Info,
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
  const ceiling = roleCeilings[role] || [];
  const defaults = roleDefaults[role] || [];

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
    onChange([...defaults]);
  };

  const handleSelectAllInCeiling = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange([...ceiling]);
  };

  const activeAllowedCount = selectedPermissions.filter((p) => ceiling.includes(p)).length;

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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} color="var(--cyan-primary)" />
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Permissões Granulares de Acesso
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
              {activeAllowedCount} de {ceiling.length} ativas
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            O cargo <strong style={{ color: 'var(--text-secondary)' }}>{roleName}</strong> define o teto máximo.
            Você pode reduzir prerrogativas para personalizar o acesso.
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
              Teto Completo ({ceiling.length})
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

      {/* Grid de Módulos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
          maxHeight: '360px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {permissionModules.map((module) => {
          // Permissões do módulo que estão no teto
          const moduleInCeilingCount = module.permissions.filter((p) => ceiling.includes(p.key)).length;
          const isEntireModuleOutOfCeiling = moduleInCeilingCount === 0;

          return (
            <div
              key={module.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isEntireModuleOutOfCeiling ? 'var(--border-subtle)' : 'var(--border-card)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                opacity: isEntireModuleOutOfCeiling ? 0.45 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {/* Título do Módulo */}
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
                      color: isEntireModuleOutOfCeiling ? 'var(--text-muted)' : 'var(--text-main)',
                      margin: 0,
                    }}
                  >
                    {module.name}
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {module.description}
                  </span>
                </div>

                {isEntireModuleOutOfCeiling && (
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(148, 163, 184, 0.15)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <Lock size={10} /> Fora do teto
                  </span>
                )}
              </div>

              {/* Lista de Ações do Módulo */}
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
                        background: isChecked ? 'rgba(0, 210, 211, 0.05)' : 'transparent',
                        border: isChecked
                          ? '1px solid rgba(0, 210, 211, 0.22)'
                          : '1px solid transparent',
                        cursor: !disabled && isAllowedByCeiling ? 'pointer' : 'not-allowed',
                        opacity: isAllowedByCeiling ? 1 : 0.4,
                        userSelect: 'none',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {/* Custom Checkbox */}
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

                      {/* Descrição da Ação */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.80rem',
                              fontWeight: isChecked ? 600 : 500,
                              color: isChecked ? 'var(--text-main)' : isAllowedByCeiling ? 'var(--text-secondary)' : 'var(--text-muted)',
                            }}
                          >
                            {perm.label}
                          </span>
                          {!isAllowedByCeiling && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                              (Bloqueado)
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
    </div>
  );
}

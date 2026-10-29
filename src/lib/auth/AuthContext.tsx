'use client';

import React, { createContext, useContext, useMemo } from 'react';
import {
  Permission,
  userHasPermission,
  userHasAnyPermission,
} from '@/lib/auth/rbac';

export interface FrontendMembershipSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  role: string;
  status: string;
  croStatus: string;
  permissions: string[];
}

export interface FrontendAuthUser {
  id: string;
  name: string;
  fullName: string;
  email: string;
  role: string;
  permissions: Permission[];
  croStatus: string;
  activeMembershipId: string;
  organization: {
    id: string;
    tradeName: string;
    type: string;
  };
  memberships: FrontendMembershipSummary[];
  professionalIdCro?: string | null;
  clinic?: {
    id: string;
    tradeName: string;
  } | null;
}

export interface AuthContextValue {
  user: FrontendAuthUser | null;
  permissions: readonly Permission[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  permissions: [],
  can: () => false,
  canAny: () => false,
  refreshUser: async () => {},
});

/**
 * Mapeia rotas do portal `/dashboard/*` para a permissão canônica mínima exigida.
 * Garante proteção uniforme de páginas tanto no menu lateral quanto em navegação direta por URL.
 */
export function getRequiredRoutePermission(pathname: string): Permission | null {
  if (!pathname || pathname === '/dashboard') {
    return null;
  }

  if (pathname.startsWith('/dashboard/admin')) {
    return 'SYSTEM_ADMIN';
  }
  if (pathname.startsWith('/dashboard/audit')) {
    return 'AUDIT_READ';
  }
  if (pathname.startsWith('/dashboard/team')) {
    return 'TEAM_READ';
  }
  if (pathname.startsWith('/dashboard/lab')) {
    return 'PRODUCTION_READ';
  }
  if (pathname.startsWith('/dashboard/orders')) {
    return 'ORDER_READ';
  }
  if (pathname.startsWith('/dashboard/patients')) {
    return 'PATIENT_READ';
  }
  if (pathname.startsWith('/dashboard/setups')) {
    return 'SETUP_READ';
  }
  if (pathname === '/dashboard/cases/new') {
    return 'CASE_CREATE';
  }
  if (/^\/dashboard\/cases\/[^/]+\/setup(\/|$)/.test(pathname)) {
    return 'SETUP_READ';
  }
  if (/^\/dashboard\/cases\/[^/]+\/upload(\/|$)/.test(pathname)) {
    return 'FILE_READ';
  }
  if (pathname.startsWith('/dashboard/cases/')) {
    return 'CASE_READ';
  }

  return null;
}

export function AuthProvider({
  user,
  refreshUser,
  children,
}: {
  user: FrontendAuthUser | null;
  refreshUser: () => Promise<void>;
  children: React.ReactNode;
}) {
  const value = useMemo<AuthContextValue>(() => {
    const permissions = Array.isArray(user?.permissions) ? user!.permissions : [];
    return {
      user,
      permissions,
      can: (permission: Permission) => userHasPermission(user, permission),
      canAny: (perms: readonly Permission[]) => userHasAnyPermission(user, perms),
      refreshUser,
    };
  }, [user, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}


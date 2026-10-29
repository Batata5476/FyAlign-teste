import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, AuthUserContext } from '@/lib/auth/session';
import { hasPermission, Permission, ROLES } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

export type ResourceType =
  | 'CASE'
  | 'SETUP'
  | 'PATIENT'
  | 'FILE'
  | 'ORDER'
  | 'LAB'
  | 'AUDIT'
  | 'TEAM';

export interface AuthorizeOptions {
  permission: Permission;
  resource?: {
    type: ResourceType;
    id?: string;
  };
  requireCroVerified?: boolean;
}

export type AuthorizeResult =
  | { authorized: true; user: AuthUserContext; resourceData?: any }
  | { authorized: false; response: NextResponse };

/**
 * Guard Central de Autorização do FyAlign.
 * Executa a esteira em 5 camadas:
 * 1. Sessão e Identidade
 * 2. Vínculo e Organização Ativos
 * 3. Validação de Permissão (RBAC)
 * 4. Escopo do Recurso e Proteção Cross-Tenant (IDOR)
 * 5. Regras de Negócio Médicas (ex: CRO_STATUS === VERIFIED)
 */
export async function authorize(
  req: NextRequest,
  options: AuthorizeOptions
): Promise<AuthorizeResult> {
  // 1 e 2. Revalidação da Sessão, User, Membership e Organization contra o banco
  const user = await getCurrentUser(req);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Não autenticado ou sessão expirada.', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  // 3. Validação de Permissão Granular (Role Ceiling + Membership Permissions)
  if (!hasPermission({ role: user.role, permissions: user.permissions }, options.permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Acesso negado: Vínculo ativo (${user.role}) não possui permissão para ${options.permission}.`,
          code: 'FORBIDDEN_PERMISSION',
        },
        { status: 403 }
      ),
    };
  }

  // Regra Especial de Habilitação Profissional (CRO)
  const mustCheckCro =
    options.permission === 'SETUP_APPROVE' ||
    options.permission === 'APPROVE_SETUP_3D' ||
    options.permission === 'SUBMIT_CASE' ||
    options.permission === 'SIGN_PRESCRIPTION' ||
    options.requireCroVerified;

  if (mustCheckCro && user.role === ROLES.DOCTOR) {
    if (user.croStatus !== 'VERIFIED') {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error:
              'Aprovação clínica bloqueada: o registro no Conselho Regional de Odontologia (CRO) está pendente de validação ou inválido (RN-02).',
            code: 'CRO_NOT_VERIFIED',
          },
          { status: 403 }
        ),
      };
    }
  }

  // 4 e 5. Validação de Escopo e Proteção Cross-Tenant / IDOR
  let resourceData: any = null;

  if (options.resource) {
    const { type, id } = options.resource;

    // Escopo de Laboratório Fabril
    if (type === 'LAB') {
      if (user.organizationType !== 'FYALIGN') {
        return {
          authorized: false,
          response: NextResponse.json(
            {
              error: 'Acesso restrito ao domínio operacional do Laboratório FyAlign.',
              code: 'FORBIDDEN_LAB_DOMAIN',
            },
            { status: 403 }
          ),
        };
      }
    }

    // Escopo de Caso Clínico
    if (type === 'CASE' && id) {
      resourceData = await prisma.case.findUnique({
        where: { id },
        select: {
          id: true,
          caseCode: true,
          clinicId: true,
          doctorId: true,
          doctorMembershipId: true,
          status: true,
        },
      });

      if (!resourceData) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: 'Caso clínico não encontrado.', code: 'NOT_FOUND' },
            { status: 404 }
          ),
        };
      }

      // Validação Cross-Tenant (Clínica A não pode ver Caso da Clínica B)
      if (user.organizationType === 'CLINIC') {
        if (resourceData.clinicId !== user.organizationId) {
          // Retorna 404 para evitar vazamento de existência (OWASP IDOR)
          return {
            authorized: false,
            response: NextResponse.json(
              { error: 'Caso clínico não encontrado.', code: 'NOT_FOUND' },
              { status: 404 }
            ),
          };
        }
      }
    }

    // Escopo de Setup Virtual 3D
    if (type === 'SETUP' && id) {
      resourceData = await prisma.setup.findUnique({
        where: { id },
        include: {
          case: {
            select: {
              id: true,
              clinicId: true,
              doctorId: true,
              status: true,
            },
          },
        },
      });

      if (!resourceData) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: 'Setup virtual não encontrado.', code: 'NOT_FOUND' },
            { status: 404 }
          ),
        };
      }

      if (user.organizationType === 'CLINIC') {
        if (resourceData.case.clinicId !== user.organizationId) {
          return {
            authorized: false,
            response: NextResponse.json(
              { error: 'Setup virtual não encontrado.', code: 'NOT_FOUND' },
              { status: 404 }
            ),
          };
        }
      }
    }

    // Escopo de Paciente
    if (type === 'PATIENT' && id) {
      resourceData = await prisma.patient.findUnique({
        where: { id },
        select: {
          id: true,
          clinicId: true,
          fullName: true,
        },
      });

      if (!resourceData) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: 'Paciente não encontrado.', code: 'NOT_FOUND' },
            { status: 404 }
          ),
        };
      }

      if (user.organizationType === 'CLINIC') {
        if (resourceData.clinicId !== user.organizationId) {
          return {
            authorized: false,
            response: NextResponse.json(
              { error: 'Paciente não encontrado.', code: 'NOT_FOUND' },
              { status: 404 }
            ),
          };
        }
      }
    }

    // Escopo de Arquivo
    if (type === 'FILE' && id) {
      resourceData = await prisma.caseFile.findUnique({
        where: { id },
        include: {
          case: {
            select: {
              id: true,
              clinicId: true,
            },
          },
        },
      });

      if (!resourceData) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: 'Arquivo não encontrado.', code: 'NOT_FOUND' },
            { status: 404 }
          ),
        };
      }

      if (user.organizationType === 'CLINIC') {
        if (resourceData.case.clinicId !== user.organizationId) {
          return {
            authorized: false,
            response: NextResponse.json(
              { error: 'Arquivo não encontrado.', code: 'NOT_FOUND' },
              { status: 404 }
            ),
          };
        }
      }
    }
  }

  return {
    authorized: true,
    user,
    resourceData,
  };
}

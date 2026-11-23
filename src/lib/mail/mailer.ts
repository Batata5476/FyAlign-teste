import nodemailer from 'nodemailer';

export type EmailProviderType = 'RESEND' | 'SMTP' | 'ETHEREAL' | 'MEMORY' | 'NONE';

export interface EmailDispatchResult {
  delivered: boolean;
  status: 'SENT' | 'FAILED' | 'UNCONFIGURED';
  provider: EmailProviderType;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

export interface CapturedEmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  sentAt: string;
  metadata?: Record<string, any>;
}

// Outbox em memória exclusivamente para suítes de testes automatizados (NODE_ENV=test / FYALIGN_TEST_MAILBOX=1)
const memoryOutbox: CapturedEmailMessage[] = [];

export function getTestEmailOutbox(): CapturedEmailMessage[] {
  return [...memoryOutbox];
}

export function clearTestEmailOutbox(): void {
  memoryOutbox.length = 0;
}

const ROLE_LABELS_PT: Record<string, string> = {
  CLINIC_ADMIN: 'Administrador da Clínica',
  DOCTOR: 'Cirurgião-Dentista',
  CLINIC_ASSISTANT: 'Assistente Clínico',
  PLANNER_3D: 'Planejador CAD 3D',
  PRODUCTION_QC: 'Controle de Qualidade & Produção',
  FINANCE: 'Financeiro & Contratos',
  SUPPORT: 'Comercial & Suporte Operacional',
  SUPER_ADMIN: 'Administrador Geral FyAlign',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailTransportStatus {
  configured: boolean;
  provider: EmailProviderType;
  fromAddress: string;
  hint?: string;
}

export function getEmailTransportStatus(): EmailTransportStatus {
  const mode = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase().trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const explicitFrom = (process.env.EMAIL_FROM || '').trim();

  if (
    mode === 'memory' ||
    process.env.FYALIGN_TEST_MAILBOX === '1' ||
    process.env.NODE_ENV === 'test'
  ) {
    return {
      configured: true,
      provider: 'MEMORY',
      fromAddress: explicitFrom || 'FyAlign Plataforma <nao-responda@fyalign.com.br>',
    };
  }

  if ((mode === 'resend' || mode === 'auto') && resendKey) {
    return {
      configured: true,
      provider: 'RESEND',
      fromAddress: explicitFrom || 'FyAlign Plataforma <onboarding@resend.dev>',
    };
  }

  if ((mode === 'smtp' || mode === 'auto') && smtpHost && smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'SMTP',
      fromAddress: explicitFrom || `FyAlign Plataforma <${smtpUser}>`,
    };
  }

  if (mode === 'ethereal') {
    return {
      configured: true,
      provider: 'ETHEREAL',
      fromAddress: explicitFrom || 'FyAlign Plataforma <nao-responda@fyalign.com.br>',
      hint: 'Modo Ethereal (caixa de entrada de homologação com link de pré-visualização).',
    };
  }

  return {
    configured: false,
    provider: 'NONE',
    fromAddress: explicitFrom || 'FyAlign Plataforma <nao-responda@fyalign.com.br>',
    hint: 'Defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS (ou RESEND_API_KEY) no arquivo .env para envio real de e-mails externos.',
  };
}

let cachedEtherealAccount: { user: string; pass: string } | null = null;

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, any>;
}): Promise<EmailDispatchResult> {
  const transportStatus = getEmailTransportStatus();

  if (!transportStatus.configured || transportStatus.provider === 'NONE') {
    return {
      delivered: false,
      status: 'UNCONFIGURED',
      provider: 'NONE',
      error:
        transportStatus.hint ||
        'Servidor de e-mail não configurado no ambiente (.env).',
    };
  }

  if (transportStatus.provider === 'MEMORY') {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    memoryOutbox.push({
      to: params.to,
      from: transportStatus.fromAddress,
      subject: params.subject,
      html: params.html,
      text: params.text,
      sentAt: new Date().toISOString(),
      metadata: params.metadata,
    });
    return {
      delivered: true,
      status: 'SENT',
      provider: 'MEMORY',
      messageId: id,
    };
  }

  if (transportStatus.provider === 'RESEND') {
    try {
      const resendKey = (process.env.RESEND_API_KEY || '').trim();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: transportStatus.fromAddress,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          delivered: false,
          status: 'FAILED',
          provider: 'RESEND',
          error:
            payload?.message ||
            payload?.error ||
            `Falha na API Resend (HTTP ${response.status}).`,
        };
      }

      return {
        delivered: true,
        status: 'SENT',
        provider: 'RESEND',
        messageId: payload?.id,
      };
    } catch (err: any) {
      return {
        delivered: false,
        status: 'FAILED',
        provider: 'RESEND',
        error: err?.message || 'Erro de conexão com a API Resend.',
      };
    }
  }

  if (transportStatus.provider === 'ETHEREAL') {
    try {
      if (!cachedEtherealAccount) {
        const testAcc = await nodemailer.createTestAccount();
        cachedEtherealAccount = { user: testAcc.user, pass: testAcc.pass };
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: cachedEtherealAccount.user,
          pass: cachedEtherealAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from: transportStatus.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      const preview = nodemailer.getTestMessageUrl(info) || undefined;
      if (preview) {
        console.info(`[FyAlign Mailer - Ethereal Preview] ${params.to} -> ${preview}`);
      }

      return {
        delivered: true,
        status: 'SENT',
        provider: 'ETHEREAL',
        messageId: info.messageId,
        previewUrl: preview,
      };
    } catch (err: any) {
      return {
        delivered: false,
        status: 'FAILED',
        provider: 'ETHEREAL',
        error: err?.message || 'Falha ao enviar via Ethereal SMTP.',
      };
    }
  }

  // Transporte SMTP Padrão (Gmail App Password, Office365, Hostinger, SES, etc.)
  try {
    const host = (process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secureEnv = (process.env.SMTP_SECURE || '').toLowerCase().trim();
    const secure = secureEnv ? secureEnv === 'true' || secureEnv === '1' : port === 465;
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: transportStatus.fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return {
      delivered: true,
      status: 'SENT',
      provider: 'SMTP',
      messageId: info.messageId,
    };
  } catch (err: any) {
    return {
      delivered: false,
      status: 'FAILED',
      provider: 'SMTP',
      error: err?.message || 'Erro ao enviar e-mail via servidor SMTP.',
    };
  }
}

export interface TeamInvitationEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  role: string;
  invitedByName: string;
  temporaryPassword?: string | null;
  expiresAt: Date;
}

export async function sendTeamInvitationEmail(
  params: TeamInvitationEmailParams
): Promise<EmailDispatchResult> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const loginUrl = `${appUrl}/`;
  const roleLabel = ROLE_LABELS_PT[params.role] || params.role;
  const expiresFormatted = params.expiresAt.toLocaleDateString('pt-BR');

  const safeRecipientName = escapeHtml(params.recipientName);
  const safeOrgName = escapeHtml(params.organizationName);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeInviterName = escapeHtml(params.invitedByName);
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeTempPassword = params.temporaryPassword ? escapeHtml(params.temporaryPassword) : null;
  const safeLoginUrl = escapeHtml(loginUrl);

  const subject = `Convite de Acesso ao FyAlign — ${params.organizationName}`;

  const credentialsHtml = safeTempPassword
    ? `
      <div style="background:#0b172a;border:1px solid #1e3a5f;border-radius:10px;padding:20px;margin:22px 0;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#00d2d3;">
          Suas Credenciais de Primeiro Acesso
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#94a3b8;font-size:14px;width:150px;">E-mail de acesso:</td>
            <td style="padding:6px 0;color:#f8fafc;font-size:14px;font-weight:600;">${safeEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#94a3b8;font-size:14px;">Senha temporária:</td>
            <td style="padding:6px 0;">
              <code style="display:inline-block;background:#112240;border:1px solid #00d2d3;color:#00d2d3;padding:6px 12px;border-radius:6px;font-size:15px;font-weight:700;letter-spacing:0.06em;">${safeTempPassword}</code>
            </td>
          </tr>
        </table>
      </div>
      <div style="background:#1e293b;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0;color:#fde68a;font-size:13px;line-height:1.5;">
          <strong>Redefinição obrigatória no primeiro acesso:</strong> Ao entrar no portal com a senha temporária acima, o sistema orientará você automaticamente a criar uma nova senha pessoal e definitiva antes de acessar os módulos clínicos/operacionais.
        </p>
      </div>
    `
    : `
      <div style="background:#0b172a;border:1px solid #1e3a5f;border-radius:10px;padding:18px;margin:22px 0;">
        <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.55;">
          Identificamos que você já possui uma conta ativa no <strong>FyAlign</strong> (${safeEmail}). Utilize sua senha atual para entrar no portal e selecione <strong>${safeOrgName}</strong> no seletor de organizações no topo da tela.
        </p>
      </div>
    `;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#050c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;background:#091324;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #1e293b;background:linear-gradient(135deg,#071529,#0d213f);">
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">
        Fy<span style="color:#00d2d3;">Align</span>
      </h1>
      <p style="margin:4px 0 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">
        Plataforma Ortodôntica B2B
      </p>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 12px;font-size:19px;color:#f8fafc;">Olá, ${safeRecipientName}!</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">
        <strong>${safeInviterName}</strong> convidou você para integrar a equipe da organização
        <strong style="color:#ffffff;">${safeOrgName}</strong> no FyAlign com a função
        <strong style="color:#00d2d3;">${safeRoleLabel}</strong>.
      </p>
      ${credentialsHtml}
      <div style="text-align:center;margin:28px 0;">
        <a href="${safeLoginUrl}" style="display:inline-block;background:linear-gradient(135deg,#00d2d3,#0abde3);color:#04101f;text-decoration:none;font-weight:800;font-size:15px;padding:13px 28px;border-radius:8px;">
          Acessar Plataforma FyAlign
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.5;">
        Link direto: <a href="${safeLoginUrl}" style="color:#38bdf8;">${safeLoginUrl}</a><br/>
        Validade de referência do convite: ${expiresFormatted}. Caso não reconheça este convite, desconsidere esta mensagem.
      </p>
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    `Olá, ${params.recipientName}!`,
    '',
    `${params.invitedByName} convidou você para integrar a equipe de "${params.organizationName}" no FyAlign como ${roleLabel}.`,
    '',
    ...(params.temporaryPassword
      ? [
          `E-mail de acesso: ${params.recipientEmail}`,
          `Senha temporária: ${params.temporaryPassword}`,
          '',
          'IMPORTANTE: Assim que você acessar o sistema pela primeira vez com esta senha temporária, será orientado(a) automaticamente a redefinir sua senha para uma senha pessoal definitiva.',
        ]
      : [
          `Você já possui conta ativa no FyAlign (${params.recipientEmail}). Acesse com sua senha atual e selecione "${params.organizationName}" no topo do painel.`,
        ]),
    '',
    `Acesse o portal em: ${loginUrl}`,
    `Validade do convite: ${expiresFormatted}`,
  ];

  return sendTransactionalEmail({
    to: params.recipientEmail,
    subject,
    html,
    text: textLines.join('\n'),
    metadata: {
      type: 'TEAM_INVITATION',
      organizationName: params.organizationName,
      role: params.role,
      hasTemporaryPassword: Boolean(params.temporaryPassword),
      temporaryPassword: params.temporaryPassword || null,
    },
  });
}


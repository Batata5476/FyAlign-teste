'use client';

import React from 'react';
import {
  UserCheck,
  ShieldCheck,
  Building2,
  Mail,
  Stethoscope,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ProfessionalInfo } from './types';

interface StepProfessionalProps {
  professional: ProfessionalInfo | null;
  onNext: () => void;
}

export function StepProfessional({ professional, onNext }: StepProfessionalProps) {
  if (!professional) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        Carregando informações do profissional autenticado...
      </div>
    );
  }

  const isCroVerified = professional.croStatus === 'VERIFIED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Informativo */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Etapa 1 — Identificação Profissional & Responsabilidade Técnica
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Os dados do prescritor são fixados a partir da sessão ativa e do Conselho Regional de Odontologia (CRO).
          </p>
        </div>
        <div
          style={{
            background: isCroVerified ? 'var(--badge-approved-bg)' : 'var(--badge-warning-bg)',
            color: isCroVerified ? 'var(--badge-approved-text)' : 'var(--badge-warning-text)',
            border: isCroVerified ? '1px solid var(--badge-approved-border)' : '1px solid var(--badge-warning-border)',
            padding: '6px 14px',
            fontSize: '0.82rem',
            fontWeight: 700,
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {isCroVerified ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
          <span>{isCroVerified ? 'CRO Habilitado no CFO' : 'CRO em Análise Regulatória'}</span>
        </div>
      </div>

      {/* Grid de Campos Read-Only */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}
      >
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Stethoscope size={14} color="var(--cyan-primary)" />
            <span>Cirurgião-Dentista Responsável</span>
          </label>
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            {professional.fullName}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <ShieldCheck size={14} color="var(--cyan-primary)" />
            <span>Registro Profissional (CRO)</span>
          </label>
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.95rem',
            }}
          >
            {professional.cro || 'Não cadastrado'}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Building2 size={14} color="var(--cyan-primary)" />
            <span>Clínica Odontológica (Tenant)</span>
          </label>
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
            }}
          >
            {professional.clinicName}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Mail size={14} color="var(--cyan-primary)" />
            <span>E-mail Corporativo</span>
          </label>
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
            }}
          >
            {professional.email}
          </div>
        </div>
      </div>

      {/* Alerta de Imutabilidade */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--badge-setup-bg)',
          border: '1px solid var(--badge-setup-border)',
          borderRadius: '8px',
          color: 'var(--cyan-primary)',
          fontSize: '0.85rem',
          fontWeight: 500,
        }}
      >
        <Info size={16} style={{ flexShrink: 0 }} />
        <span>
          A identificação do prescritor é assinada digitalmente e vinculada de forma imutável ao prontuário do paciente (RN-02).
        </span>
      </div>

      {/* Ação Próxima */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button
          onClick={onNext}
          className="btn-glow"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0284c7 0%, #009b9c 100%)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Avançar para Paciente</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

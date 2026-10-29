'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { OdontogramFDI } from '@/components/prescription/OdontogramFDI';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  FileSignature,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  Layers,
  Sparkles,
  Lock,
  X
} from 'lucide-react';

interface PrescriptionFormProps {
  initialCase: any;
  userCro?: string | null;
  userName?: string;
  onSubmitted?: () => void;
}

export function PrescriptionForm({
  initialCase,
  userCro = 'CRO-SP 102938',
  userName = 'Dr. Roberto Silva',
  onSubmitted,
}: PrescriptionFormProps) {
  const router = useRouter();
  const { can } = useAuth();
  const canEdit = can('CASE_UPDATE');
  const canSubmit = can('SUBMIT_CASE');

  // Estados da Prescrição Clínica
  const [treatedArches, setTreatedArches] = useState<'UPPER' | 'LOWER' | 'BOTH'>(
    initialCase.treatedArches || 'BOTH'
  );
  const [chiefComplaint, setChiefComplaint] = useState(initialCase.chiefComplaint || '');
  const [angleClass, setAngleClass] = useState(initialCase.angleClass || 'Classe I');
  const [midlinePreference, setMidlinePreference] = useState('Coincidir com a linha média facial');
  
  // Preferências de IPR e Attachments
  const parsedIpr = initialCase.iprPreferences ? JSON.parse(initialCase.iprPreferences) : { allowed: true, maxPerContactMm: 0.3 };
  const [iprAllowed, setIprAllowed] = useState(parsedIpr.allowed !== false);
  const [iprMaxMm, setIprMaxMm] = useState(parsedIpr.maxPerContactMm || 0.3);

  const parsedAttachments = initialCase.attachmentPreferences ? JSON.parse(initialCase.attachmentPreferences) : { allowed: true, avoidAnterior: true };
  const [attachmentAllowed, setAttachmentAllowed] = useState(parsedAttachments.allowed !== false);
  const [avoidAnteriorAttachments, setAvoidAnteriorAttachments] = useState(parsedAttachments.avoidAnterior !== false);

  // Odontograma FDI
  const [restrictedTeeth, setRestrictedTeeth] = useState<string[]>(
    initialCase.restrictedTeethFdi ? JSON.parse(initialCase.restrictedTeethFdi) : []
  );
  const [extractedTeeth, setExtractedTeeth] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState(initialCase.doctorNotes || '');

  // Auto-save e Feedback (F3.14)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal de Assinatura Eletrônica e Submissão
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [tcleConfirmed, setTcleConfirmed] = useState(false);
  const [profDeclaration, setProfDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isLocked = initialCase.status !== 'DRAFT' && initialCase.status !== 'PENDING_DOCS';
  const formReadOnly = isLocked || !canEdit;

  // Gatilho de Auto-Save com Debounce de 1000ms (F3.14)
  const triggerAutoSave = () => {
    if (formReadOnly) return;
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cases/${initialCase.id}/prescription`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            treatedArches,
            chiefComplaint,
            angleClass,
            restrictedTeethFdi: restrictedTeeth,
            iprPreferences: { allowed: iprAllowed, maxPerContactMm: iprMaxMm },
            attachmentPreferences: { allowed: attachmentAllowed, avoidAnterior: avoidAnteriorAttachments },
            doctorNotes,
          }),
        });

        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        setSaveStatus('error');
      }
    }, 1000);
  };

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    triggerAutoSave();
  };

  // Chips de Queixas Principais Rápidas (F3.03)
  const quickComplaints = [
    'Apinhamento anterior moderado',
    'Fechamento de diastemas interincisais',
    'Correção de sobremordida profunda',
    'Correção de mordida aberta anterior',
    'Expansão de arcadas e alinhamento',
    'Recidiva ortodôntica pós-aparelho fixo',
  ];

  const handleQuickComplaintClick = (complaint: string) => {
    const updated = chiefComplaint ? `${chiefComplaint}. ${complaint}` : complaint;
    setChiefComplaint(updated);
    triggerAutoSave();
  };

  // Submissão com Assinatura Eletrônica (F3.11, F3.12, F3.13)
  const handleFormalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Salva estado mais recente antes de submeter
      await fetch(`/api/cases/${initialCase.id}/prescription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatedArches,
          chiefComplaint,
          angleClass,
          restrictedTeethFdi: restrictedTeeth,
          iprPreferences: { allowed: iprAllowed, maxPerContactMm: iprMaxMm },
          attachmentPreferences: { allowed: attachmentAllowed, avoidAnterior: avoidAnteriorAttachments },
          doctorNotes,
        }),
      });

      const res = await fetch(`/api/cases/${initialCase.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tcleConfirmed,
          professionalDeclaration: profDeclaration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na submissão');
      }

      setSubmitModalOpen(false);
      if (onSubmitted) onSubmitted();
      router.push('/dashboard');
    } catch (err: any) {
      setSubmitError(err.message || 'Erro ao submeter');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Header com Status de Salvamento */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
            Prescrição Ortodôntica Digital & Planejamento Biomecânico
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Paciente: <strong style={{ color: 'var(--text-main)' }}>{initialCase.patient?.fullName}</strong> • Caso: <strong style={{ color: 'var(--cyan-primary)' }}>{initialCase.caseCode}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {saveStatus === 'saving' && (
            <span style={{ fontSize: '0.8rem', color: 'var(--cyan-primary)' }}>Salvando alterações...</span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: '0.8rem', color: 'var(--emerald-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Salvo automaticamente
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: '0.8rem', color: 'var(--crimson-danger)' }}>Erro ao salvar rascunho</span>
          )}

          {!isLocked && canSubmit && (
            <button
              type="button"
              onClick={() => setSubmitModalOpen(true)}
              className="btn-primary"
              style={{ padding: '10px 20px' }}
            >
              <FileSignature size={18} />
              <span>Assinar & Submeter Caso</span>
            </button>
          )}

          {!isLocked && !canSubmit && (
            <span className="badge badge-warning" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={13} />
              Aguardando Assinatura do Cirurgião-Dentista
            </span>
          )}

          {isLocked && (
            <span className="badge badge-approved" style={{ fontSize: '0.8rem' }}>
              <Lock size={13} />
              Caso Submetido (Modo Leitura)
            </span>
          )}
        </div>
      </div>

      {/* 1. SELEÇÃO DE ARCADAS A TRATAR (F3.02) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>
          1. Arcadas a Tratar
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { value: 'BOTH', title: 'Ambas as Arcadas', desc: 'Planejamento integrado de maxila e mandíbula' },
            { value: 'UPPER', title: 'Arcada Superior Apenas', desc: 'Movimentação exclusiva dos dentes superiores' },
            { value: 'LOWER', title: 'Arcada Inferior Apenas', desc: 'Movimentação exclusiva dos dentes inferiores' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={formReadOnly}
              onClick={() => handleFieldChange(setTreatedArches, item.value)}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: treatedArches === item.value ? '2px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
                background: treatedArches === item.value ? 'var(--badge-setup-bg)' : 'var(--btn-ghost-bg)',
                textAlign: 'left',
                cursor: formReadOnly ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <p style={{ fontWeight: 600, fontSize: '0.92rem', color: treatedArches === item.value ? 'var(--cyan-primary)' : 'var(--text-main)', marginBottom: '4px' }}>
                {item.title}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 2. QUEIXA PRINCIPAL & OBJETIVOS DO TRATAMENTO (F3.03) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '8px' }}>
          2. Queixa Principal do Paciente & Objetivos Clínicos
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Selecione os objetivos rápidos ou descreva detalhadamente a solicitação:
        </p>

        {/* Chips de Seleção Rápida */}
        {!formReadOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            {quickComplaints.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleQuickComplaintClick(c)}
                style={{
                  background: 'var(--btn-ghost-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                + {c}
              </button>
            ))}
          </div>
        )}

        <textarea
          className="form-input"
          rows={3}
          disabled={formReadOnly}
          value={chiefComplaint}
          onChange={(e) => handleFieldChange(setChiefComplaint, e.target.value)}
          placeholder="Descreva as queixas e expectativas específicas do paciente..."
          style={{ minHeight: '80px' }}
        />
      </div>

      {/* 3. PARÂMETROS OCLUSAIS: ANGLE & LINHA MÉDIA (F3.04, F3.05) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
          3. Diagnóstico e Relação Sagital / Linha Média
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '8px' }}>
              Classificação de Angle
            </label>
            <select
              className="form-input"
              disabled={formReadOnly}
              value={angleClass}
              onChange={(e) => handleFieldChange(setAngleClass, e.target.value)}
            >
              <option value="Classe I">Classe I (Normoclusão com apinhamento/diastemas)</option>
              <option value="Classe II Div 1">Classe II Divisão 1 (Sobressaliência aumentada)</option>
              <option value="Classe II Div 2">Classe II Divisão 2 (Retroinclinação incisivos superiores)</option>
              <option value="Classe III">Classe III (Mordida cruzada / prognatismo mandibular)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '8px' }}>
              Diretriz da Linha Média Dental
            </label>
            <select
              className="form-input"
              disabled={formReadOnly}
              value={midlinePreference}
              onChange={(e) => handleFieldChange(setMidlinePreference, e.target.value)}
            >
              <option value="Coincidir com a linha média facial">Coincidir com a linha média facial</option>
              <option value="Manter linha média atual">Manter linha média atual (priorizar simetria de arcos)</option>
              <option value="Desviar superior 1.0mm para direita">Desviar superior 1.0mm para a direita</option>
              <option value="Desviar superior 1.0mm para esquerda">Desviar superior 1.0mm para a esquerda</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. ODONTOGRAMA INTERATIVO (FDI 11 a 48) (F3.08, F3.09) */}
      <div>
        <OdontogramFDI
          restrictedTeeth={restrictedTeeth}
          extractedTeeth={extractedTeeth}
          readOnly={formReadOnly}
          onChange={(restr, extr) => {
            setRestrictedTeeth(restr);
            setExtractedTeeth(extr);
            triggerAutoSave();
          }}
        />
      </div>

      {/* 5. PREFERÊNCIAS DE IPR & ATTACHMENTS (F3.06, F3.07) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* IPR (Desgaste Interproximal) */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>
            5.1 Diretrizes de IPR (Desgaste Interproximal)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                disabled={formReadOnly}
                checked={iprAllowed}
                onChange={(e) => handleFieldChange(setIprAllowed, e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
              />
              <span>Autorizar desgastes interproximais para ganho de espaço</span>
            </label>

            {iprAllowed && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Limite Máximo por Contato Interproximal:
                </label>
                <select
                  className="form-input"
                  disabled={formReadOnly}
                  value={iprMaxMm}
                  onChange={(e) => handleFieldChange(setIprMaxMm, parseFloat(e.target.value))}
                >
                  <option value={0.2} style={{ background: '#0a172a' }}>Até 0.2 mm por contato (Super conservador)</option>
                  <option value={0.3} style={{ background: '#0a172a' }}>Até 0.3 mm por contato (Padrão ouro ortodôntico)</option>
                  <option value={0.5} style={{ background: '#0a172a' }}>Até 0.5 mm por contato (Máximo moderado)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Attachments (Acessórios de Resina) */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>
            5.2 Diretrizes de Attachments (Casulos)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                disabled={formReadOnly}
                checked={attachmentAllowed}
                onChange={(e) => handleFieldChange(setAttachmentAllowed, e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)' }}
              />
              <span>Permitir colocação de attachments para biomecânica otimizada</span>
            </label>

            {attachmentAllowed && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  disabled={formReadOnly}
                  checked={avoidAnteriorAttachments}
                  onChange={(e) => handleFieldChange(setAvoidAnteriorAttachments, e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--cyan-primary)' }}
                />
                <span>Evitar attachments nos dentes anteriores por estética (13 a 23 / 33 a 43)</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* 6. INSTRUÇÕES ESPECIAIS AO PLANEJADOR CAD (F3.10) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '8px' }}>
          6. Instruções Especiais ao Planejador Ortodôntico (FyAlign Lab)
        </h4>
        <textarea
          className="form-input"
          rows={3}
          disabled={formReadOnly}
          value={doctorNotes}
          onChange={(e) => handleFieldChange(setDoctorNotes, e.target.value)}
          placeholder="Ex: Não sobrecorrigir torque dos incisivos; manter distalização limitada a 2mm; paciente possui bruxismo severo..."
        />
      </div>

      {/* MODAL DE ASSINATURA ELETRÔNICA & SUBMISSÃO (F3.11, F3.12, F3.13) */}
      {submitModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '32px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSignature size={24} color="var(--cyan-primary)" />
                <h3 style={{ fontSize: '1.3rem' }}>Assinatura Digital & Envio do Caso</h3>
              </div>
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {submitError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--crimson-danger)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '20px'
              }}>
                {submitError}
              </div>
            )}

            {/* Informações do Profissional Responsável (F3.12) */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cirurgião-Dentista Solicitante:</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{userName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registro Profissional (CRO):</span>
                <span style={{ fontSize: '0.88rem', fontFamily: 'monospace', color: 'var(--cyan-primary)', fontWeight: 700 }}>
                  {userCro || 'CRO-SP 102938'}
                </span>
              </div>
            </div>

            {/* Declarações Mandatórias (F3.11, RN-05) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tcleConfirmed}
                  onChange={(e) => setTcleConfirmed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)', marginTop: '2px' }}
                />
                <span>
                  <strong>Declaração de Consentimento (TCLE / LGPD):</strong> Declaro que o paciente ou responsável legal assinou o Termo de Consentimento Livre e Esclarecido específico para o tratamento com alinhadores e autorizou a transmissão de sua documentação clínica.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={profDeclaration}
                  onChange={(e) => setProfDeclaration(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-primary)', marginTop: '2px' }}
                />
                <span>
                  <strong>Responsabilidade Técnica:</strong> Como Cirurgião-Dentista legalmente habilitado, assumo a responsabilidade clínica integral pela prescrição solicitada e pela futura aprovação do Setup Virtual.
                </span>
              </label>
            </div>

            {/* Ações do Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="btn-secondary"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFormalSubmit}
                disabled={!tcleConfirmed || !profDeclaration || submitting}
                className="btn-primary"
                style={{
                  opacity: (!tcleConfirmed || !profDeclaration || submitting) ? 0.6 : 1,
                  padding: '12px 24px'
                }}
              >
                {submitting ? 'Emitindo Assinatura...' : (
                  <>
                    <Send size={16} />
                    <span>Confirmar Assinatura & Enviar Caso</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

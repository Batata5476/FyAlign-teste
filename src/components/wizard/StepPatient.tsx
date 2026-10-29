'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  User,
  AlertCircle,
  Search,
  CheckCircle2,
  Building2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { PatientFormData } from './types';

interface PatientOption {
  id: string;
  fullName: string;
  birthDate: string;
  gender: string;
  phone: string;
  email?: string | null;
  clinic?: {
    id: string;
    tradeName: string;
  };
}

interface StepPatientProps {
  patientData: PatientFormData;
  clinicName?: string;
  onChange: (data: PatientFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPatient({
  patientData,
  clinicName = 'Clínica OdontoPrime Ortodontia',
  onChange,
  onNext,
  onBack,
}: StepPatientProps) {
  // Modo ativo: 'SELECT' (Opção A) ou 'CREATE' (Opção B)
  const [mode, setMode] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulário de novo paciente
  const [newPatient, setNewPatient] = useState({
    fullName: '',
    birthDate: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER' | '',
    phone: '',
    email: '',
  });

  // Busca pacientes no backend (estritamente restritos à clínica autenticada)
  const fetchPatients = useCallback(async (query: string = '') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = query.trim()
        ? `/api/patients?search=${encodeURIComponent(query.trim())}`
        : '/api/patients';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Erro ao carregar lista de pacientes da clínica.');
      }
    } catch {
      setErrorMsg('Falha de conexão ao buscar pacientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchPatients('');
  }, [fetchPatients]);

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchPatients]);

  // Formata código amigável do paciente (ex: PAC-00042)
  const formatPatientCode = (id?: string) => {
    if (!id) return 'PAC-NOVO';
    const clean = id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
    return `PAC-${clean}`;
  };

  // Formata data ISO para DD/MM/AAAA
  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return dateStr;
    }
  };

  // Ação: Selecionar paciente existente
  const handleSelectPatient = (p: PatientOption) => {
    setErrorMsg(null);
    const code = formatPatientCode(p.id);
    const effectiveClinic = p.clinic?.tradeName || clinicName;

    onChange({
      id: p.id,
      isNew: false,
      fullName: p.fullName,
      birthDate: p.birthDate ? p.birthDate.split('T')[0] : '',
      gender: (p.gender as any) || '',
      phone: p.phone || '',
      email: p.email || '',
      patientCode: code,
      clinicName: effectiveClinic,
    });
  };

  // Ação: Trocar paciente (limpar seleção atual)
  const handleClearSelection = () => {
    onChange({
      id: undefined,
      isNew: false,
      fullName: '',
      birthDate: '',
      gender: '',
      phone: '',
      email: '',
      patientCode: undefined,
      clinicName: undefined,
    });
    setMode('SELECT');
  };

  // Ação: Cadastrar novo paciente e selecionar
  const handleCreateNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validações locais conforme Zod
    if (!newPatient.fullName || newPatient.fullName.trim().length < 3) {
      setErrorMsg('O nome completo do paciente deve ter ao menos 3 caracteres.');
      return;
    }
    if (!newPatient.birthDate) {
      setErrorMsg('Informe a data de nascimento do paciente.');
      return;
    }
    if (!newPatient.gender) {
      setErrorMsg('Selecione o sexo do paciente.');
      return;
    }
    if (!newPatient.phone || newPatient.phone.trim().length < 8) {
      setErrorMsg('Informe um telefone de contato válido com DDD.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newPatient.fullName.trim(),
          birthDate: newPatient.birthDate,
          gender: newPatient.gender,
          phone: newPatient.phone.trim(),
          email: newPatient.email.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cadastrar paciente.');
      }

      const created = data.patient;
      const code = formatPatientCode(created.id);

      // Atualiza estado do wizard diretamente com o paciente criado
      onChange({
        id: created.id,
        isNew: false,
        fullName: created.fullName,
        birthDate: created.birthDate ? created.birthDate.split('T')[0] : newPatient.birthDate,
        gender: created.gender as any,
        phone: created.phone,
        email: created.email || '',
        patientCode: code,
        clinicName,
      });

      // Recarrega lista para mantê-la sincronizada
      await fetchPatients('');
      setMode('SELECT');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao cadastrar paciente.');
    } finally {
      setCreating(false);
    }
  };

  const isPatientSelected = Boolean(patientData.id && patientData.fullName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabeçalho Canônico da Etapa 2 */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
          Etapa 2 — Identificação do Paciente
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Selecione um paciente já cadastrado ou cadastre um novo paciente para este caso clínico.
        </p>
      </div>

      {/* Alerta de Erro */}
      {errorMsg && (
        <div
          style={{
            background: 'var(--badge-danger-bg)',
            border: '1px solid var(--badge-danger-border)',
            color: 'var(--badge-danger-text)',
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CASO: PACIENTE SELECIONADO */}
      {isPatientSelected ? (
        <div
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 210, 211, 0.08) 0%, rgba(14, 165, 233, 0.04) 100%)',
            border: '1.5px solid var(--cyan-primary)',
            boxShadow: '0 4px 20px rgba(0, 210, 211, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--cyan-primary), #0284c7)',
                  color: '#05101f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.3rem',
                  boxShadow: '0 2px 10px rgba(0, 210, 211, 0.3)',
                }}
              >
                {patientData.fullName.charAt(0).toUpperCase()}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <CheckCircle2 size={12} />
                    ✓ Paciente Selecionado
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text-dim)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {patientData.patientCode || formatPatientCode(patientData.id)}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                  {patientData.fullName}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={14} color="var(--cyan-primary)" />
                    {formatDateBR(patientData.birthDate)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Building2 size={14} color="var(--cyan-primary)" />
                    {patientData.clinicName || clinicName}
                  </span>
                  {patientData.phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Phone size={14} color="var(--text-dim)" />
                      {patientData.phone}
                    </span>
                  )}
                  {patientData.email && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Mail size={14} color="var(--text-dim)" />
                      {patientData.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              className="btn-secondary"
              style={{
                fontSize: '0.82rem',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Trocar Paciente
            </button>
          </div>
        </div>
      ) : (
        /* CASO: SELEÇÃO OU CADASTRO DE PACIENTE */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Seletor de Modo: Opção A vs Opção B */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setMode('SELECT');
                setErrorMsg(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: mode === 'SELECT' ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                background: mode === 'SELECT' ? 'var(--badge-setup-bg)' : 'var(--bg-card)',
                color: mode === 'SELECT' ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={16} />
              <span>Opção A — Paciente Existente</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('CREATE');
                setErrorMsg(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: mode === 'CREATE' ? '1.5px solid var(--cyan-primary)' : '1px solid var(--border-card)',
                background: mode === 'CREATE' ? 'var(--badge-setup-bg)' : 'var(--bg-card)',
                color: mode === 'CREATE' ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <UserPlus size={16} />
              <span>Opção B — + Cadastrar Novo Paciente</span>
            </button>
          </div>

          {/* OPÇÃO A: BUSCA E LISTAGEM DE PACIENTES */}
          {mode === 'SELECT' && (
            <div
              style={{
                padding: '24px',
                borderRadius: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {/* Barra de Busca com Placeholder Específico */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={18}
                  color="var(--text-dim)"
                  style={{ position: 'absolute', left: '14px', top: '13px' }}
                />
                <input
                  type="text"
                  placeholder="🔎 Buscar paciente por nome, código ou e-mail"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '8px',
                    color: 'var(--input-text)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                {loading && (
                  <div style={{ position: 'absolute', right: '14px', top: '13px' }}>
                    <Loader2 size={18} className="animate-spin" color="var(--cyan-primary)" />
                  </div>
                )}
              </div>

              {/* Lista / Cards de Pacientes */}
              {loading && patients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} color="var(--cyan-primary)" />
                  <p style={{ fontSize: '0.88rem' }}>Consultando pacientes da sua clínica...</p>
                </div>
              ) : patients.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '8px',
                    background: 'var(--btn-ghost-bg)',
                  }}
                >
                  <Users size={32} color="var(--text-dim)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    {searchTerm ? 'Nenhum paciente encontrado para esta busca.' : 'Nenhum paciente cadastrado nesta clínica.'}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Cadastre um novo paciente para iniciar o planejamento ortodôntico deste caso.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode('CREATE')}
                    className="btn-primary"
                    style={{ fontSize: '0.85rem', padding: '9px 18px' }}
                  >
                    <UserPlus size={15} />
                    <span>Cadastrar Novo Paciente</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '14px',
                    maxHeight: '380px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {patients.map((p) => {
                    const code = formatPatientCode(p.id);
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: '16px 18px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-card)',
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'var(--cyan-primary)',
                                background: 'rgba(0, 210, 211, 0.12)',
                                border: '1px solid rgba(0, 210, 211, 0.25)',
                                padding: '2px 7px',
                                borderRadius: '10px',
                              }}
                            >
                              Código: {code}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              Nascimento: {formatDateBR(p.birthDate)}
                            </span>
                          </div>

                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                            {p.fullName}
                          </h4>

                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {p.phone && <span>Tel: {p.phone}</span>}
                            {p.email && <span>E-mail: {p.email}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          style={{
                            width: '100%',
                            padding: '9px 14px',
                            background: 'rgba(0, 210, 211, 0.12)',
                            border: '1px solid var(--cyan-primary)',
                            borderRadius: '8px',
                            color: 'var(--cyan-primary)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--cyan-primary)';
                            e.currentTarget.style.color = '#05101f';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 210, 211, 0.12)';
                            e.currentTarget.style.color = 'var(--cyan-primary)';
                          }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Selecionar</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* OPÇÃO B: FORMULÁRIO DE CADASTRO DE NOVO PACIENTE */}
          {mode === 'CREATE' && (
            <form
              onSubmit={handleCreateNewPatient}
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
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '4px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 2px 0' }}>
                    Cadastrar Novo Paciente
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    O paciente será vinculado automaticamente à clínica autenticada ({clinicName}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('SELECT')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cyan-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Voltar para Busca
                </button>
              </div>

              {/* Nome Completo */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Nome Completo *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do paciente"
                    value={newPatient.fullName}
                    onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 38px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '8px',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Data de Nascimento */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Data de Nascimento *
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="date"
                    required
                    value={newPatient.birthDate}
                    onChange={(e) => setNewPatient({ ...newPatient, birthDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 38px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '8px',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Sexo Biológico */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Sexo *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { val: 'MALE', label: 'Masc.' },
                    { val: 'FEMALE', label: 'Fem.' },
                    { val: 'OTHER', label: 'Outro' },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setNewPatient({ ...newPatient, gender: s.val as any })}
                      style={{
                        padding: '11px 8px',
                        background: newPatient.gender === s.val ? 'var(--badge-setup-bg)' : 'var(--input-bg)',
                        border: newPatient.gender === s.val ? '1.5px solid var(--cyan-primary)' : '1px solid var(--input-border)',
                        borderRadius: '8px',
                        color: newPatient.gender === s.val ? 'var(--cyan-primary)' : 'var(--text-main)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.86rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Telefone (WhatsApp) *
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    required
                    placeholder="(XX) XXXXX-XXXX"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 38px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '8px',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  E-mail (Opcional)
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="email"
                    placeholder="paciente@exemplo.com"
                    value={newPatient.email}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 38px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '8px',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Botão de Envio do Formulário */}
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                  style={{
                    padding: '12px 24px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                  }}
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Cadastrar e Continuar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Ações de Navegação do Wizard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 22px',
            borderRadius: '8px',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Voltar</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {!isPatientSelected && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              Selecione ou cadastre um paciente para avançar
            </span>
          )}

          <button
            type="button"
            disabled={!isPatientSelected}
            onClick={onNext}
            className="btn-glow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '8px',
              background: isPatientSelected
                ? 'linear-gradient(135deg, #0284c7 0%, #009b9c 100%)'
                : 'var(--btn-ghost-bg)',
              color: isPatientSelected ? '#ffffff' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '0.95rem',
              border: isPatientSelected ? 'none' : '1px solid var(--border-subtle)',
              cursor: isPatientSelected ? 'pointer' : 'not-allowed',
              opacity: isPatientSelected ? 1 : 0.6,
              boxShadow: isPatientSelected ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Avançar para Condição Clínica</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


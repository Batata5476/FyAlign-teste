'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Search, FolderPlus, ArrowUpRight, Link2, Check, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

export default function PatientsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal Novo Paciente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('Feminino');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tcleSigned, setTcleSigned] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPatients = async () => {
    try {
      const res = await fetch('/api/patients');
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          birthDate,
          gender,
          phone,
          email,
          tcleSigned,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cadastrar paciente');
      }

      setIsModalOpen(false);
      setFullName('');
      setBirthDate('');
      setPhone('');
      setEmail('');
      fetchPatients();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar');
    } finally {
      setCreating(false);
    }
  };

  const filteredPatients = patients.filter((p) =>
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, marginBottom: '6px' }}>
            Gestão de Pacientes da Clínica
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Prontuários cadastrados e histórico de tratamentos ortodônticos vinculados.
          </p>
        </div>

        {can('PATIENT_CREATE') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
            style={{ padding: '12px 20px' }}
          >
            <UserPlus size={18} />
            <span>+ Cadastrar Paciente</span>
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              className="form-input"
              style={{ paddingLeft: '36px', height: '40px', fontSize: '0.85rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Total: <strong>{filteredPatients.length}</strong> pacientes
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Carregando pacientes...
          </div>
        ) : filteredPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Nenhum paciente cadastrado.</p>
            {can('PATIENT_CREATE') && (
              <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                Cadastrar Primeiro Paciente
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nome Completo</th>
                  <th>Vínculo Clínica (ERP)</th>
                  <th>Nascimento</th>
                  <th>Contato</th>
                  <th>TCLE Consentimento</th>
                  <th>Tratamentos</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => {
                  const erpLink = (p.externalLinks || []).find((l: any) =>
                    ['CLINICORP', 'SIMPLES_DENTAL', 'DENTAL_OFFICE', 'OTHER'].includes(l.provider)
                  );
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/patients/${p.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{p.fullName}</strong>
                        {p.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.email}</div>}
                      </td>
                      <td>
                        {erpLink ? (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              background: 'rgba(59, 130, 246, 0.14)',
                              color: '#93c5fd',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <Link2 size={11} />
                            {erpLink.provider} #{erpLink.externalId}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>Não vinculado</span>
                        )}
                      </td>
                      <td>{new Date(p.birthDate).toLocaleDateString('pt-BR')}</td>
                      <td>{p.phone}</td>
                      <td>
                        {p.tcleSigned ? (
                          <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                            <Check size={11} /> Assinado
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--amber-warning)' }}>
                            Pendente
                          </span>
                        )}
                      </td>
                      <td>
                        {p.cases?.length > 0 ? (
                          <span style={{ color: 'var(--cyan-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            {p.cases.length} tratamento(s)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Sem tratamentos</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => router.push(`/dashboard/patients/${p.id}`)}
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                          >
                            <span>Ficha 360°</span>
                            <ArrowUpRight size={13} />
                          </button>
                          {can('CASE_CREATE') && (
                            <button
                              onClick={() => router.push(`/dashboard/cases/new?patientId=${p.id}`)}
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                              title="Iniciar Pedido Inicial para este paciente"
                            >
                              <FolderPlus size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro de Paciente */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '560px', padding: '32px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={22} color="var(--cyan-primary)" />
                <h3 style={{ fontSize: '1.25rem' }}>Cadastrar Novo Paciente</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--crimson-danger)', padding: '10px 14px', borderRadius: '6px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '18px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreatePatient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  Nome Completo do Paciente *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Ex: Ana Clara Martins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    Data de Nascimento *
                  </label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    Gênero *
                  </label>
                  <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="Feminino" style={{ background: '#0a172a' }}>Feminino</option>
                    <option value="Masculino" style={{ background: '#0a172a' }}>Masculino</option>
                    <option value="Outro" style={{ background: '#0a172a' }}>Outro</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    Telefone Celular / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    placeholder="(11) 98765-4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    E-mail do Paciente
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="paciente@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', marginTop: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tcleSigned}
                  onChange={(e) => setTcleSigned(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--cyan-primary)' }}
                />
                <span>Paciente assinou o Termo de Consentimento Livre e Esclarecido (TCLE)</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Cadastrando...' : 'Salvar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, ArrowUpRight, Search, CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';

export default function SetupsListPage() {
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch('/api/cases');
        if (res.ok) {
          const data = await res.json();
          const withSetups = (data.cases || []).filter((c: any) => c.setups && c.setups.length > 0);
          setCases(withSetups);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.caseCode?.toLowerCase().includes(q) ||
      c.patient?.fullName?.toLowerCase().includes(q) ||
      c.chiefComplaint?.toLowerCase().includes(q)
    );
  });

  const renderSetupStatusBadge = (setup: any) => {
    if (setup.status === 'APPROVED') {
      return (
        <span className="badge badge-approved" style={{ fontSize: '0.73rem' }}>
          <CheckCircle2 size={12} /> Setup v{setup.versionNumber} Aprovado
        </span>
      );
    }
    if (setup.status === 'REJECTED') {
      return (
        <span className="badge badge-danger" style={{ fontSize: '0.73rem' }}>
          <AlertCircle size={12} /> Setup v{setup.versionNumber} (Ajuste Solicitado)
        </span>
      );
    }
    return (
      <span className="badge badge-setup-ready" style={{ fontSize: '0.73rem' }}>
        <Clock size={12} /> Setup v{setup.versionNumber} Pronto p/ Análise
      </span>
    );
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, marginBottom: '6px' }}>
            Setups Virtuais 3D
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Modelos tridimensionais, estágios biomecânicos e aprovação clínica de planejamentos publicados.
          </p>
        </div>

        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar setup por paciente ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.84rem' }}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Carregando setups virtuais...
          </div>
        ) : filteredCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Box size={40} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>
              {searchTerm ? 'Nenhum setup encontrado para a busca.' : 'Nenhum setup virtual publicado no momento.'}
            </p>
          </div>
        ) : (
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {filteredCases.map((c) => {
              const setup = c.setups[0];
              return (
                <div
                  key={c.id}
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: 'var(--cyan-primary)',
                          fontSize: '0.95rem',
                        }}
                      >
                        {c.caseCode}
                      </span>
                      {renderSetupStatusBadge(setup)}
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {c.patient?.fullName}
                    </h3>
                    {c.chiefComplaint && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.chiefComplaint}</p>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      padding: '12px 14px',
                      background: 'var(--btn-ghost-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Alinhadores Planejados:</span>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <span style={{ color: 'var(--cyan-primary)' }}>{setup.upperAlignersCount}</span> Sup /{' '}
                        <span style={{ color: 'var(--blue-vibrant)' }}>{setup.lowerAlignersCount}</span> Inf
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                        className="btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                      >
                        <FileText size={14} />
                        <span>Ficha 360°</span>
                      </button>

                      <button
                        onClick={() => router.push(`/dashboard/cases/${c.id}/setup`)}
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                      >
                        <span>Visualizador 3D</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

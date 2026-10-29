'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, ArrowUpRight, Search, CheckCircle2, Clock } from 'lucide-react';

export default function SetupsListPage() {
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch('/api/cases');
        if (res.ok) {
          const data = await res.json();
          // Casos que possuem setups publicados
          const withSetups = data.cases.filter((c: any) => c.setups && c.setups.length > 0);
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, marginBottom: '6px' }}>
            Setups Virtuais 3D
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Modelos tridimensionais, estágios biomecânicos e aprovação de tratamentos dos seus pacientes.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Carregando setups virtuais...
          </div>
        ) : cases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Box size={40} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Nenhum setup virtual publicado no momento.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {cases.map((c) => {
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
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan-primary)', fontSize: '0.95rem' }}>
                        {c.caseCode}
                      </span>
                      <span className="badge badge-setup-ready" style={{ fontSize: '0.74rem' }}>
                        Setup v{setup.versionNumber} Disponível
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {c.patient?.fullName}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {c.chiefComplaint}
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'var(--btn-ghost-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Alinhadores:</span>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <span style={{ color: 'var(--cyan-primary)' }}>{setup.upperAlignersCount}</span> Sup / <span style={{ color: 'var(--blue-vibrant)' }}>{setup.lowerAlignersCount}</span> Inf
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/dashboard/cases/${c.id}/setup`)}
                      className="btn-primary"
                      style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                    >
                      <span>Abrir Visualizador 3D</span>
                      <ArrowUpRight size={14} />
                    </button>
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

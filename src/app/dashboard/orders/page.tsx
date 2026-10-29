'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  DollarSign,
  Truck,
  CheckCircle2,
  Clock,
  Download,
  Shield,
  CreditCard,
  Building2,
  Layers,
} from 'lucide-react';

interface OrderItem {
  id: string;
  orderCode: string;
  planType: string;
  amount: number;
  paymentStatus: string;
  trackingCode?: string | null;
  carrierName?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  case: {
    caseCode: string;
    patient: { fullName: string };
    doctor: { fullName: string; professionalIdCro?: string | null };
    clinic: { tradeName: string; city: string; state: string };
  };
}

export default function OrdersB2BPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [plansCatalog, setPlansCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          setPlansCatalog(data.plansCatalog || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  const totalBilled = orders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);

  const totalPending = orders
    .filter((o) => o.paymentStatus === 'PENDING')
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="var(--cyan-primary)" />
            Ordens de Produção & Faturamento B2B
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Gestão financeira de planos de alinhadores, ordens emitidas e rastreamento logístico
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/api/reports/cases-export"
            download
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
          >
            <Download size={16} />
            <span>Exportar Relatório CSV</span>
          </a>
        </div>
      </div>

      {/* Cards de Métricas Financeiras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Total de Ordens Emitidas</span>
            <Layers size={16} color="var(--cyan-primary)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px', color: '#fff' }}>
            {orders.length} OPs
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Faturamento Confirmado</span>
            <CheckCircle2 size={16} color="var(--green-emerald)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px', color: 'var(--green-emerald)' }}>
            R$ {totalBilled.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <span>Aguardando Faturamento</span>
            <Clock size={16} color="var(--amber-warning)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px', color: 'var(--amber-warning)' }}>
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Tabela de Ordens */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
          Ordens de Produção Recentes
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)' }}>
            Carregando ordens financeiras...
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Nenhuma Ordem de Produção gerada ainda. As OPs são criadas automaticamente assim que o Cirurgião-Dentista aprova o Setup Virtual 3D.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ordem (OP)</th>
                  <th>Caso Clínico</th>
                  <th>Paciente</th>
                  <th>Cirurgião (CRO)</th>
                  <th>Plano FyAlign</th>
                  <th>Valor</th>
                  <th>Status Pagamento</th>
                  <th>Rastreamento</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan-primary)' }}>
                      {ord.orderCode}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {ord.case.caseCode}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)' }}>{ord.case.patient.fullName}</strong>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {ord.case.doctor.fullName} ({ord.case.doctor.professionalIdCro || 'CRO'})
                    </td>
                    <td>
                      <span className="badge badge-setup-ready" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                        {ord.planType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      R$ {ord.amount.toFixed(2)}
                    </td>
                    <td>
                      {ord.paymentStatus === 'PAID' ? (
                        <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>
                          ● Faturado / Pago
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                          ● Pendente
                        </span>
                      )}
                    </td>
                    <td>
                      {ord.trackingCode ? (
                        <span className="badge" style={{ background: 'var(--badge-setup-bg)', color: 'var(--text-cyan)', border: '1px solid var(--badge-setup-border)', fontSize: '0.75rem', gap: '4px' }}>
                          <Truck size={12} /> {ord.carrierName || 'Correios'}: {ord.trackingCode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Aguardando produção</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Catálogo de Planos FyAlign B2B */}
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
        Tabela de Preços e Planos de Tratamento B2B
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {plansCatalog.map((plan) => (
          <div key={plan.planType} className="glass-panel" style={{ padding: '20px', borderTop: '3px solid var(--cyan-primary)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cyan-primary)', marginBottom: '4px' }}>
              {plan.name}
            </h4>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {plan.limit}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              Indicado para: {plan.target}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

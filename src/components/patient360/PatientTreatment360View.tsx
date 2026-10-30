'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  FolderPlus,
  Layers,
  Link2,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

interface PatientTreatment360ViewProps {
  mode: 'PATIENT' | 'TREATMENT';
  resourceId: string;
}

type TabKey =
  | 'SUMMARY'
  | 'SERVICE_ORDERS'
  | 'DOCUMENTATION'
  | 'SETUP_3D'
  | 'PRODUCTION_LOGISTICS'
  | 'COMMERCIAL'
  | 'TIMELINE';

function getSlaBadgeStyle(state?: string): React.CSSProperties {
  switch (state) {
    case 'COMPLETED_ON_TIME':
    case 'ON_TRACK':
      return {
        background: 'rgba(16, 185, 129, 0.14)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.35)',
      };
    case 'DUE_SOON':
      return {
        background: 'rgba(245, 158, 11, 0.16)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.4)',
      };
    case 'OVERDUE':
    case 'COMPLETED_LATE':
      return {
        background: 'rgba(239, 68, 68, 0.16)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.4)',
      };
    default:
      return {
        background: 'rgba(148, 163, 184, 0.12)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border-subtle)',
      };
  }
}

function formatOrderTypeLabel(type: string): string {
  switch (type) {
    case 'INITIAL':
      return 'Pedido Inicial';
    case 'SECOND_BATCH':
      return 'Segunda Leva';
    case 'REFINEMENT':
      return 'Refinamento';
    default:
      return type;
  }
}

function formatBrlFromCents(cents?: number | null): string {
  if (typeof cents !== 'number') return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PatientTreatment360View({ mode, resourceId }: PatientTreatment360ViewProps) {
  const router = useRouter();
  const { can, canAny } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('SUMMARY');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Modais operacionais contextualizados na Ficha 360°
  const [erpModalOpen, setErpModalOpen] = useState(false);
  const [erpProvider, setErpProvider] = useState<'CLINICORP' | 'SIMPLES_DENTAL' | 'DENTAL_OFFICE' | 'OTHER'>('CLINICORP');
  const [erpExternalId, setErpExternalId] = useState('');
  const [erpSecondaryCode, setErpSecondaryCode] = useState('');
  const [erpExternalUrl, setErpExternalUrl] = useState('');
  const [erpNextAppointment, setErpNextAppointment] = useState('');

  const [refinementModalOpen, setRefinementModalOpen] = useState(false);
  const [refinementReason, setRefinementReason] = useState('');
  const [refinementExtraPairs, setRefinementExtraPairs] = useState(0);

  const [secondBatchModalOpen, setSecondBatchModalOpen] = useState(false);
  const [batchStartPair, setBatchStartPair] = useState(13);
  const [batchEndPair, setBatchEndPair] = useState(24);
  const [batchMode, setBatchMode] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [batchNotes, setBatchNotes] = useState('');

  const [nemoModalOrder, setNemoModalOrder] = useState<any | null>(null);
  const [nemoStatusInput, setNemoStatusInput] = useState<'PENDING' | 'INSERTED' | 'ERROR'>('INSERTED');
  const [nemoCaseIdInput, setNemoCaseIdInput] = useState('');
  const [nemoNotesInput, setNemoNotesInput] = useState('');

  const [commModalOrder, setCommModalOrder] = useState<any | null>(null);
  const [commEventType, setCommEventType] = useState<
    'SETUP_SENT' | 'BUDGET_SENT' | 'CLIENT_APPROVAL_RECORDED' | 'SHIPMENT_NOTIFIED' | 'COMMERCIAL_NOTE'
  >('SETUP_SENT');
  const [commChannel, setCommChannel] = useState<'WHATSAPP' | 'PORTAL' | 'PHONE' | 'EMAIL'>('WHATSAPP');
  const [commSummary, setCommSummary] = useState('Setup enviado via WhatsApp para aprovação do doutor');
  const [commDetails, setCommDetails] = useState('');

  const [docsIssueModalOrder, setDocsIssueModalOrder] = useState<any | null>(null);
  const [docsIssueReason, setDocsIssueReason] = useState('');

  const [submittingAction, setSubmittingAction] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        mode === 'PATIENT'
          ? `/api/patients/${resourceId}/overview-360`
          : `/api/cases/${resourceId}/overview-360`;
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Não foi possível carregar a Ficha 360°.');
      }
      setData(body);
      if (body.treatments?.length > 0) {
        setSelectedTreatmentId((prev) =>
          prev && body.treatments.some((t: any) => t.id === prev)
            ? prev
            : body.treatments[0].id
        );
      }
    } catch (e: any) {
      setError(e.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [mode, resourceId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const activeTreatment = useMemo(() => {
    if (!data?.treatments?.length) return null;
    return (
      data.treatments.find((t: any) => t.id === selectedTreatmentId) || data.treatments[0]
    );
  }, [data, selectedTreatmentId]);

  const patientErpLink = useMemo(() => {
    const links = data?.patient?.externalLinks || [];
    return (
      links.find((l: any) =>
        ['CLINICORP', 'SIMPLES_DENTAL', 'DENTAL_OFFICE', 'OTHER'].includes(l.provider)
      ) || null
    );
  }, [data]);

  const openErpModal = () => {
    if (patientErpLink) {
      setErpProvider(patientErpLink.provider || 'CLINICORP');
      setErpExternalId(patientErpLink.externalId || '');
      setErpSecondaryCode(patientErpLink.secondaryCode || '');
      setErpExternalUrl(patientErpLink.externalUrl || '');
      try {
        const meta = patientErpLink.metadataJson ? JSON.parse(patientErpLink.metadataJson) : {};
        setErpNextAppointment(meta.nextAppointmentDate || '');
      } catch {
        setErpNextAppointment('');
      }
    } else {
      setErpExternalId('');
      setErpSecondaryCode('');
      setErpExternalUrl('');
      setErpNextAppointment('');
    }
    setErpModalOpen(true);
  };

  const openSecondBatchModal = () => {
    if (activeTreatment?.secondBatchRadar) {
      setBatchStartPair(activeTreatment.secondBatchRadar.nextRangeStart || 13);
      setBatchEndPair(activeTreatment.secondBatchRadar.nextRangeEnd || 24);
    } else {
      setBatchStartPair(13);
      setBatchEndPair(24);
    }
    setBatchNotes('');
    setSecondBatchModalOpen(true);
  };

  const handleSaveErpLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.patient?.id) return;
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/external-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'PATIENT',
          provider: erpProvider,
          patientId: data.patient.id,
          externalId: erpExternalId,
          secondaryCode: erpSecondaryCode || null,
          externalUrl: erpExternalUrl || null,
          metadata: erpNextAppointment ? { nextAppointmentDate: erpNextAppointment } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao vincular prontuário');
      setErpModalOpen(false);
      setFeedbackBanner('Prontuário externo da clínica vinculado com sucesso.');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreateRefinement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/cases/${activeTreatment.id}/service-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'REFINEMENT',
          clinicalReason: refinementReason,
          extraAlignersCount: Number(refinementExtraPairs) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao solicitar refinamento');
      setRefinementModalOpen(false);
      setRefinementReason('');
      setRefinementExtraPairs(0);
      setFeedbackBanner(json.message || 'OS de Refinamento aberta com sucesso.');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreateSecondBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/cases/${activeTreatment.id}/service-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SECOND_BATCH',
          alignerRangeStart: Number(batchStartPair),
          alignerRangeEnd: Number(batchEndPair),
          mode: batchMode,
          notes: batchNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao solicitar Segunda Leva');
      setSecondBatchModalOpen(false);
      setFeedbackBanner(json.message || 'Segunda Leva registrada com sucesso.');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const executeOrderPatch = async (orderId: string, payload: Record<string, any>, successMsg: string) => {
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/cases/${activeTreatment.id}/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao executar ação operacional');
      setFeedbackBanner(successMsg);
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveNemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nemoModalOrder) return;
    await executeOrderPatch(
      nemoModalOrder.id,
      {
        action: 'UPDATE_NEMO',
        nemoStatus: nemoStatusInput,
        nemoCaseId: nemoCaseIdInput || null,
        nemoNotes: nemoNotesInput || null,
      },
      'Status de inserção CAD no Nemo atualizado.'
    );
    setNemoModalOrder(null);
  };

  const handleSaveCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commModalOrder) return;
    await executeOrderPatch(
      commModalOrder.id,
      {
        action: 'RECORD_COMMUNICATION',
        eventType: commEventType,
        channel: commChannel,
        summary: commSummary,
        details: commDetails || null,
      },
      'Marco de comunicação operacional registrado na linha do tempo.'
    );
    setCommModalOrder(null);
  };

  const handleSaveDocsIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docsIssueModalOrder) return;
    await executeOrderPatch(
      docsIssueModalOrder.id,
      {
        action: 'REPORT_DOCS_PENDING',
        reason: docsIssueReason,
      },
      'Pendência documental registrada.'
    );
    setDocsIssueModalOrder(null);
    setDocsIssueReason('');
  };

  // Abas dinâmicas governadas exclusivamente por user.permissions
  const availableTabs = useMemo(() => {
    const tabs: { key: TabKey; label: string; icon: any }[] = [
      { key: 'SUMMARY', label: 'Resumo 360°', icon: Sparkles },
    ];
    if (can('CASE_READ')) {
      tabs.push({ key: 'SERVICE_ORDERS', label: 'Solicitações (OS)', icon: Layers });
    }
    if (canAny(['FILE_READ', 'CASE_UPDATE'])) {
      tabs.push({ key: 'DOCUMENTATION', label: 'Documentação & Prescrição', icon: FileCheck });
    }
    if (can('SETUP_READ')) {
      tabs.push({ key: 'SETUP_3D', label: 'Planejamento 3D', icon: Box });
    }
    if (canAny(['PRODUCTION_UNIT_READ', 'SHIPMENT_READ', 'NEMO_MANAGE'])) {
      tabs.push({ key: 'PRODUCTION_LOGISTICS', label: 'Produção, Nemo & Envios', icon: Truck });
    }
    if (can('CONTRACT_READ')) {
      tabs.push({ key: 'COMMERCIAL', label: 'Plano & Contrato', icon: FileText });
    }
    tabs.push({ key: 'TIMELINE', label: 'Histórico & WhatsApp', icon: MessageSquare });
    return tabs;
  }, [can, canAny]);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Carregando Ficha 360° unificada...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: '#f87171', marginBottom: '16px' }}>{error || 'Registro não encontrado.'}</p>
        <button onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>
    );
  }

  const patient = data.patient;
  const latestOrder =
    activeTreatment?.serviceOrders?.[activeTreatment.serviceOrders.length - 1] || null;
  const latestShipment = activeTreatment?.shipments?.[0] || null;
  const latestWhatsappEvent = (activeTreatment?.operationalEvents || []).find(
    (ev: any) => ev.channel === 'WHATSAPP'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Navegação Superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={() => router.push(can('PATIENT_READ') ? '/dashboard/patients' : '/dashboard')}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.84rem' }}
        >
          <ArrowLeft size={15} />
          <span>{can('PATIENT_READ') ? 'Voltar para Pacientes' : 'Voltar ao Painel'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {mode === 'TREATMENT' && can('PATIENT_READ') && patient?.id && (
            <button
              onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.84rem' }}
            >
              <User size={15} />
              <span>Ficha Completa do Paciente</span>
            </button>
          )}
          <button
            onClick={loadOverview}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem' }}
            title="Atualizar dados"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#6ee7b7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
          }}
        >
          <span>{feedbackBanner}</span>
          <button
            onClick={() => setFeedbackBanner(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CABEÇALHO 360° DO PACIENTE + INTEGRAÇÃO PRONTUÁRIO CLÍNICA (B-INT01)  */}
      {/* ==================================================================== */}
      <div className="glass-panel" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: 'rgba(0, 210, 211, 0.14)',
                  color: 'var(--cyan-primary)',
                  letterSpacing: '0.04em',
                }}
              >
                {patient.patientCode}
              </span>
              {patient.clinic?.tradeName && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  • {patient.clinic.tradeName}
                </span>
              )}
              {patientErpLink && (
                <span
                  style={{
                    fontSize: '0.76rem',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: '#93c5fd',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Link2 size={12} />
                  {patientErpLink.provider}: #{patientErpLink.externalId}
                  {patientErpLink.secondaryCode ? ` (Pront. ${patientErpLink.secondaryCode})` : ''}
                  {patientErpLink.externalUrl && (
                    <a
                      href={patientErpLink.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#bfdbfe', display: 'inline-flex' }}
                      title="Abrir prontuário externo"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>
              {patient.fullName}
            </h1>

            {patient.piiMinimized ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Visão técnica/operacional com minimização de dados pessoais (LGPD).
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                <span>Gênero: <strong style={{ color: 'var(--text-main)' }}>{patient.gender}</strong></span>
                {patient.birthDate && (
                  <span>
                    Nascimento:{' '}
                    <strong style={{ color: 'var(--text-main)' }}>
                      {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
                    </strong>
                  </span>
                )}
                {patient.phone && (
                  <span>WhatsApp/Tel: <strong style={{ color: 'var(--text-main)' }}>{patient.phone}</strong></span>
                )}
                {patient.email && (
                  <span>E-mail: <strong style={{ color: 'var(--text-main)' }}>{patient.email}</strong></span>
                )}
                <span>
                  TCLE:{' '}
                  <strong style={{ color: patient.tcleSigned ? '#34d399' : '#fbbf24' }}>
                    {patient.tcleSigned ? 'Assinado' : 'Pendente'}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {can('PATIENT_UPDATE') && !patient.piiMinimized && (
              <button
                onClick={openErpModal}
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '9px 14px' }}
              >
                <Link2 size={15} />
                <span>{patientErpLink ? 'Editar Vínculo Clínica' : 'Vincular Prontuário (ERP)'}</span>
              </button>
            )}
            {data.capabilities?.canCreateCase && (
              <button
                onClick={() => router.push(`/dashboard/cases/new?patientId=${patient.id}`)}
                className="btn-primary"
                style={{ fontSize: '0.84rem', padding: '9px 16px' }}
              >
                <FolderPlus size={16} />
                <span>+ Novo Tratamento (Pedido Inicial)</span>
              </button>
            )}
          </div>
        </div>

        {/* Seletor de Tratamentos do Paciente */}
        {data.treatments?.length > 0 && (
          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                TRATAMENTOS VINCULADOS:
              </span>
              {data.treatments.map((trt: any) => {
                const isSelected = trt.id === activeTreatment?.id;
                return (
                  <button
                    key={trt.id}
                    onClick={() => setSelectedTreatmentId(trt.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid var(--cyan-primary)'
                        : '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(0, 210, 211, 0.14)' : 'rgba(255,255,255,0.02)',
                      color: isSelected ? 'var(--cyan-primary)' : 'var(--text-main)',
                    }}
                  >
                    Tratamento #{trt.caseCode} • {trt.status}
                  </button>
                );
              })}
            </div>

            {activeTreatment && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.capabilities?.canTriggerSecondBatch && (
                  <button
                    onClick={openSecondBatchModal}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                  >
                    <Package size={14} />
                    <span>+ Segunda Leva</span>
                  </button>
                )}
                {can('REFINEMENT_REQUEST') && (
                  <button
                    onClick={() => setRefinementModalOpen(true)}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                  >
                    <Plus size={14} />
                    <span>+ Solicitar Refinamento</span>
                  </button>
                )}
                {can('SETUP_READ') && (
                  <button
                    onClick={() => router.push(`/dashboard/cases/${activeTreatment.id}/setup`)}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                  >
                    <Box size={14} />
                    <span>Abrir Setup 3D</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Caso Paciente ainda não possua nenhum Tratamento */}
      {!activeTreatment ? (
        <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>
            Nenhum tratamento ortodôntico iniciado para este paciente
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
            Inicie o Pedido Inicial para enviar documentação, prescrição e gerar o prazo de 3 dias úteis para o Setup.
          </p>
          {data.capabilities?.canCreateCase && (
            <button
              onClick={() => router.push(`/dashboard/cases/new?patientId=${patient.id}`)}
              className="btn-primary"
            >
              <FolderPlus size={16} /> Iniciar Pedido Inicial
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Alerta Programado da Segunda Leva (Gatilho 1 mês antes do fim da leva atual) */}
          {activeTreatment.secondBatchRadar?.eligible && (
            <div
              className="glass-panel"
              style={{
                padding: '16px 22px',
                borderLeft: '4px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Calendar size={20} color="#fbbf24" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    Cronograma da Segunda Leva: Pares {activeTreatment.secondBatchRadar.nextRangeStart}–
                    {activeTreatment.secondBatchRadar.nextRangeEnd}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Leva atual ({activeTreatment.secondBatchRadar.currentBatchRange}) com término estimado em{' '}
                    <strong>
                      {new Date(activeTreatment.secondBatchRadar.estimatedCurrentBatchEndAt).toLocaleDateString('pt-BR')}
                    </strong>{' '}
                    • Preparação programada (1 mês antes):{' '}
                    <strong style={{ color: '#fbbf24' }}>
                      {new Date(activeTreatment.secondBatchRadar.prepDueAt).toLocaleDateString('pt-BR')}
                    </strong>{' '}
                    ({activeTreatment.secondBatchRadar.sla.label})
                  </div>
                </div>
              </div>
              {data.capabilities?.canTriggerSecondBatch && (
                <button onClick={openSecondBatchModal} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                  Preparar Segunda Leva (Sem Novo Orçamento)
                </button>
              )}
            </div>
          )}

          {/* Barra de Abas Dinâmicas */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '10px',
              overflowX: 'auto',
            }}
          >
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 15px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: isActive ? '1px solid var(--cyan-primary)' : '1px solid transparent',
                    background: isActive ? 'rgba(0, 210, 211, 0.12)' : 'transparent',
                    color: isActive ? 'var(--cyan-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ================================================================ */}
          {/* ABA 1: RESUMO 360° & INTEGRAÇÕES OPERACIONAIS (B-P01 + B-INT01)  */}
          {/* ================================================================ */}
          {activeTab === 'SUMMARY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPIs Executivos do Tratamento */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    TRATAMENTO & ORTODONTISTA
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
                    #{activeTreatment.caseCode} • {activeTreatment.status}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Dr(a). {activeTreatment.doctor?.fullName || '—'} • Arcadas: {activeTreatment.treatedArches}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    PRAZO DE SETUP (REGRA 3 DIAS ÚTEIS)
                  </div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '6px' }}>
                    {latestOrder?.slas?.setup?.dueAt
                      ? `Até ${new Date(latestOrder.slas.setup.dueAt).toLocaleDateString('pt-BR')}`
                      : 'Aguardando envio da OS'}
                  </div>
                  <span
                    style={{
                      ...getSlaBadgeStyle(latestOrder?.slas?.setup?.state),
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    {latestOrder?.slas?.setup?.label || 'Pendente de submissão'}
                  </span>
                </div>

                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    PRAZO DE PRODUÇÃO (PÓS-APROVAÇÃO)
                  </div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '6px' }}>
                    {latestOrder?.slas?.production?.dueAt
                      ? `Pronto até ${new Date(latestOrder.slas.production.dueAt).toLocaleDateString('pt-BR')}`
                      : 'Aguardando aprovação'}
                  </div>
                  <span
                    style={{
                      ...getSlaBadgeStyle(latestOrder?.slas?.production?.state),
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    {latestOrder?.slas?.production?.label || 'Aguardando gatilho'}
                  </span>
                </div>

                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    DOCUMENTAÇÃO & EXAMES
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
                    {activeTreatment.documentation.uploadedCount} / {activeTreatment.documentation.totalSlots} arquivos
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Solicitações registradas: <strong>{activeTreatment.serviceOrders.length}</strong>
                  </div>
                </div>
              </div>

              {/* Painel B-INT01: Ecossistemas Operacionais Conectados */}
              <div className="glass-panel" style={{ padding: '22px 24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link2 size={18} color="var(--cyan-primary)" />
                  Ecossistemas Operacionais & Rastreabilidade Externa (B-INT01)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '16px' }}>
                  {/* 1. Nemo / NemoCast CAD */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.88rem' }}>1. Nemo / NemoCast (CAD)</strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background:
                            latestOrder?.nemo?.status === 'INSERTED'
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(245, 158, 11, 0.16)',
                          color: latestOrder?.nemo?.status === 'INSERTED' ? '#34d399' : '#fbbf24',
                        }}
                      >
                        {latestOrder?.nemo?.status || 'AGUARDANDO OS'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.81rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {latestOrder?.nemo?.nemoCaseId && (
                        <span>ID Caso Nemo: <strong style={{ color: 'var(--text-main)' }}>{latestOrder.nemo.nemoCaseId}</strong></span>
                      )}
                      {latestOrder?.nemo?.insertedBy && (
                        <span>Operador: <strong style={{ color: 'var(--text-main)' }}>{latestOrder.nemo.insertedBy.fullName}</strong></span>
                      )}
                      {latestOrder?.nemo?.insertedAt && (
                        <span>Inserido em: {new Date(latestOrder.nemo.insertedAt).toLocaleString('pt-BR')}</span>
                      )}
                      {!latestOrder?.nemo?.nemoCaseId && !latestOrder?.nemo?.insertedAt && (
                        <span>Rastreia inserção de malhas STL no Nemo antes do planejamento do Dr. Adriano.</span>
                      )}
                    </div>
                    {can('NEMO_MANAGE') && latestOrder && (
                      <button
                        onClick={() => {
                          setNemoModalOrder(latestOrder);
                          setNemoStatusInput(
                            latestOrder.nemo?.status === 'ERROR' ? 'ERROR' : 'INSERTED'
                          );
                          setNemoCaseIdInput(latestOrder.nemo?.nemoCaseId || '');
                          setNemoNotesInput(latestOrder.nemo?.notes || '');
                        }}
                        className="btn-secondary"
                        style={{ marginTop: '12px', fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        Atualizar Status Nemo
                      </button>
                    )}
                  </div>

                  {/* 2. Logística & WhatsApp Operacional */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.88rem' }}>2. Logística & WhatsApp Comercial</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--cyan-primary)', fontWeight: 600 }}>
                        {latestShipment ? latestShipment.status : 'SEM REMESSA'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.81rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {latestShipment ? (
                        <>
                          <span>
                            Transportadora: <strong style={{ color: 'var(--text-main)' }}>{latestShipment.carrierName}</strong>
                          </span>
                          <span>
                            Rastreio: <strong style={{ color: 'var(--text-main)' }}>{latestShipment.trackingCode || 'Em geração'}</strong>
                          </span>
                        </>
                      ) : (
                        <span>Nenhuma remessa expedida neste tratamento ainda.</span>
                      )}
                      {latestWhatsappEvent && (
                        <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-subtle)', color: '#93c5fd' }}>
                          WhatsApp ({new Date(latestWhatsappEvent.occurredAt).toLocaleString('pt-BR')}): {latestWhatsappEvent.summary}
                        </div>
                      )}
                    </div>
                    {can('COMMERCIAL_COMMUNICATE') && latestOrder && (
                      <button
                        onClick={() => setCommModalOrder(latestOrder)}
                        className="btn-secondary"
                        style={{ marginTop: '12px', fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        <Send size={13} /> Registrar WhatsApp / Aceite
                      </button>
                    )}
                  </div>

                  {/* 3. ERP / Prontuário da Clínica */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.88rem' }}>3. ERP / Prontuário Clínica</strong>
                      <span style={{ fontSize: '0.72rem', color: patientErpLink ? '#34d399' : 'var(--text-muted)' }}>
                        {patientErpLink ? patientErpLink.provider : 'NÃO VINCULADO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.81rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {patientErpLink ? (
                        <>
                          <span>Código Paciente: <strong style={{ color: 'var(--text-main)' }}>{patientErpLink.externalId}</strong></span>
                          {patientErpLink.secondaryCode && (
                            <span>Prontuário: <strong style={{ color: 'var(--text-main)' }}>{patientErpLink.secondaryCode}</strong></span>
                          )}
                        </>
                      ) : (
                        <span>Vínculo leve com Clinicorp / Simples Dental sem duplicar prontuário clínico.</span>
                      )}
                    </div>
                    {can('PATIENT_UPDATE') && !patient.piiMinimized && (
                      <button
                        onClick={openErpModal}
                        className="btn-secondary"
                        style={{ marginTop: '12px', fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        {patientErpLink ? 'Atualizar Vínculo' : 'Conectar Prontuário'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 2: SOLICITAÇÕES OPERACIONAIS (OS: INICIAL, 2ª LEVA, REFIN.)  */}
          {/* ================================================================ */}
          {activeTab === 'SERVICE_ORDERS' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>
                    Solicitações Operacionais do Tratamento #{activeTreatment.caseCode}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Cada ciclo (Pedido Inicial, Segunda Leva e Refinamentos) possui fluxo, conferência, Nemo e SLAs próprios.
                  </p>
                </div>
              </div>

              {activeTreatment.serviceOrders.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Este tratamento ainda está em rascunho ou é anterior à geração automática de OS. Ao submeter o caso ou criar uma Segunda Leva / Refinamento, a OS aparecerá aqui.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {activeTreatment.serviceOrders.map((so: any) => (
                    <div
                      key={so.id}
                      style={{
                        padding: '18px 20px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--cyan-primary)', fontSize: '0.85rem' }}>
                              {so.orderNumber}
                            </span>
                            <span className="badge badge-draft" style={{ fontSize: '0.72rem' }}>
                              {formatOrderTypeLabel(so.type)}
                            </span>
                            <span className="badge badge-production" style={{ fontSize: '0.72rem' }}>
                              {so.status}
                            </span>
                            {!so.requiresNewBudget && (
                              <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                                Sem Novo Orçamento
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{so.title}</div>
                          {so.notes && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Obs: {so.notes}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {so.type !== 'SECOND_BATCH' && (
                            <span
                              style={{
                                ...getSlaBadgeStyle(so.slas?.setup?.state),
                                padding: '4px 10px',
                                borderRadius: '999px',
                                fontSize: '0.74rem',
                              }}
                            >
                              Setup: {so.slas?.setup?.label}
                            </span>
                          )}
                          <span
                            style={{
                              ...getSlaBadgeStyle(so.slas?.production?.state),
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.74rem',
                            }}
                          >
                            Produção: {so.slas?.production?.label}
                          </span>
                        </div>
                      </div>

                      {so.docsVerification?.pendingReason && (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#fca5a5',
                            fontSize: '0.82rem',
                          }}
                        >
                          Pendência Documental: {so.docsVerification.pendingReason}
                        </div>
                      )}

                      {/* Ações Operacionais por Permissão Granular */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                        {can('DOC_VERIFY') && so.type !== 'SECOND_BATCH' && (
                          <>
                            <button
                              disabled={submittingAction}
                              onClick={() =>
                                executeOrderPatch(
                                  so.id,
                                  { action: 'VERIFY_DOCS' },
                                  `Documentação da ${so.orderNumber} aprovada.`
                                )
                              }
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                            >
                              <Check size={13} /> Conferência OK
                            </button>
                            <button
                              disabled={submittingAction}
                              onClick={() => setDocsIssueModalOrder(so)}
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                            >
                              <AlertTriangle size={13} /> Apontar Pendência
                            </button>
                          </>
                        )}

                        {can('NEMO_MANAGE') && so.type !== 'SECOND_BATCH' && (
                          <button
                            onClick={() => {
                              setNemoModalOrder(so);
                              setNemoStatusInput('INSERTED');
                              setNemoCaseIdInput(so.nemo?.nemoCaseId || '');
                              setNemoNotesInput(so.nemo?.notes || '');
                            }}
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                          >
                            Nemo ({so.nemo?.status})
                          </button>
                        )}

                        {can('COMMERCIAL_COMMUNICATE') && (
                          <button
                            onClick={() => setCommModalOrder(so)}
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                          >
                            <Send size={13} /> Registrar WhatsApp / Comercial
                          </button>
                        )}

                        {can('PRODUCTION_RELEASE') && so.status !== 'RELEASED_FOR_PRODUCTION' && so.status !== 'DELIVERED' && (
                          <button
                            disabled={submittingAction}
                            onClick={() =>
                              executeOrderPatch(
                                so.id,
                                { action: 'RELEASE_PRODUCTION' },
                                `Produção liberada tecnicamente para ${so.orderNumber}.`
                              )
                            }
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                          >
                            <CheckCircle2 size={13} /> Liberar Produção
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 3: DOCUMENTAÇÃO & PRESCRIÇÃO CLÍNICA                         */}
          {/* ================================================================ */}
          {activeTab === 'DOCUMENTATION' && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>
                    Acervo Diagnóstico & Prescrição Biomecânica
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {activeTreatment.documentation.uploadedCount} de {activeTreatment.documentation.totalSlots} slots clínicos preenchidos.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {can('FILE_READ') && (
                    <button
                      onClick={() => router.push(`/dashboard/cases/${activeTreatment.id}/upload`)}
                      className="btn-secondary"
                      style={{ fontSize: '0.82rem' }}
                    >
                      Gerenciar Arquivos / STLs
                    </button>
                  )}
                  {can('CASE_READ') && (
                    <button
                      onClick={() => router.push(`/dashboard/cases/${activeTreatment.id}/prescription`)}
                      className="btn-secondary"
                      style={{ fontSize: '0.82rem' }}
                    >
                      Abrir Prescrição Detalhada
                    </button>
                  )}
                </div>
              </div>

              {activeTreatment.clinical && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: '8px' }}>
                      Condição Oclusal Inicial
                    </strong>
                    {activeTreatment.clinical.clinicalCondition ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>Linha Média Sup/Inf: {activeTreatment.clinical.clinicalCondition.upperMidline} / {activeTreatment.clinical.clinicalCondition.lowerMidline}</span>
                        <span>Caninos D/E: {activeTreatment.clinical.clinicalCondition.canineRight} / {activeTreatment.clinical.clinicalCondition.canineLeft}</span>
                        <span>Molares D/E: {activeTreatment.clinical.clinicalCondition.molarRight} / {activeTreatment.clinical.clinicalCondition.molarLeft}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Não preenchida ainda.</span>
                    )}
                  </div>

                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: '8px' }}>
                      Plano de Tratamento Parametrizado
                    </strong>
                    {activeTreatment.clinical.treatmentPlan ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>IPR: {activeTreatment.clinical.treatmentPlan.ipr ? 'Autorizado' : 'Não'} • Attachments: {activeTreatment.clinical.treatmentPlan.attachment ? 'Sim' : 'Não'}</span>
                        <span>Elásticos: {activeTreatment.clinical.treatmentPlan.intermaxillaryElastic} • Diastemas: {activeTreatment.clinical.treatmentPlan.diastemas}</span>
                        {activeTreatment.clinical.treatmentPlan.additionalInstructions && (
                          <span>Instruções: {activeTreatment.clinical.treatmentPlan.additionalInstructions}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Não preenchido ainda.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 4: PLANEJAMENTO 3D                                           */}
          {/* ================================================================ */}
          {activeTab === 'SETUP_3D' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>Histórico de Setups Virtuais 3D</h3>
                <button
                  onClick={() => router.push(`/dashboard/cases/${activeTreatment.id}/setup`)}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem' }}
                >
                  <Box size={15} /> Abrir Visualizador 3D Interativo
                </button>
              </div>
              {activeTreatment.setups.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Nenhum setup publicado para este tratamento ainda.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeTreatment.setups.map((st: any) => (
                    <div
                      key={st.id}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <strong>Setup v{st.versionNumber}</strong> • Status: <span style={{ color: 'var(--cyan-primary)' }}>{st.status}</span>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Alinhadores Sup: {st.upperAlignersCount} • Inf: {st.lowerAlignersCount}
                          {st.plannerComments ? ` • Notas: ${st.plannerComments}` : ''}
                        </div>
                      </div>
                      {st.approvedAt && (
                        <span className="badge badge-approved">
                          Aprovado em {new Date(st.approvedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 5: PRODUÇÃO, LOTES & REMESSAS                                */}
          {/* ================================================================ */}
          {activeTab === 'PRODUCTION_LOGISTICS' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              <div className="glass-panel" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '14px' }}>
                  Lotes de Produção (ProductionUnit)
                </h3>
                {activeTreatment.productionUnits.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Nenhum lote fabril registrado ainda.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeTreatment.productionUnits.map((u: any) => (
                      <div key={u.id} style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.88rem' }}>
                          <span>{u.unitCode} ({u.quantityPairs} pares)</span>
                          <span style={{ color: 'var(--cyan-primary)' }}>{u.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {u.stagesDescription} • Expedidos: {u.shippedQuantity}/{u.quantityPairs}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '14px' }}>
                  Remessas & Rastreio Logístico
                </h3>
                {activeTreatment.shipments.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Nenhuma remessa expedida até o momento.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeTreatment.shipments.map((sh: any) => (
                      <div key={sh.id} style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.88rem' }}>
                          <span>{sh.shipmentCode} • {sh.carrierName}</span>
                          <span style={{ color: '#34d399' }}>{sh.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Rastreio: <strong>{sh.trackingCode || '—'}</strong>
                          {sh.shippedAt ? ` • Enviado em ${new Date(sh.shippedAt).toLocaleDateString('pt-BR')}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 6: PLANO COMERCIAL & FRANQUIA (SOMENTE CONTRACT_READ)        */}
          {/* ================================================================ */}
          {activeTab === 'COMMERCIAL' && can('CONTRACT_READ') && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 700, marginBottom: '14px' }}>
                Contrato do Tratamento & Franquia de Refinamentos
              </h3>
              {!activeTreatment.commercialContract ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Nenhum contrato comercial vinculado a este tratamento ainda.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>PACOTE CONTRATADO</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                      {activeTreatment.commercialContract.packageName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {activeTreatment.commercialContract.contractCode} • {activeTreatment.commercialContract.status}
                    </div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>PARES & VALOR ACORDADO</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                      {activeTreatment.commercialContract.contractedAligners} pares •{' '}
                      {formatBrlFromCents(activeTreatment.commercialContract.totalPriceCents)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Entrega: {activeTreatment.commercialContract.deliveryModel}
                    </div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>FRANQUIA DE REFINAMENTOS</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                      {activeTreatment.commercialContract.remainingCoveredRefinements} disponíveis de{' '}
                      {activeTreatment.commercialContract.includedRefinements}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Janela: {activeTreatment.commercialContract.refinementWindowDays} dias
                    </div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>REGRA DE SLA DO PLANO</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                      Produção: {activeTreatment.commercialContract.productionSlaDays} dias{' '}
                      {activeTreatment.commercialContract.productionSlaDayType === 'BUSINESS_DAYS'
                        ? 'úteis'
                        : 'corridos'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Setup inicial: {activeTreatment.commercialContract.setupSlaBusinessDays} dias úteis
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 7: LINHA DO TEMPO & COMUNICAÇÃO WHATSAPP                     */}
          {/* ================================================================ */}
          {activeTab === 'TIMELINE' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 700, marginBottom: '14px' }}>
                Linha do Tempo Operacional & Registros WhatsApp
              </h3>
              {activeTreatment.operationalEvents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  Nenhum evento operacional registrado ainda neste tratamento.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeTreatment.operationalEvents.map((ev: any) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            marginRight: '8px',
                            background: 'rgba(0, 210, 211, 0.14)',
                            color: 'var(--cyan-primary)',
                          }}
                        >
                          {ev.channel}
                        </span>
                        <strong style={{ fontSize: '0.88rem' }}>{ev.summary}</strong>
                        {ev.details && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {ev.details}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {ev.recordedBy?.fullName} • {new Date(ev.occurredAt).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: VÍNCULO COM PRONTUÁRIO EXTERNO DA CLÍNICA (B-INT01)         */}
      {/* ==================================================================== */}
      {erpModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.12rem' }}>Vincular Prontuário Externo da Clínica</h3>
              <button onClick={() => setErpModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveErpLink} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Sistema da Clínica</label>
                <select className="form-input" value={erpProvider} onChange={(e) => setErpProvider(e.target.value as any)}>
                  <option value="CLINICORP" style={{ background: '#0a172a' }}>Clinicorp</option>
                  <option value="SIMPLES_DENTAL" style={{ background: '#0a172a' }}>Simples Dental</option>
                  <option value="DENTAL_OFFICE" style={{ background: '#0a172a' }}>Dental Office</option>
                  <option value="OTHER" style={{ background: '#0a172a' }}>Outro Prontuário</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Código do Paciente *</label>
                  <input required className="form-input" placeholder="Ex: 4821" value={erpExternalId} onChange={(e) => setErpExternalId(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Nº Prontuário / Agenda</label>
                  <input className="form-input" placeholder="Opcional" value={erpSecondaryCode} onChange={(e) => setErpSecondaryCode(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Link Direto no Sistema (opcional)</label>
                <input type="url" className="form-input" placeholder="https://app.clinicorp.com/..." value={erpExternalUrl} onChange={(e) => setErpExternalUrl(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setErpModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Salvar Vínculo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: SOLICITAÇÃO DE REFINAMENTO CONTEXTUALIZADA                  */}
      {/* ==================================================================== */}
      {refinementModalOpen && activeTreatment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.12rem' }}>Solicitar Refinamento — #{activeTreatment.caseCode}</h3>
              <button onClick={() => setRefinementModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Gera nova OS clínica dentro do mesmo tratamento (novo scan + novo setup), respeitando automaticamente a franquia contratual sem gerar novo orçamento quando coberto.
            </p>
            <form onSubmit={handleCreateRefinement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Motivo Clínico / Ajustes Desejados *</label>
                <textarea
                  required
                  rows={3}
                  className="form-input"
                  placeholder="Descreva os dentes/movimentos pendentes após o novo escaneamento..."
                  value={refinementReason}
                  onChange={(e) => setRefinementReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setRefinementModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Abrir OS de Refinamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: DISPARO / PROGRAMAÇÃO DA SEGUNDA LEVA                       */}
      {/* ==================================================================== */}
      {secondBatchModalOpen && activeTreatment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.12rem' }}>Segunda Leva — #{activeTreatment.caseCode}</h3>
              <button onClick={() => setSecondBatchModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Execução operacional programada: sem novo orçamento e sem novo planejamento no Nemo.
            </p>
            <form onSubmit={handleCreateSecondBatch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Alinhador Inicial</label>
                  <input type="number" min={1} required className="form-input" value={batchStartPair} onChange={(e) => setBatchStartPair(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Alinhador Final</label>
                  <input type="number" min={1} required className="form-input" value={batchEndPair} onChange={(e) => setBatchEndPair(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Modo de Execução</label>
                <select className="form-input" value={batchMode} onChange={(e) => setBatchMode(e.target.value as any)}>
                  <option value="IMMEDIATE" style={{ background: '#0a172a' }}>Liberar preparação fabril imediatamente</option>
                  <option value="SCHEDULED" style={{ background: '#0a172a' }}>Programar gatilho (1 mês antes do fim da leva atual)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Observações Internas</label>
                <input className="form-input" placeholder="Opcional" value={batchNotes} onChange={(e) => setBatchNotes(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setSecondBatchModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Confirmar Segunda Leva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: INSERÇÃO CAD NO NEMO / NEMOCAST                             */}
      {/* ==================================================================== */}
      {nemoModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Marco Nemo / NemoCast — {nemoModalOrder.orderNumber}</h3>
              <button onClick={() => setNemoModalOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveNemo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Status CAD no Nemo</label>
                <select className="form-input" value={nemoStatusInput} onChange={(e) => setNemoStatusInput(e.target.value as any)}>
                  <option value="INSERTED" style={{ background: '#0a172a' }}>Inserido no Nemo (Pronto p/ Dr. Adriano)</option>
                  <option value="PENDING" style={{ background: '#0a172a' }}>Pendente de Inserção</option>
                  <option value="ERROR" style={{ background: '#0a172a' }}>Erro / Malha STL Inválida</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>ID do Caso no Nemo</label>
                <input className="form-input" placeholder="Ex: NEMO-2026-089" value={nemoCaseIdInput} onChange={(e) => setNemoCaseIdInput(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Observação Técnica</label>
                <input className="form-input" placeholder="Opcional" value={nemoNotesInput} onChange={(e) => setNemoNotesInput(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setNemoModalOrder(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Salvar Marco Nemo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: REGISTRO OPERACIONAL WHATSAPP / COMERCIAL (LAÍS)            */}
      {/* ==================================================================== */}
      {commModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Registrar Comunicação — {commModalOrder.orderNumber}</h3>
              <button onClick={() => setCommModalOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCommunication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Marco</label>
                  <select className="form-input" value={commEventType} onChange={(e) => setCommEventType(e.target.value as any)}>
                    <option value="SETUP_SENT" style={{ background: '#0a172a' }}>Setup Enviado</option>
                    <option value="BUDGET_SENT" style={{ background: '#0a172a' }}>Orçamento Enviado</option>
                    <option value="CLIENT_APPROVAL_RECORDED" style={{ background: '#0a172a' }}>Aceite Comercial Registrado</option>
                    <option value="SHIPMENT_NOTIFIED" style={{ background: '#0a172a' }}>Rastreio Informado</option>
                    <option value="COMMERCIAL_NOTE" style={{ background: '#0a172a' }}>Acompanhamento Comercial</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Canal</label>
                  <select className="form-input" value={commChannel} onChange={(e) => setCommChannel(e.target.value as any)}>
                    <option value="WHATSAPP" style={{ background: '#0a172a' }}>WhatsApp</option>
                    <option value="PORTAL" style={{ background: '#0a172a' }}>Portal FyAlign</option>
                    <option value="PHONE" style={{ background: '#0a172a' }}>Telefone</option>
                    <option value="EMAIL" style={{ background: '#0a172a' }}>E-mail</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Resumo *</label>
                <input required className="form-input" value={commSummary} onChange={(e) => setCommSummary(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Detalhes</label>
                <input className="form-input" placeholder="Opcional" value={commDetails} onChange={(e) => setCommDetails(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setCommModalOrder(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Registrar Marco</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: APONTAR PENDÊNCIA DOCUMENTAL                                */}
      {/* ==================================================================== */}
      {docsIssueModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Pendência Documental — {docsIssueModalOrder.orderNumber}</h3>
              <button onClick={() => setDocsIssueModalOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveDocsIssue} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Descrição da Pendência *</label>
                <textarea required rows={3} className="form-input" placeholder="Ex: Escaneamento inferior com bolha na distal do 37..." value={docsIssueReason} onChange={(e) => setDocsIssueReason(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setDocsIssueModalOrder(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Salvar Pendência</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

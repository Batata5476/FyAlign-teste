'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  FileCheck,
  FileText,
  FolderPlus,
  History,
  Layers,
  Link2,
  Lock,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
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

const COMMERCIAL_EVENT_TYPES_SET = new Set([
  'BUDGET_SENT',
  'CLIENT_APPROVAL_RECORDED',
  'COMMERCIAL_NOTE',
  'CONTRACT_PROPOSED',
  'CONTRACT_CONFIRMED',
  'CONTRACT_AMENDED',
  'REFINEMENT_COMMERCIAL_DECISION',
]);

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

function formatDoctorDisplay(fullName?: string | null): string {
  if (!fullName) return '—';
  const trimmed = fullName.trim();
  if (/^dr(\.|a\.|\(a\)\.)?\s/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr(a). ${trimmed}`;
}

function makeClientIdempotencyKey(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

function computeOrderUrgencyRank(so: any): number {
  if (so.status === 'DELIVERED' || so.status === 'CANCELLED') return 0;
  const states = [
    so.slas?.setup?.state,
    so.slas?.production?.state,
    so.slas?.secondBatchPrep?.state,
  ];
  if (states.includes('OVERDUE')) return 4;
  if (states.includes('DUE_SOON')) return 3;
  if (states.includes('ON_TRACK')) return 2;
  return 1;
}

export function PatientTreatment360View({ mode, resourceId }: PatientTreatment360ViewProps) {
  const router = useRouter();
  const { can, canAny } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);
  const [selectedSummaryOrderId, setSelectedSummaryOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('SUMMARY');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Modal 1: Prontuário Externo da Clínica (ERP)
  const [erpModalOpen, setErpModalOpen] = useState(false);
  const [erpProvider, setErpProvider] = useState<'CLINICORP' | 'SIMPLES_DENTAL' | 'DENTAL_OFFICE' | 'OTHER'>('CLINICORP');
  const [erpExternalId, setErpExternalId] = useState('');
  const [erpSecondaryCode, setErpSecondaryCode] = useState('');
  const [erpExternalUrl, setErpExternalUrl] = useState('');
  const [erpNextAppointment, setErpNextAppointment] = useState('');

  // Modal 2: Solicitação de Refinamento
  const [refinementModalOpen, setRefinementModalOpen] = useState(false);
  const [refinementReason, setRefinementReason] = useState('');
  const [refinementExtraPairs, setRefinementExtraPairs] = useState(4);

  // Modal 3: Solicitação de Segunda Leva (Exclusivo DOCTOR CRO VERIFIED -> abre em RECEIVED)
  const [secondBatchModalOpen, setSecondBatchModalOpen] = useState(false);
  const [batchStartPair, setBatchStartPair] = useState(13);
  const [batchEndPair, setBatchEndPair] = useState(24);
  const [batchNotes, setBatchNotes] = useState('');

  // Modal 3B: Conferência & Programação Interna da Segunda Leva (RECEIVED -> SCHEDULED)
  const [scheduleBatchOrder, setScheduleBatchOrder] = useState<any | null>(null);
  const [scheduleBatchDate, setScheduleBatchDate] = useState('');
  const [scheduleBatchNotes, setScheduleBatchNotes] = useState('');

  // Modal 4: Nemo / NemoCast CAD
  const [nemoModalOrder, setNemoModalOrder] = useState<any | null>(null);
  const [nemoStatusInput, setNemoStatusInput] = useState<'PENDING' | 'INSERTED' | 'ERROR'>('INSERTED');
  const [nemoCaseIdInput, setNemoCaseIdInput] = useState('');
  const [nemoNotesInput, setNemoNotesInput] = useState('');

  // Modal 5: Comunicação Operacional na OS
  const [commModalOrder, setCommModalOrder] = useState<any | null>(null);
  const [commEventType, setCommEventType] = useState<
    'SETUP_SENT' | 'BUDGET_SENT' | 'CLIENT_APPROVAL_RECORDED' | 'SHIPMENT_NOTIFIED' | 'COMMERCIAL_NOTE'
  >('SETUP_SENT');
  const [commChannel, setCommChannel] = useState<'WHATSAPP' | 'PORTAL' | 'PHONE' | 'EMAIL'>('WHATSAPP');
  const [commSummary, setCommSummary] = useState('Setup enviado via WhatsApp para aprovação do doutor');
  const [commDetails, setCommDetails] = useState('');

  // Modal 6: Pendência Documental
  const [docsIssueModalOrder, setDocsIssueModalOrder] = useState<any | null>(null);
  const [docsIssueReason, setDocsIssueReason] = useState('');

  // Modal 7: Emitir Proposta Contratual (DRAFT) — Laís / Dr. Paulo / Admin
  const [contractCreateModalOpen, setContractCreateModalOpen] = useState(false);
  const [pkgName, setPkgName] = useState('FyAlign Híbrido 24 Pares');
  const [pkgAligners, setPkgAligners] = useState(24);
  const [pkgPriceReais, setPkgPriceReais] = useState('4200');
  const [pkgProductionModel, setPkgProductionModel] = useState<'ALL_AT_ONCE' | 'PHASED_BATCHES' | 'HYBRID'>('HYBRID');
  const [pkgDeliveryModel, setPkgDeliveryModel] = useState<'SINGLE_SHIPMENT' | 'BATCHED'>('BATCHED');
  const [pkgIncludedRefinements, setPkgIncludedRefinements] = useState(1);
  const [pkgRefinementWindowDays, setPkgRefinementWindowDays] = useState(180);
  const [pkgExtraAlignerReais, setPkgExtraAlignerReais] = useState('160');
  const [pkgSetupSlaDays, setPkgSetupSlaDays] = useState(3);
  const [pkgProdSlaDays, setPkgProdSlaDays] = useState(10);
  const [pkgProdSlaDayType, setPkgProdSlaDayType] = useState<'BUSINESS_DAYS' | 'CALENDAR_DAYS'>('BUSINESS_DAYS');
  const [pkgCommercialNotes, setPkgCommercialNotes] = useState('');

  // Modal 8: Aditivo Contratual (AMEND) — Dr. Paulo / Admin
  const [contractAmendModalOpen, setContractAmendModalOpen] = useState(false);
  const [amendAligners, setAmendAligners] = useState(24);
  const [amendPriceReais, setAmendPriceReais] = useState('4200');
  const [amendIncludedRefinements, setAmendIncludedRefinements] = useState(1);
  const [amendExtraAlignerReais, setAmendExtraAlignerReais] = useState('160');
  const [amendReason, setAmendReason] = useState('');
  const [amendNotes, setAmendNotes] = useState('');

  // Modal 9: Aprovação Comercial de Refinamento — Dr. Paulo / Admin
  const [refinementDecisionTarget, setRefinementDecisionTarget] = useState<any | null>(null);
  const [refDecisionApproved, setRefDecisionApproved] = useState(true);
  const [refDecisionCovered, setRefDecisionCovered] = useState(false);
  const [refDecisionExtraReais, setRefDecisionExtraReais] = useState('0');
  const [refDecisionNotes, setRefDecisionNotes] = useState('');

  // Modal 10: Ocorrência Comercial Direta no Tratamento (/contract/events)
  const [commercialEventModalOpen, setCommercialEventModalOpen] = useState(false);
  const [commercialEvType, setCommercialEvType] = useState<'BUDGET_SENT' | 'CLIENT_APPROVAL_RECORDED' | 'COMMERCIAL_NOTE'>('BUDGET_SENT');
  const [commercialEvChannel, setCommercialEvChannel] = useState<'WHATSAPP' | 'PORTAL' | 'PHONE' | 'EMAIL' | 'INTERNAL'>('WHATSAPP');
  const [commercialEvSummary, setCommercialEvSummary] = useState('');
  const [commercialEvDetails, setCommercialEvDetails] = useState('');

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

  const isCommercialOnly = useMemo(() => {
    return (
      data?.viewMode === 'COMMERCIAL_ONLY' ||
      (!can('CASE_READ') && can('CONTRACT_READ'))
    );
  }, [data?.viewMode, can]);

  // Abas dinâmicas governadas por user.permissions e pelo modo estritamente comercial
  const availableTabs = useMemo(() => {
    if (isCommercialOnly) {
      return [{ key: 'COMMERCIAL' as TabKey, label: 'Plano & Contrato', icon: FileText }];
    }

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
  }, [isCommercialOnly, can, canAny]);

  // Sincroniza query string (?tab=COMMERCIAL&orderId=...) e garante aba válida
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get('tab') as TabKey | null;
      const requestedOrder = params.get('orderId');
      if (requestedTab && availableTabs.some((t) => t.key === requestedTab)) {
        setActiveTab(requestedTab);
      } else if (!availableTabs.some((t) => t.key === activeTab)) {
        setActiveTab(availableTabs[0]?.key || 'COMMERCIAL');
      }
      if (requestedOrder) {
        setSelectedSummaryOrderId(requestedOrder);
      }
    } else if (!availableTabs.some((t) => t.key === activeTab)) {
      setActiveTab(availableTabs[0]?.key || 'COMMERCIAL');
    }
  }, [availableTabs, activeTab]);

  const activeTreatment = useMemo(() => {
    if (!data?.treatments?.length) return null;
    return (
      data.treatments.find((t: any) => t.id === selectedTreatmentId) || data.treatments[0]
    );
  }, [data, selectedTreatmentId]);

  // Seleciona automaticamente a OS mais crítica (OVERDUE > DUE_SOON > aberta mais recente) para o Resumo 360°
  const prioritizedSummaryOrder = useMemo(() => {
    const orders = activeTreatment?.serviceOrders || [];
    if (orders.length === 0) return null;
    if (selectedSummaryOrderId) {
      const explicit = orders.find((o: any) => o.id === selectedSummaryOrderId);
      if (explicit) return explicit;
    }
    const sorted = [...orders].sort((a: any, b: any) => {
      const rankDiff = computeOrderUrgencyRank(b) - computeOrderUrgencyRank(a);
      if (rankDiff !== 0) return rankDiff;
      return (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
    });
    return sorted[0] || orders[orders.length - 1];
  }, [activeTreatment, selectedSummaryOrderId]);

  const patientErpLink = useMemo(() => {
    const links = data?.patient?.externalLinks || [];
    return (
      links.find((l: any) =>
        ['CLINICORP', 'SIMPLES_DENTAL', 'DENTAL_OFFICE', 'OTHER'].includes(l.provider)
      ) || null
    );
  }, [data]);

  const commercialEventsList = useMemo(() => {
    const events = activeTreatment?.operationalEvents || [];
    return events.filter((ev: any) => COMMERCIAL_EVENT_TYPES_SET.has(ev.eventType));
  }, [activeTreatment]);

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
      const allocated = activeTreatment?.deliveriesSummary?.allocatedPairs || 12;
      const total = activeTreatment?.commercialContract?.contractedAligners || allocated + 12;
      setBatchStartPair(allocated + 1);
      setBatchEndPair(Math.max(allocated + 1, total));
    }
    setBatchNotes('');
    setSecondBatchModalOpen(true);
  };

  const openScheduleSecondBatchModal = (so: any) => {
    setScheduleBatchOrder(so);
    const defaultIso =
      so.scheduledPrepAt ||
      activeTreatment?.secondBatchRadar?.prepDueAt ||
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    setScheduleBatchDate(defaultIso.slice(0, 10));
    setScheduleBatchNotes(so.notes || '');
  };

  const openContractAmendModal = () => {
    const c = activeTreatment?.commercialContract;
    if (!c) return;
    setAmendAligners(c.contractedAligners || 24);
    setAmendPriceReais(String(((c.totalPriceCents || 0) / 100).toFixed(2)));
    setAmendIncludedRefinements(c.includedRefinements ?? 0);
    setAmendExtraAlignerReais(String(((c.extraAlignerPriceCents || 0) / 100).toFixed(2)));
    setAmendReason('');
    setAmendNotes(c.commercialNotes || '');
    setContractAmendModalOpen(true);
  };

  const openRefinementDecisionModal = (ref: any) => {
    setRefinementDecisionTarget(ref);
    setRefDecisionApproved(true);
    setRefDecisionCovered(Boolean(ref.isCoveredByContract));
    setRefDecisionExtraReais(String(((ref.extraAmountChargedCents || 0) / 100).toFixed(2)));
    setRefDecisionNotes('');
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
      const idemKey = makeClientIdempotencyKey('refinement');
      const res = await fetch(`/api/cases/${activeTreatment.id}/service-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          type: 'REFINEMENT',
          clinicalReason: refinementReason,
          extraAlignersCount: Number(refinementExtraPairs) || 0,
          idempotencyKey: idemKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao solicitar refinamento');
      setRefinementModalOpen(false);
      setRefinementReason('');
      setRefinementExtraPairs(4);
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
      const idemKey = makeClientIdempotencyKey('second-batch');
      const res = await fetch(`/api/cases/${activeTreatment.id}/service-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          type: 'SECOND_BATCH',
          alignerRangeStart: Number(batchStartPair),
          alignerRangeEnd: Number(batchEndPair),
          notes: batchNotes || undefined,
          idempotencyKey: idemKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao solicitar Segunda Leva');
      setSecondBatchModalOpen(false);
      setFeedbackBanner(json.message || 'Segunda Leva registrada em RECEIVED para conferência interna.');
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
      const idemKey = makeClientIdempotencyKey('order-patch');
      const res = await fetch(`/api/cases/${activeTreatment.id}/service-orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({ ...payload, idempotencyKey: idemKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao executar ação operacional');
      setFeedbackBanner(json.message || successMsg);
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleScheduleSecondBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleBatchOrder) return;
    const scheduledIso = scheduleBatchDate
      ? new Date(`${scheduleBatchDate}T12:00:00.000Z`).toISOString()
      : null;
    await executeOrderPatch(
      scheduleBatchOrder.id,
      {
        action: 'SCHEDULE_SECOND_BATCH',
        scheduledPrepAt: scheduledIso,
        notes: scheduleBatchNotes || null,
      },
      `Segunda Leva ${scheduleBatchOrder.orderNumber} conferida e programada (SCHEDULED).`
    );
    setScheduleBatchOrder(null);
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

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const idemKey = makeClientIdempotencyKey('contract-create');
      const totalPriceCents = Math.round(Number(pkgPriceReais.replace(',', '.')) * 100);
      const extraAlignerPriceCents = Math.round(Number(pkgExtraAlignerReais.replace(',', '.')) * 100);

      const res = await fetch(`/api/cases/${activeTreatment.id}/contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          packageName: pkgName,
          contractedAligners: Number(pkgAligners),
          totalPriceCents,
          currency: 'BRL',
          productionModel: pkgProductionModel,
          deliveryModel: pkgDeliveryModel,
          includedRefinements: Number(pkgIncludedRefinements),
          refinementWindowDays: Number(pkgRefinementWindowDays),
          extraAlignerPriceCents,
          setupSlaBusinessDays: Number(pkgSetupSlaDays),
          productionSlaDays: Number(pkgProdSlaDays),
          productionSlaDayType: pkgProdSlaDayType,
          commercialNotes: pkgCommercialNotes || null,
          idempotencyKey: idemKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao emitir proposta contratual');
      setContractCreateModalOpen(false);
      setFeedbackBanner(`Proposta comercial ${json.contract?.contractCode || ''} criada em rascunho (DRAFT).`);
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmContract = async () => {
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const idemKey = makeClientIdempotencyKey('contract-confirm');
      const res = await fetch(`/api/cases/${activeTreatment.id}/contract`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({ idempotencyKey: idemKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao confirmar fechamento contratual');
      setFeedbackBanner(json.message || 'Contrato comercial confirmado com sucesso!');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAmendContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const idemKey = makeClientIdempotencyKey('contract-amend');
      const totalPriceCents = Math.round(Number(amendPriceReais.replace(',', '.')) * 100);
      const extraAlignerPriceCents = Math.round(Number(amendExtraAlignerReais.replace(',', '.')) * 100);

      const res = await fetch(`/api/cases/${activeTreatment.id}/contract/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          changeReason: amendReason,
          contractedAligners: Number(amendAligners),
          totalPriceCents,
          includedRefinements: Number(amendIncludedRefinements),
          extraAlignerPriceCents,
          commercialNotes: amendNotes || null,
          idempotencyKey: idemKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao registrar aditivo contratual');
      setContractAmendModalOpen(false);
      setFeedbackBanner(json.message || 'Aditivo contratual registrado com sucesso.');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCommercialRefinementDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreatment || !refinementDecisionTarget) return;
    setSubmittingAction(true);
    try {
      const extraAmountChargedCents = refDecisionCovered
        ? 0
        : Math.round(Number(refDecisionExtraReais.replace(',', '.')) * 100);

      const res = await fetch(
        `/api/cases/${activeTreatment.id}/refinements/v2/${refinementDecisionTarget.id}/commercial-approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approved: refDecisionApproved,
            isCoveredByContract: refDecisionCovered,
            extraAmountChargedCents,
            commercialNotes: refDecisionNotes || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao registrar decisão comercial');
      setRefinementDecisionTarget(null);
      setFeedbackBanner(json.message || 'Decisão comercial registrada.');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveCommercialEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTreatment) return;
    setSubmittingAction(true);
    try {
      const idemKey = makeClientIdempotencyKey('commercial-event');
      const res = await fetch(`/api/cases/${activeTreatment.id}/contract/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          eventType: commercialEvType,
          channel: commercialEvChannel,
          summary: commercialEvSummary,
          details: commercialEvDetails || null,
          idempotencyKey: idemKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao registrar ocorrência comercial');
      setCommercialEventModalOpen(false);
      setCommercialEvSummary('');
      setCommercialEvDetails('');
      setFeedbackBanner('Ocorrência comercial registrada com sucesso.');
      await loadOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

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
  const summaryOrder = prioritizedSummaryOrder;
  const latestShipment = activeTreatment?.shipments?.[0] || null;
  const latestWhatsappEvent = (activeTreatment?.operationalEvents || []).find(
    (ev: any) => ev.channel === 'WHATSAPP'
  );
  const additionalGateAllowed = Boolean(activeTreatment?.additionalOrderGate?.allowed);
  const additionalGateReason =
    activeTreatment?.additionalOrderGate?.reason ||
    'Requer Setup inicial clinicamente aprovado e Contrato comercial confirmado.';

  const canOpenSetupViewer =
    !isCommercialOnly &&
    can('SETUP_READ') &&
    ((activeTreatment?.setups?.length || 0) > 0 || Boolean(data.capabilities?.canCreateOrPublishSetup));

  const backTarget = isCommercialOnly
    ? '/dashboard/contracts'
    : can('PATIENT_READ')
    ? '/dashboard/patients'
    : '/dashboard';
  const backLabel = isCommercialOnly
    ? 'Voltar para Contratos'
    : can('PATIENT_READ')
    ? 'Voltar para Pacientes'
    : 'Voltar ao Painel';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Navegação Superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={() => router.push(backTarget)}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.84rem' }}
        >
          <ArrowLeft size={15} />
          <span>{backLabel}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!isCommercialOnly && mode === 'TREATMENT' && can('PATIENT_READ') && patient?.id && (
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
      {/* CABEÇALHO 360° DO PACIENTE (OU MODO ESTRITAMENTE COMERCIAL PAC-XXXX)  */}
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
              {isCommercialOnly && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: 'rgba(16, 185, 129, 0.14)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#6ee7b7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <ShieldCheck size={12} />
                  Modo Estritamente Comercial (LGPD — Sem Dados Clínicos)
                </span>
              )}
              {!isCommercialOnly && patientErpLink && (
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
              {isCommercialOnly
                ? `Paciente Pseudonimizado (${patient.patientCode})`
                : patient.fullName || patient.patientCode}
            </h1>

            {isCommercialOnly ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Identificação protegida por pseudonimização (`PAC-XXXX`). Acesso autorizado exclusivamente a contrato, valores, entregas e governança financeira do tratamento{' '}
                {activeTreatment ? (
                  <strong style={{ color: 'var(--text-main)' }}>#{activeTreatment.caseCode}</strong>
                ) : null}
                {activeTreatment?.doctor?.fullName ? (
                  <> • Responsável: <strong style={{ color: 'var(--text-main)' }}>{formatDoctorDisplay(activeTreatment.doctor.fullName)}</strong></>
                ) : null}
                .
              </p>
            ) : patient.piiMinimized ? (
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

          {!isCommercialOnly && (
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
              {data.capabilities?.canCreateCase && patient?.id && (
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
          )}
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
                    onClick={() => {
                      setSelectedTreatmentId(trt.id);
                      setSelectedSummaryOrderId(null);
                    }}
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

            {!isCommercialOnly && activeTreatment && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.capabilities?.canTriggerSecondBatch && (
                  <button
                    onClick={() => {
                      if (!additionalGateAllowed) return;
                      openSecondBatchModal();
                    }}
                    disabled={!additionalGateAllowed}
                    title={!additionalGateAllowed ? additionalGateReason : 'Solicitar Segunda Leva (abre em RECEIVED)'}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '7px 12px',
                      opacity: additionalGateAllowed ? 1 : 0.52,
                      cursor: additionalGateAllowed ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {additionalGateAllowed ? <Package size={14} /> : <Lock size={14} />}
                    <span>+ Segunda Leva</span>
                  </button>
                )}
                {data.capabilities?.canRequestRefinement && (
                  <button
                    onClick={() => {
                      if (!additionalGateAllowed) return;
                      setRefinementModalOpen(true);
                    }}
                    disabled={!additionalGateAllowed}
                    title={!additionalGateAllowed ? additionalGateReason : 'Solicitar OS de Refinamento'}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '7px 12px',
                      opacity: additionalGateAllowed ? 1 : 0.52,
                      cursor: additionalGateAllowed ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {additionalGateAllowed ? <Plus size={14} /> : <Lock size={14} />}
                    <span>+ Solicitar Refinamento</span>
                  </button>
                )}
                {canOpenSetupViewer && (
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

        {/* Aviso Explícito de Bloqueio Categórico (Sem Contrato Confirmado / Sem Setup Inicial Aprovado) */}
        {!isCommercialOnly &&
          activeTreatment &&
          !additionalGateAllowed &&
          (data.capabilities?.canTriggerSecondBatch || data.capabilities?.canRequestRefinement) && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fcd34d',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Lock size={14} />
              <span>
                <strong>Segunda Leva e Refinamento bloqueados neste momento:</strong> {additionalGateReason} (Mensagens preliminares permanecem liberadas).
              </span>
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
          {data.capabilities?.canCreateCase && patient?.id && (
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
          {/* Alerta Programado da Segunda Leva (Gatilho T-30d, apenas com Setup aprovado + Contrato confirmado) */}
          {!isCommercialOnly && activeTreatment.secondBatchRadar?.eligible && (
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
                    Radar T-30d da Segunda Leva: Pares {activeTreatment.secondBatchRadar.nextRangeStart}–
                    {activeTreatment.secondBatchRadar.nextRangeEnd}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Leva atual ({activeTreatment.secondBatchRadar.currentBatchRange}) com término estimado em{' '}
                    <strong>
                      {new Date(activeTreatment.secondBatchRadar.estimatedCurrentBatchEndAt).toLocaleDateString('pt-BR')}
                    </strong>{' '}
                    • Meta de preparação (1 mês antes):{' '}
                    <strong style={{ color: '#fbbf24' }}>
                      {new Date(activeTreatment.secondBatchRadar.prepDueAt).toLocaleDateString('pt-BR')}
                    </strong>{' '}
                    • {activeTreatment.secondBatchRadar.sla.label}
                  </div>
                </div>
              </div>
              {data.capabilities?.canTriggerSecondBatch && additionalGateAllowed && (
                <button onClick={openSecondBatchModal} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                  Solicitar Segunda Leva (Sem Novo Orçamento)
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
              flexWrap: 'wrap',
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
          {!isCommercialOnly && activeTab === 'SUMMARY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Seletor rápido de OS em foco no Resumo quando houver múltiplas OS */}
              {activeTreatment.serviceOrders?.length > 1 && (
                <div
                  className="glass-panel"
                  style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    OS EM FOCO NOS INDICADORES DE SLA (PRIORIZADA POR URGÊNCIA):
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {activeTreatment.serviceOrders.map((so: any) => {
                      const isFocused = summaryOrder?.id === so.id;
                      const rank = computeOrderUrgencyRank(so);
                      return (
                        <button
                          key={so.id}
                          onClick={() => setSelectedSummaryOrderId(so.id)}
                          style={{
                            padding: '5px 11px',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: isFocused
                              ? '1px solid var(--cyan-primary)'
                              : rank >= 4
                              ? '1px solid rgba(239,68,68,0.45)'
                              : '1px solid var(--border-subtle)',
                            background: isFocused
                              ? 'rgba(0, 210, 211, 0.14)'
                              : rank >= 4
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'rgba(255,255,255,0.02)',
                            color: isFocused
                              ? 'var(--cyan-primary)'
                              : rank >= 4
                              ? '#fca5a5'
                              : 'var(--text-muted)',
                          }}
                        >
                          {so.orderNumber} • {formatOrderTypeLabel(so.type)} ({so.status})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                    {formatDoctorDisplay(activeTreatment.doctor?.fullName)} • Arcadas: {activeTreatment.treatedArches}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {summaryOrder?.type === 'SECOND_BATCH'
                      ? `META T-30D / PREPARAÇÃO (${summaryOrder.orderNumber})`
                      : `PRAZO DE SETUP (${summaryOrder?.orderNumber || '3 DIAS ÚTEIS'})`}
                  </div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '6px' }}>
                    {summaryOrder?.type === 'SECOND_BATCH'
                      ? summaryOrder.scheduledPrepAt
                        ? `Meta ${new Date(summaryOrder.scheduledPrepAt).toLocaleDateString('pt-BR')}`
                        : 'Aguardando conferência interna'
                      : summaryOrder?.slas?.setup?.dueAt
                      ? `Até ${new Date(summaryOrder.slas.setup.dueAt).toLocaleDateString('pt-BR')}`
                      : 'Aguardando envio da OS'}
                  </div>
                  <span
                    style={{
                      ...getSlaBadgeStyle(
                        summaryOrder?.type === 'SECOND_BATCH'
                          ? summaryOrder?.slas?.secondBatchPrep?.state
                          : summaryOrder?.slas?.setup?.state
                      ),
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    {summaryOrder?.type === 'SECOND_BATCH'
                      ? summaryOrder?.slas?.secondBatchPrep?.label || 'Em conferência (RECEIVED)'
                      : summaryOrder?.slas?.setup?.label || 'Pendente de submissão'}
                  </span>
                </div>

                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    PRAZO DE PRODUÇÃO ({summaryOrder?.orderNumber || 'PÓS-APROVAÇÃO'})
                  </div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '6px' }}>
                    {summaryOrder?.slas?.production?.dueAt
                      ? `Pronto até ${new Date(summaryOrder.slas.production.dueAt).toLocaleDateString('pt-BR')}`
                      : 'Aguardando liberação'}
                  </div>
                  <span
                    style={{
                      ...getSlaBadgeStyle(summaryOrder?.slas?.production?.state),
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    {summaryOrder?.slas?.production?.label || 'Aguardando gatilho'}
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
                            summaryOrder?.nemo?.status === 'INSERTED' || summaryOrder?.nemo?.status === 'NOT_REQUIRED'
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(245, 158, 11, 0.16)',
                          color:
                            summaryOrder?.nemo?.status === 'INSERTED' || summaryOrder?.nemo?.status === 'NOT_REQUIRED'
                              ? '#34d399'
                              : '#fbbf24',
                        }}
                      >
                        {summaryOrder?.nemo?.status || 'AGUARDANDO OS'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.81rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {summaryOrder?.nemo?.nemoCaseId && (
                        <span>ID Caso Nemo: <strong style={{ color: 'var(--text-main)' }}>{summaryOrder.nemo.nemoCaseId}</strong></span>
                      )}
                      {summaryOrder?.nemo?.insertedBy && (
                        <span>Operador: <strong style={{ color: 'var(--text-main)' }}>{summaryOrder.nemo.insertedBy.fullName}</strong></span>
                      )}
                      {summaryOrder?.nemo?.insertedAt && (
                        <span>Inserido em: {new Date(summaryOrder.nemo.insertedAt).toLocaleString('pt-BR')}</span>
                      )}
                      {!summaryOrder?.nemo?.nemoCaseId && !summaryOrder?.nemo?.insertedAt && (
                        <span>Rastreia inserção de malhas STL no Nemo antes do planejamento do Dr. Adriano.</span>
                      )}
                    </div>
                    {can('NEMO_MANAGE') && summaryOrder && summaryOrder.type !== 'SECOND_BATCH' && (
                      <button
                        onClick={() => {
                          setNemoModalOrder(summaryOrder);
                          setNemoStatusInput(
                            summaryOrder.nemo?.status === 'ERROR' ? 'ERROR' : 'INSERTED'
                          );
                          setNemoCaseIdInput(summaryOrder.nemo?.nemoCaseId || '');
                          setNemoNotesInput(summaryOrder.nemo?.notes || '');
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
                    {can('COMMERCIAL_COMMUNICATE') && summaryOrder && (
                      <button
                        onClick={() => setCommModalOrder(summaryOrder)}
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
          {!isCommercialOnly && activeTab === 'SERVICE_ORDERS' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>
                    Solicitações Operacionais do Tratamento #{activeTreatment.caseCode}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Fluxo auditável: Segunda Leva nasce em RECEIVED (Ortodontista CRO Verificado), passa por conferência/programação interna (SCHEDULED) e liberação fabril (RELEASED_FOR_PRODUCTION).
                  </p>
                </div>
              </div>

              {activeTreatment.serviceOrders.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Este tratamento ainda está em rascunho. Ao submeter o caso, a OS Inicial será gerada automaticamente.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {activeTreatment.serviceOrders.map((so: any) => {
                    const isContractReady = Boolean(activeTreatment.commercialGateSummary?.isContractConfirmed);
                    const canReleaseThisOrder =
                      Boolean(data.capabilities?.canReleaseProduction) &&
                      so.status !== 'RELEASED_FOR_PRODUCTION' &&
                      so.status !== 'DELIVERED' &&
                      so.status !== 'CANCELLED' &&
                      (so.type === 'SECOND_BATCH'
                        ? so.status === 'SCHEDULED' && isContractReady
                        : so.type === 'INITIAL'
                        ? Boolean(activeTreatment.commercialGateSummary?.doubleTriggerSatisfied)
                        : !so.requiresNewBudget && Boolean(so.approvedAt) && isContractReady);

                    return (
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
                              {can('CONTRACT_READ') && !so.requiresNewBudget && (
                                <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                                  Sem Novo Orçamento
                                </span>
                              )}
                              {can('CONTRACT_READ') && so.requiresNewBudget && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    background: 'rgba(245, 158, 11, 0.16)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    fontWeight: 600,
                                  }}
                                >
                                  Aguardando Aprovação Comercial
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
                            {so.type !== 'SECOND_BATCH' ? (
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
                            ) : (
                              <span
                                style={{
                                  ...getSlaBadgeStyle(so.slas?.secondBatchPrep?.state),
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '0.74rem',
                                }}
                              >
                                Meta T-30d: {so.slas?.secondBatchPrep?.label || 'Aguardando programação'}
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

                        {/* Trilha de Auditoria Operacional da OS */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '16px',
                            flexWrap: 'wrap',
                            fontSize: '0.76rem',
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.015)',
                            padding: '8px 12px',
                            borderRadius: '8px',
                          }}
                        >
                          <span>
                            Solicitado por:{' '}
                            <strong style={{ color: 'var(--text-main)' }}>
                              {so.requestedBy?.fullName || 'Sistema'}
                            </strong>
                            {so.receivedAt ? ` (${new Date(so.receivedAt).toLocaleDateString('pt-BR')})` : ''}
                          </span>
                          {so.docsVerification?.verifiedAt && (
                            <span>
                              Conferido por:{' '}
                              <strong style={{ color: '#34d399' }}>
                                {so.docsVerification.verifiedBy?.fullName || 'Equipe Interna'}
                              </strong>{' '}
                              ({new Date(so.docsVerification.verifiedAt).toLocaleDateString('pt-BR')})
                            </span>
                          )}
                          {so.scheduledPrepAt && (
                            <span>
                              Programado p/:{' '}
                              <strong style={{ color: '#fbbf24' }}>
                                {new Date(so.scheduledPrepAt).toLocaleDateString('pt-BR')}
                              </strong>
                            </span>
                          )}
                          {so.productionRelease?.releasedAt && (
                            <span>
                              Liberado p/ produção por:{' '}
                              <strong style={{ color: 'var(--cyan-primary)' }}>
                                {so.productionRelease.releasedBy?.fullName || 'Laboratório'}
                              </strong>{' '}
                              ({new Date(so.productionRelease.releasedAt).toLocaleDateString('pt-BR')})
                            </span>
                          )}
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
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                          {so.type === 'SECOND_BATCH' &&
                            data.capabilities?.canScheduleSecondBatch &&
                            (so.status === 'RECEIVED' || so.status === 'PENDING_DOCS') && (
                              <button
                                disabled={submittingAction}
                                onClick={() => openScheduleSecondBatchModal(so)}
                                className="btn-primary"
                                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                              >
                                <Calendar size={13} /> Conferir & Programar 2ª Leva (SCHEDULED)
                              </button>
                            )}

                          {can('DOC_VERIFY') && so.type !== 'SECOND_BATCH' && so.status !== 'RELEASED_FOR_PRODUCTION' && so.status !== 'DELIVERED' && (
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

                          {can('DOC_VERIFY') && so.type === 'SECOND_BATCH' && so.status === 'RECEIVED' && (
                            <button
                              disabled={submittingAction}
                              onClick={() => setDocsIssueModalOrder(so)}
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                            >
                              <AlertTriangle size={13} /> Apontar Impedimento
                            </button>
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

                          {canReleaseThisOrder && (
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

                          {data.capabilities?.canReleaseProduction &&
                            so.type === 'SECOND_BATCH' &&
                            so.status === 'RECEIVED' && (
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                • Liberação fabril habilitada após conferência e programação (`SCHEDULED`).
                              </span>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 3: DOCUMENTAÇÃO & PRESCRIÇÃO CLÍNICA                         */}
          {/* ================================================================ */}
          {!isCommercialOnly && activeTab === 'DOCUMENTATION' && (
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
                  {canAny(['FILE_READ', 'CASE_UPDATE']) && (
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
          {!isCommercialOnly && activeTab === 'SETUP_3D' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700 }}>Histórico de Setups Virtuais 3D</h3>
                {canOpenSetupViewer && (
                  <button
                    onClick={() => router.push(`/dashboard/cases/${activeTreatment.id}/setup`)}
                    className="btn-primary"
                    style={{ fontSize: '0.82rem' }}
                  >
                    <Box size={15} />{' '}
                    {activeTreatment.setups.length === 0
                      ? 'Publicar Setup 3D'
                      : 'Abrir Visualizador 3D Interativo'}
                  </button>
                )}
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
          {!isCommercialOnly && activeTab === 'PRODUCTION_LOGISTICS' && (
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
          {/* ABA 6: PLANO & CONTRATO (ESTAÇÃO COMERCIAL INTERATIVA COMPLETA)  */}
          {/* ================================================================ */}
          {activeTab === 'COMMERCIAL' && can('CONTRACT_READ') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Status do Duplo Gatilho & Ações Comerciais Principais */}
              <div className="glass-panel" style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
                      Plano & Contrato do Tratamento #{activeTreatment.caseCode}
                    </h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>
                        Gatilho Clínico (Setup Inicial):{' '}
                        <strong style={{ color: activeTreatment.commercialGateSummary?.hasInitialApprovedSetup ? '#34d399' : '#fbbf24' }}>
                          {activeTreatment.commercialGateSummary?.hasInitialApprovedSetup ? 'APROVADO' : 'PENDENTE'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Gatilho Comercial (Contrato):{' '}
                        <strong style={{ color: activeTreatment.commercialGateSummary?.isContractConfirmed ? '#34d399' : '#fbbf24' }}>
                          {activeTreatment.commercialGateSummary?.isContractConfirmed ? 'CONFIRMADO' : 'PENDENTE'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!activeTreatment.commercialContract && can('CONTRACT_CREATE') && (
                      <button
                        onClick={() => setContractCreateModalOpen(true)}
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                      >
                        <Plus size={15} /> Emitir Proposta Contratual (DRAFT)
                      </button>
                    )}

                    {activeTreatment.commercialContract?.status === 'DRAFT' && can('CONTRACT_CONFIRM') && (
                      <button
                        disabled={submittingAction}
                        onClick={handleConfirmContract}
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                      >
                        <CheckCircle2 size={15} /> Confirmar Fechamento Contratual
                      </button>
                    )}

                    {activeTreatment.commercialContract &&
                      ['CONFIRMED', 'AMENDED'].includes(activeTreatment.commercialContract.status) &&
                      can('CONTRACT_AMEND') && (
                        <button
                          onClick={openContractAmendModal}
                          className="btn-secondary"
                          style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                        >
                          <FileText size={15} /> Registrar Aditivo Contratual
                        </button>
                      )}

                    {can('COMMERCIAL_COMMUNICATE') && (
                      <button
                        onClick={() => setCommercialEventModalOpen(true)}
                        className="btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                      >
                        <Send size={14} /> + Registrar Ocorrência Comercial
                      </button>
                    )}
                  </div>
                </div>

                {!activeTreatment.commercialContract ? (
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: '10px',
                      border: '1px dashed var(--border-subtle)',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.88rem',
                    }}
                  >
                    Nenhum contrato comercial vinculado a este tratamento ainda. Solicitações de Segunda Leva e Refinamento permanecem bloqueadas até a confirmação contratual.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>PACOTE & VERSÃO ATUAL</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                        {activeTreatment.commercialContract.packageName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {activeTreatment.commercialContract.contractCode} • v{activeTreatment.commercialContract.versionNumber} •{' '}
                        <strong style={{ color: activeTreatment.commercialContract.status === 'DRAFT' ? '#fbbf24' : '#34d399' }}>
                          {activeTreatment.commercialContract.status}
                        </strong>
                      </div>
                      {activeTreatment.commercialContract.confirmedAt && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Confirmado por {activeTreatment.commercialContract.confirmedBy?.fullName || 'Financeiro'} em{' '}
                          {new Date(activeTreatment.commercialContract.confirmedAt).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>PARES & VALOR CONTRATADO</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                        {activeTreatment.commercialContract.contractedAligners} pares •{' '}
                        {formatBrlFromCents(activeTreatment.commercialContract.totalPriceCents)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Modelo: {activeTreatment.commercialContract.productionModel} / {activeTreatment.commercialContract.deliveryModel}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Alinhador extra: {formatBrlFromCents(activeTreatment.commercialContract.extraAlignerPriceCents)}
                      </div>
                    </div>

                    <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>FRANQUIA DE REFINAMENTOS</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }}>
                        {activeTreatment.commercialContract.remainingCoveredRefinements} disponíveis de{' '}
                        {activeTreatment.commercialContract.includedRefinements}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Janela contratual: {activeTreatment.commercialContract.refinementWindowDays} dias
                      </div>
                    </div>

                    <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>ENTREGAS & SLAs ACORDADOS</div>
                      <div style={{ fontSize: '1.02rem', fontWeight: 700, marginTop: '4px' }}>
                        Alocados: {activeTreatment.deliveriesSummary?.allocatedPairs || 0}/
                        {activeTreatment.commercialContract.contractedAligners} pares
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Expedidos: {activeTreatment.deliveriesSummary?.shippedPairs || 0} pares ({activeTreatment.deliveriesSummary?.shipmentsCount || 0} remessas)
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        SLAs: Setup {activeTreatment.commercialContract.setupSlaBusinessDays}d úteis • Prod. {activeTreatment.commercialContract.productionSlaDays}d
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Governança Comercial de Refinamentos & Franquia */}
              <div className="glass-panel" style={{ padding: '22px 24px' }}>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={16} color="var(--cyan-primary)" />
                  Refinamentos & Governança de Cobertura / Orçamento Extra
                </h4>
                {!activeTreatment.refinements?.length ? (
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Nenhum refinamento aberto neste tratamento até o momento.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeTreatment.refinements.map((ref: any) => (
                      <div
                        key={ref.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--cyan-primary)' }}>
                              Refinamento #{ref.sequenceNumber}
                            </strong>
                            <span className="badge badge-draft" style={{ fontSize: '0.7rem' }}>
                              Contrato congelado v{ref.contractVersionUsed}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: ref.isCoveredByContract
                                  ? 'rgba(16, 185, 129, 0.16)'
                                  : 'rgba(245, 158, 11, 0.16)',
                                color: ref.isCoveredByContract ? '#34d399' : '#fbbf24',
                                fontWeight: 600,
                              }}
                            >
                              {ref.isCoveredByContract ? 'Coberto pela Franquia' : 'Fora da Franquia'}
                            </span>
                            <span className="badge badge-production" style={{ fontSize: '0.7rem' }}>
                              {ref.commercialStatus}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Pares extras estimados: <strong>{ref.extraAlignersCount}</strong> • Valor extra:{' '}
                            <strong style={{ color: 'var(--text-main)' }}>
                              {formatBrlFromCents(ref.extraAmountChargedCents || 0)}
                            </strong>
                            {ref.commerciallyApprovedBy?.fullName
                              ? ` • Decisão por ${ref.commerciallyApprovedBy.fullName}`
                              : ''}
                          </div>
                          {ref.clinicalReason && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                              Motivo clínico: {ref.clinicalReason}
                            </div>
                          )}
                        </div>

                        {ref.commercialStatus === 'PENDING_COMMERCIAL_APPROVAL' &&
                          can('REFINEMENT_COMMERCIAL_APPROVE') && (
                            <button
                              onClick={() => openRefinementDecisionModal(ref)}
                              className="btn-primary"
                              style={{ fontSize: '0.78rem', padding: '7px 12px' }}
                            >
                              Decidir Aprovação Comercial
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Entregas Contratadas & Histórico de Versões + Eventos Comerciais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                <div className="glass-panel" style={{ padding: '22px' }}>
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={16} color="var(--cyan-primary)" />
                    Histórico de Versões & Aditivos Contratuais
                  </h4>
                  {!activeTreatment.commercialContract?.versions?.length ? (
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                      Nenhuma versão confirmada ou aditivo registrado ainda.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {activeTreatment.commercialContract.versions.map((ver: any) => (
                        <div
                          key={ver.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>Versão v{ver.versionNumber}</span>
                            <span style={{ color: 'var(--cyan-primary)' }}>
                              {ver.contractedAligners} pares • {formatBrlFromCents(ver.totalPriceCents)}
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Franquia: {ver.includedRefinements} refinamento(s) • Extra: {formatBrlFromCents(ver.extraAlignerPriceCents)}
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>
                            Motivo: {ver.changeReason} ({ver.changedBy?.fullName || 'Sistema'} em{' '}
                            {new Date(ver.createdAt).toLocaleDateString('pt-BR')})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass-panel" style={{ padding: '22px' }}>
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} color="var(--cyan-primary)" />
                    Histórico de Confirmações & Ocorrências Comerciais
                  </h4>
                  {commercialEventsList.length === 0 ? (
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                      Nenhuma ocorrência comercial registrada ainda.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {commercialEventsList.map((ev: any) => (
                        <div
                          key={ev.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            <strong>{ev.summary}</strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--cyan-primary)', fontWeight: 700 }}>
                              {ev.channel}
                            </span>
                          </div>
                          {ev.details && (
                            <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>{ev.details}</div>
                          )}
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {ev.recordedBy?.fullName || 'Sistema'} • {new Date(ev.occurredAt).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ABA 7: LINHA DO TEMPO & COMUNICAÇÃO WHATSAPP                     */}
          {/* ================================================================ */}
          {!isCommercialOnly && activeTab === 'TIMELINE' && (
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
              Gera nova OS clínica dentro do mesmo tratamento (novo scan + novo setup), congelando a versão atual do contrato para proteção comercial retroativa.
            </p>
            <form onSubmit={handleCreateRefinement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Motivo Clínico / Ajustes Desejados *</label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  className="form-input"
                  placeholder="Descreva os dentes/movimentos pendentes após o novo escaneamento..."
                  value={refinementReason}
                  onChange={(e) => setRefinementReason(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Estimativa de Pares Adicionais</label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  value={refinementExtraPairs}
                  onChange={(e) => setRefinementExtraPairs(Number(e.target.value))}
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
      {/* MODAL 3: SOLICITAÇÃO DE SEGUNDA LEVA (DOCTOR CRO VERIFIED -> RECEIVED) */}
      {/* ==================================================================== */}
      {secondBatchModalOpen && activeTreatment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.12rem' }}>Solicitar Segunda Leva — #{activeTreatment.caseCode}</h3>
              <button onClick={() => setSecondBatchModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Gatilho exclusivo do Ortodontista Responsável (CRO Verificado). A OS nasce em <strong>RECEIVED</strong> para conferência e programação interna (`SCHEDULED`) antes da liberação fabril.
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
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Observações Clínicas / Entrega</label>
                <input className="form-input" placeholder="Ex: Paciente evoluindo bem no estágio 10..." value={batchNotes} onChange={(e) => setBatchNotes(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setSecondBatchModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Enviar Solicitação (RECEIVED)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3B: CONFERÊNCIA & PROGRAMAÇÃO INTERNA 2ª LEVA (FELIPE)         */}
      {/* ==================================================================== */}
      {scheduleBatchOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Conferir & Programar 2ª Leva — {scheduleBatchOrder.orderNumber}</h3>
              <button onClick={() => setScheduleBatchOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Valida internamente o saldo contratual e programa a data-meta da preparação fabril (`RECEIVED → SCHEDULED`).
            </p>
            <form onSubmit={handleScheduleSecondBatch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Data-Meta de Preparação (T-30d) *</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={scheduleBatchDate}
                  onChange={(e) => setScheduleBatchDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>Notas de Conferência Interna</label>
                <input
                  className="form-input"
                  placeholder="Ex: Modelos base conferidos e aptos para termoformagem..."
                  value={scheduleBatchNotes}
                  onChange={(e) => setScheduleBatchNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setScheduleBatchOrder(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Confirmar Programação (SCHEDULED)</button>
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
      {/* MODAL 5: REGISTRO OPERACIONAL WHATSAPP / COMERCIAL NA OS             */}
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

      {/* ==================================================================== */}
      {/* MODAL 7: EMITIR PROPOSTA CONTRATUAL (DRAFT)                          */}
      {/* ==================================================================== */}
      {contractCreateModalOpen && activeTreatment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.12rem' }}>Emitir Proposta Contratual — #{activeTreatment.caseCode}</h3>
              <button onClick={() => setContractCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateContract} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nome do Pacote Comercial *</label>
                <input required className="form-input" value={pkgName} onChange={(e) => setPkgName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Pares Contratados *</label>
                  <input type="number" min={1} required className="form-input" value={pkgAligners} onChange={(e) => setPkgAligners(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Valor Total (R$) *</label>
                  <input required className="form-input" value={pkgPriceReais} onChange={(e) => setPkgPriceReais(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Modelo de Produção</label>
                  <select className="form-input" value={pkgProductionModel} onChange={(e) => setPkgProductionModel(e.target.value as any)}>
                    <option value="HYBRID" style={{ background: '#0a172a' }}>HYBRID (Lotes Híbridos)</option>
                    <option value="PHASED_BATCHES" style={{ background: '#0a172a' }}>PHASED_BATCHES (Levas Programadas)</option>
                    <option value="ALL_AT_ONCE" style={{ background: '#0a172a' }}>ALL_AT_ONCE (Integral)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Modelo de Entrega</label>
                  <select className="form-input" value={pkgDeliveryModel} onChange={(e) => setPkgDeliveryModel(e.target.value as any)}>
                    <option value="BATCHED" style={{ background: '#0a172a' }}>BATCHED (Por Leva)</option>
                    <option value="SINGLE_SHIPMENT" style={{ background: '#0a172a' }}>SINGLE_SHIPMENT (Remessa Única)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Refinamentos Inclusos</label>
                  <input type="number" min={0} className="form-input" value={pkgIncludedRefinements} onChange={(e) => setPkgIncludedRefinements(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Janela (dias)</label>
                  <input type="number" min={30} className="form-input" value={pkgRefinementWindowDays} onChange={(e) => setPkgRefinementWindowDays(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Par Extra (R$)</label>
                  <input className="form-input" value={pkgExtraAlignerReais} onChange={(e) => setPkgExtraAlignerReais(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>SLA Setup (d úteis)</label>
                  <input type="number" min={1} className="form-input" value={pkgSetupSlaDays} onChange={(e) => setPkgSetupSlaDays(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>SLA Produção</label>
                  <input type="number" min={1} className="form-input" value={pkgProdSlaDays} onChange={(e) => setPkgProdSlaDays(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tipo Dia Prod.</label>
                  <select className="form-input" value={pkgProdSlaDayType} onChange={(e) => setPkgProdSlaDayType(e.target.value as any)}>
                    <option value="BUSINESS_DAYS" style={{ background: '#0a172a' }}>Dias Úteis</option>
                    <option value="CALENDAR_DAYS" style={{ background: '#0a172a' }}>Dias Corridos</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Condições Comerciais / Observações</label>
                <input className="form-input" placeholder="Ex: Parcelado 3x boleto B2B..." value={pkgCommercialNotes} onChange={(e) => setPkgCommercialNotes(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setContractCreateModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Criar Proposta (DRAFT)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 8: ADITIVO CONTRATUAL (AMEND)                                  */}
      {/* ==================================================================== */}
      {contractAmendModalOpen && activeTreatment?.commercialContract && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.12rem' }}>
                Aditivo Contratual — {activeTreatment.commercialContract.contractCode}
              </h3>
              <button onClick={() => setContractAmendModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Gera nova versão auditável (`ContractVersion`) para solicitações futuras. Refinamentos já abertos preservam integralmente sua cobertura e valor congelados.
            </p>
            <form onSubmit={handleAmendContract} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Pares Contratados</label>
                  <input type="number" min={1} required className="form-input" value={amendAligners} onChange={(e) => setAmendAligners(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Valor Total (R$)</label>
                  <input required className="form-input" value={amendPriceReais} onChange={(e) => setAmendPriceReais(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Refinamentos Inclusos</label>
                  <input type="number" min={0} required className="form-input" value={amendIncludedRefinements} onChange={(e) => setAmendIncludedRefinements(Number(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Valor Par Extra (R$)</label>
                  <input required className="form-input" value={amendExtraAlignerReais} onChange={(e) => setAmendExtraAlignerReais(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Justificativa Obrigatória do Aditivo *</label>
                <textarea
                  required
                  minLength={5}
                  rows={2}
                  className="form-input"
                  placeholder="Ex: Expansão contratual de 24 para 30 pares acordada com a clínica..."
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setContractAmendModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Salvar Aditivo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 9: DECISÃO COMERCIAL DE REFINAMENTO                            */}
      {/* ==================================================================== */}
      {refinementDecisionTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>
                Decisão Comercial — Refinamento #{refinementDecisionTarget.sequenceNumber}
              </h3>
              <button onClick={() => setRefinementDecisionTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCommercialRefinementDecision} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Decisão do Financeiro</label>
                <select
                  className="form-input"
                  value={refDecisionApproved ? 'APPROVE' : 'REJECT'}
                  onChange={(e) => setRefDecisionApproved(e.target.value === 'APPROVE')}
                >
                  <option value="APPROVE" style={{ background: '#0a172a' }}>Aprovar Comercialmente</option>
                  <option value="REJECT" style={{ background: '#0a172a' }}>Reprovar / Cancelar Orçamento Extra</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Enquadramento</label>
                  <select
                    className="form-input"
                    value={refDecisionCovered ? 'COVERED' : 'EXTRA'}
                    onChange={(e) => setRefDecisionCovered(e.target.value === 'COVERED')}
                  >
                    <option value="EXTRA" style={{ background: '#0a172a' }}>Cobrança Extra-Franquia</option>
                    <option value="COVERED" style={{ background: '#0a172a' }}>Isento / Coberto pelo Contrato</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Valor Extra Cobrado (R$)</label>
                  <input
                    disabled={refDecisionCovered}
                    className="form-input"
                    value={refDecisionCovered ? '0' : refDecisionExtraReais}
                    onChange={(e) => setRefDecisionExtraReais(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Observação Financeira</label>
                <input
                  className="form-input"
                  placeholder="Ex: Aceite de orçamento extra recebido da clínica..."
                  value={refDecisionNotes}
                  onChange={(e) => setRefDecisionNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setRefinementDecisionTarget(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Registrar Decisão</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 10: OCORRÊNCIA COMERCIAL DIRETA (/contract/events)             */}
      {/* ==================================================================== */}
      {commercialEventModalOpen && activeTreatment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Registrar Ocorrência Comercial — #{activeTreatment.caseCode}</h3>
              <button onClick={() => setCommercialEventModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCommercialEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tipo de Marco</label>
                  <select className="form-input" value={commercialEvType} onChange={(e) => setCommercialEvType(e.target.value as any)}>
                    <option value="BUDGET_SENT" style={{ background: '#0a172a' }}>Orçamento Enviado</option>
                    <option value="CLIENT_APPROVAL_RECORDED" style={{ background: '#0a172a' }}>Aceite Comercial Registrado</option>
                    <option value="COMMERCIAL_NOTE" style={{ background: '#0a172a' }}>Nota / Negociação Comercial</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Canal</label>
                  <select className="form-input" value={commercialEvChannel} onChange={(e) => setCommercialEvChannel(e.target.value as any)}>
                    <option value="WHATSAPP" style={{ background: '#0a172a' }}>WhatsApp</option>
                    <option value="PORTAL" style={{ background: '#0a172a' }}>Portal FyAlign</option>
                    <option value="EMAIL" style={{ background: '#0a172a' }}>E-mail</option>
                    <option value="PHONE" style={{ background: '#0a172a' }}>Telefone</option>
                    <option value="INTERNAL" style={{ background: '#0a172a' }}>Registro Interno</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Resumo Comercial *</label>
                <input
                  required
                  minLength={3}
                  className="form-input"
                  placeholder="Ex: Condição comercial enviada à clínica via WhatsApp..."
                  value={commercialEvSummary}
                  onChange={(e) => setCommercialEvSummary(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Detalhes</label>
                <input
                  className="form-input"
                  placeholder="Opcional"
                  value={commercialEvDetails}
                  onChange={(e) => setCommercialEvDetails(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setCommercialEventModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={submittingAction} className="btn-primary">Registrar Ocorrência</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

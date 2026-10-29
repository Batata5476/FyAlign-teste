'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  WizardDraftState,
  WizardStepNumber,
  FileSlotInfo,
  PatientFormData,
  ClinicalConditionFormData,
  TreatmentPlanFormData,
  ConsentFormData,
  ProfessionalInfo,
} from './types';
import { WizardProgress } from './WizardProgress';
import { StepProfessional } from './StepProfessional';
import { StepPatient } from './StepPatient';
import { StepClinicalCondition } from './StepClinicalCondition';
import { StepTreatmentPlan } from './StepTreatmentPlan';
import { StepClinicalFiles } from './StepClinicalFiles';
import { StepConsent } from './StepConsent';
import { StepReview } from './StepReview';
import {
  MIDLINE_POSITION,
  OCCLUSION_CLASS,
  TREATMENT_ACTION,
  ELASTIC_OPTION,
  CORRECTION_OPTION,
  DIASTEMA_OPTION,
  getCaseFileTypeBySlot,
} from '@/lib/types/clinical';
import { SLOTS_METADATA } from '@/lib/storage/validator';
import { Check, Clock, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const STORAGE_DRAFT_KEY = 'fyalign_case_wizard_draft_id';

const INITIAL_CONDITION: ClinicalConditionFormData = {
  upperMidline: '',
  lowerMidline: '',
  canineRight: '',
  canineLeft: '',
  molarRight: '',
  molarLeft: '',
};

const INITIAL_TREATMENT_PLAN: TreatmentPlanFormData = {
  upperMidline: TREATMENT_ACTION.MAINTAIN,
  lowerMidline: TREATMENT_ACTION.MAINTAIN,
  overjet: TREATMENT_ACTION.MAINTAIN,
  overbite: TREATMENT_ACTION.MAINTAIN,
  archForm: TREATMENT_ACTION.MAINTAIN,
  expansion: TREATMENT_ACTION.MAINTAIN,
  canineRelationship: TREATMENT_ACTION.MAINTAIN,
  molarRelationship: TREATMENT_ACTION.MAINTAIN,
  ipr: false,
  attachment: false,
  intermaxillaryElastic: ELASTIC_OPTION.NO,
  classIICorrection: CORRECTION_OPTION.DO_NOT_CORRECT,
  classIIICorrection: CORRECTION_OPTION.DO_NOT_CORRECT,
  smartAttachments: '',
  diastemas: DIASTEMA_OPTION.NONE,
  additionalInstructions: '',
};

function buildInitialFilesMap(): Record<number, FileSlotInfo> {
  const map: Record<number, FileSlotInfo> = {};
  for (let i = 1; i <= 13; i++) {
    const meta = SLOTS_METADATA[i];
    const type = getCaseFileTypeBySlot(i);
    map[i] = {
      slotNumber: i,
      title: meta?.title || `Slot ${i}`,
      category: meta?.category || 'EXTRAORAL',
      type: type!,
      description: meta?.description || '',
      allowedExtensions: meta?.allowedExtensions || ['.jpg'],
      maxSizeBytes: meta?.maxSizeBytes || 25 * 1024 * 1024,
      required: meta?.required ?? true,
      status: 'EMPTY',
    };
  }
  return map;
}

export function CaseWizard() {
  const [draft, setDraft] = useState<WizardDraftState>({
    caseId: null,
    caseCode: null,
    status: 'DRAFT',
    step: 1,
    professional: null,
    patient: {
      isNew: false,
      fullName: '',
      birthDate: '',
      gender: '',
      phone: '',
      email: '',
    },
    condition: INITIAL_CONDITION,
    treatmentPlan: INITIAL_TREATMENT_PLAN,
    files: buildInitialFilesMap(),
    consent: {
      policyVersion: 'v1.0-2026',
      policyHash: '3f7b8c9a1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      agreed: false,
    },
    isSaving: false,
    lastSavedAt: null,
    errorMessage: null,
  });

  const [maxReachedStep, setMaxReachedStep] = useState<WizardStepNumber>(1);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Sincroniza query params da URL de forma segura
  const updateUrlParams = useCallback((caseId: string | null, step: WizardStepNumber) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (caseId) {
      url.searchParams.set('caseId', caseId);
      localStorage.setItem(STORAGE_DRAFT_KEY, caseId);
    }
    url.searchParams.set('step', String(step));
    window.history.replaceState(null, '', url.toString());
  }, []);

  // 1. Carrega dados do Usuário Autenticado (/api/auth/me) e Caso Existente
  useEffect(() => {
    async function initWizard() {
      setIsLoadingSession(true);
      try {
        // Carrega Sessão
        const meRes = await fetch('/api/auth/me');
        let profInfo: ProfessionalInfo | null = null;
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated && meData.user) {
            profInfo = {
              userId: meData.user.id,
              fullName: meData.user.fullName,
              email: meData.user.email,
              cro: meData.user.professionalIdCro || 'CRO em cadastro',
              clinicId: meData.user.organization?.id || '',
              clinicName: meData.user.organization?.tradeName || 'Clínica FyAlign',
              role: meData.user.role,
              croStatus: meData.user.croStatus || 'PENDING',
            };
          }
        }

        // Verifica caseId na URL ou no LocalStorage (F5 Resilience)
        const params = new URLSearchParams(window.location.search);
        const urlCaseId = params.get('caseId') || params.get('id') || localStorage.getItem(STORAGE_DRAFT_KEY);
        const urlStep = parseInt(params.get('step') || '1', 10) as WizardStepNumber;

        let loadedCase: any = null;
        let loadedFilesMap = buildInitialFilesMap();

        if (urlCaseId) {
          try {
            const caseRes = await fetch(`/api/cases/${urlCaseId}`);
            if (caseRes.ok) {
              const caseData = await caseRes.json();
              loadedCase = caseData.case;
            }

            // Carrega slots de arquivos
            const filesRes = await fetch(`/api/cases/${urlCaseId}/files`);
            if (filesRes.ok) {
              const filesData = await filesRes.json();
              if (Array.isArray(filesData.slots)) {
                filesData.slots.forEach((s: any) => {
                  if (loadedFilesMap[s.slotNumber]) {
                    const isUploaded = s.file?.status === 'UPLOADED';
                    const isImage = s.file?.mimeType?.startsWith('image/') ||
                      ['.jpg', '.jpeg', '.png', '.heic'].some((ext) => (s.file?.originalFileName || '').toLowerCase().endsWith(ext));
                    loadedFilesMap[s.slotNumber] = {
                      ...loadedFilesMap[s.slotNumber],
                      status: isUploaded ? 'UPLOADED' : 'EMPTY',
                      originalFileName: s.file?.originalFileName,
                      fileSizeBytes: s.file?.fileSizeBytes,
                      fileId: s.file?.id,
                      previewUrl: isUploaded && isImage ? `/api/cases/${urlCaseId}/files/${s.file.id}` : undefined,
                    };
                  }
                });
              }
            }
          } catch (e) {
            console.warn('Não foi possível restaurar caso existente:', e);
          }
        }

        if (loadedCase) {
          const patientCode = loadedCase.patient?.id
            ? `PAC-${loadedCase.patient.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}`
            : undefined;

          const patientData: PatientFormData = {
            id: loadedCase.patient?.id,
            isNew: false,
            fullName: loadedCase.patient?.fullName || '',
            birthDate: loadedCase.patient?.birthDate || '',
            gender: loadedCase.patient?.gender || '',
            phone: loadedCase.patient?.phone || '',
            email: loadedCase.patient?.email || '',
            patientCode,
            clinicName: loadedCase.clinic?.tradeName || profInfo?.clinicName,
          };

          const conditionData: ClinicalConditionFormData = loadedCase.clinicalCondition
            ? {
                upperMidline: loadedCase.clinicalCondition.upperMidline,
                lowerMidline: loadedCase.clinicalCondition.lowerMidline,
                canineRight: loadedCase.clinicalCondition.canineRight,
                canineLeft: loadedCase.clinicalCondition.canineLeft,
                molarRight: loadedCase.clinicalCondition.molarRight,
                molarLeft: loadedCase.clinicalCondition.molarLeft,
              }
            : INITIAL_CONDITION;

          const planData: TreatmentPlanFormData = loadedCase.treatmentPlan
            ? {
                upperMidline: loadedCase.treatmentPlan.upperMidline,
                lowerMidline: loadedCase.treatmentPlan.lowerMidline,
                overjet: loadedCase.treatmentPlan.overjet,
                overbite: loadedCase.treatmentPlan.overbite,
                archForm: loadedCase.treatmentPlan.archForm,
                expansion: loadedCase.treatmentPlan.expansion,
                canineRelationship: loadedCase.treatmentPlan.canineRelationship,
                molarRelationship: loadedCase.treatmentPlan.molarRelationship,
                ipr: loadedCase.treatmentPlan.ipr ?? false,
                attachment: loadedCase.treatmentPlan.attachment ?? false,
                intermaxillaryElastic: loadedCase.treatmentPlan.intermaxillaryElastic || 'NO',
                classIICorrection: loadedCase.treatmentPlan.classIICorrection || 'DO_NOT_CORRECT',
                classIIICorrection: loadedCase.treatmentPlan.classIIICorrection || 'DO_NOT_CORRECT',
                smartAttachments: loadedCase.treatmentPlan.smartAttachments || '',
                diastemas: loadedCase.treatmentPlan.diastemas || 'NONE',
                additionalInstructions: loadedCase.treatmentPlan.additionalInstructions || '',
              }
            : INITIAL_TREATMENT_PLAN;

          const latestConsent = loadedCase.consents?.[0];
          const consentData: ConsentFormData = {
            policyVersion: latestConsent?.policyVersion || 'v1.0-2026',
            policyHash: latestConsent?.policyHash || '3f7b8c9a1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
            agreed: !!latestConsent,
            signatureBase64: latestConsent?.signatureKey || undefined,
            signedAt: latestConsent?.acceptedAt,
          };

          // Calcula step alcançado
          let reached: WizardStepNumber = 3;
          if (loadedCase.clinicalCondition) reached = 4;
          if (loadedCase.treatmentPlan) reached = 5;
          if (Object.values(loadedFilesMap).filter((f) => f.status === 'UPLOADED').length === 13) reached = 6;
          if (latestConsent) reached = 7;

          const targetStep = urlStep && urlStep >= 1 && urlStep <= 7 ? urlStep : reached;

          setDraft({
            caseId: loadedCase.id,
            caseCode: loadedCase.caseCode,
            status: loadedCase.status,
            step: targetStep,
            professional: profInfo,
            patient: patientData,
            condition: conditionData,
            treatmentPlan: planData,
            files: loadedFilesMap,
            consent: consentData,
            isSaving: false,
            lastSavedAt: new Date(loadedCase.updatedAt || Date.now()),
            errorMessage: null,
          });

          setMaxReachedStep(Math.max(reached, targetStep) as WizardStepNumber);
          updateUrlParams(loadedCase.id, targetStep);
        } else {
          setDraft((prev) => ({
            ...prev,
            professional: profInfo,
            files: loadedFilesMap,
          }));
        }
      } catch (err) {
        console.error('Falha ao inicializar wizard:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }

    initWizard();
  }, [updateUrlParams]);

  // Avança de passo com atualização de URL
  const goToStep = (stepNumber: WizardStepNumber) => {
    setDraft((prev) => ({ ...prev, step: stepNumber, errorMessage: null }));
    setMaxReachedStep((prev) => Math.max(prev, stepNumber) as WizardStepNumber);
    updateUrlParams(draft.caseId, stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Etapa 1 -> Etapa 2
  const handleStep1Next = () => {
    goToStep(2);
  };

  // Etapa 2 -> Etapa 3 (Persistência do Paciente & Criação / Atualização do Rascunho de Caso)
  const handleStep2Next = async () => {
    if (!draft.patient.id) {
      setDraft((prev) => ({ ...prev, errorMessage: 'Selecione ou cadastre um paciente antes de avançar.' }));
      return;
    }

    setDraft((prev) => ({ ...prev, isSaving: true, errorMessage: null }));
    try {
      const patientId = draft.patient.id;

      // Se o caso ainda não existe, cria rascunho inicial (/api/cases)
      let currentCaseId = draft.caseId;
      let currentCaseCode = draft.caseCode;

      if (!currentCaseId) {
        const caseRes = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            treatedArches: 'BOTH',
          }),
        });

        if (!caseRes.ok) {
          const err = await caseRes.json().catch(() => ({}));
          throw new Error(err.error || 'Erro ao inicializar rascunho de caso.');
        }

        const caseData = await caseRes.json();
        currentCaseId = caseData.case.id;
        currentCaseCode = caseData.case.caseCode;

        setDraft((prev) => ({
          ...prev,
          caseId: currentCaseId,
          caseCode: currentCaseCode,
          lastSavedAt: new Date(),
        }));
      } else {
        // Se o caso já existe (ex: F5 ou troca de paciente), atualiza patientId no rascunho (PATCH)
        const updateRes = await fetch(`/api/cases/${currentCaseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId }),
        });

        if (!updateRes.ok) {
          const err = await updateRes.json().catch(() => ({}));
          throw new Error(err.error || 'Erro ao vincular paciente ao caso clínico.');
        }

        setDraft((prev) => ({
          ...prev,
          lastSavedAt: new Date(),
        }));
      }

      updateUrlParams(currentCaseId, 3);
      goToStep(3);
    } catch (err: any) {
      setDraft((prev) => ({ ...prev, errorMessage: err.message }));
    } finally {
      setDraft((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Etapa 3 -> Etapa 4 (Persistência da Condição Clínica)
  const handleStep3Next = async () => {
    if (!draft.caseId) {
      setDraft((prev) => ({ ...prev, errorMessage: 'Caso não inicializado.' }));
      return;
    }

    const { upperMidline, lowerMidline, canineRight, canineLeft, molarRight, molarLeft } = draft.condition;
    if (!upperMidline || !lowerMidline || !canineRight || !canineLeft || !molarRight || !molarLeft) {
      setDraft((prev) => ({
        ...prev,
        errorMessage: 'Preencha todas as 6 opções de diagnóstico oclusal antes de avançar.',
      }));
      return;
    }

    setDraft((prev) => ({ ...prev, isSaving: true, errorMessage: null }));
    try {
      const res = await fetch(`/api/cases/${draft.caseId}/clinical-condition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft.condition),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar condição clínica.');
      }

      setDraft((prev) => ({ ...prev, lastSavedAt: new Date(), errorMessage: null }));
      updateUrlParams(draft.caseId, 4);
      goToStep(4);
    } catch (err: any) {
      setDraft((prev) => ({ ...prev, errorMessage: err.message }));
    } finally {
      setDraft((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Etapa 4 -> Etapa 5 (Persistência do Plano de Tratamento)
  const handleStep4Next = async () => {
    if (!draft.caseId) {
      setDraft((prev) => ({ ...prev, errorMessage: 'Caso não inicializado.' }));
      return;
    }

    setDraft((prev) => ({ ...prev, isSaving: true, errorMessage: null }));
    try {
      const res = await fetch(`/api/cases/${draft.caseId}/treatment-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft.treatmentPlan),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar plano de tratamento.');
      }

      setDraft((prev) => ({ ...prev, lastSavedAt: new Date() }));
      updateUrlParams(draft.caseId, 5);
      goToStep(5);
    } catch (err: any) {
      setDraft((prev) => ({ ...prev, errorMessage: err.message }));
    } finally {
      setDraft((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Etapa 5 -> Etapa 6 (Arquivos já persistem via upload direto)
  const handleStep5Next = () => {
    updateUrlParams(draft.caseId, 6);
    goToStep(6);
  };

  // Etapa 6 -> Etapa 7 (Persistência do Termo de Consentimento)
  const handleStep6Next = async () => {
    if (!draft.caseId) {
      setDraft((prev) => ({ ...prev, errorMessage: 'Caso não inicializado.' }));
      return;
    }

    setDraft((prev) => ({ ...prev, isSaving: true, errorMessage: null }));
    try {
      const res = await fetch(`/api/cases/${draft.caseId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyVersion: draft.consent.policyVersion,
          policyHash: draft.consent.policyHash,
          scrollCompleted: true,
          signatureKey: draft.consent.signatureBase64 || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao registrar consentimento.');
      }

      setDraft((prev) => ({
        ...prev,
        lastSavedAt: new Date(),
        consent: {
          ...prev.consent,
          signedAt: new Date().toISOString(),
        },
      }));

      updateUrlParams(draft.caseId, 7);
      goToStep(7);
    } catch (err: any) {
      setDraft((prev) => ({ ...prev, errorMessage: err.message }));
    } finally {
      setDraft((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Submissão Final do Caso (/api/cases/:id/submit)
  const handleSubmitCase = async () => {
    if (!draft.caseId) throw new Error('Caso não inicializado.');

    const res = await fetch(`/api/cases/${draft.caseId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyVersion: draft.consent.policyVersion,
        policyHash: draft.consent.policyHash,
        signatureKey: draft.consent.signatureBase64,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao submeter caso clínico.');
    }

    setDraft((prev) => ({
      ...prev,
      status: 'SUBMITTED',
      lastSavedAt: new Date(),
    }));

    // Limpa chave de rascunho ativo do storage
    localStorage.removeItem(STORAGE_DRAFT_KEY);
  };

  // Atualização de Slot de Arquivo
  const handleSlotChange = (slotNumber: number, updated: Partial<FileSlotInfo>) => {
    setDraft((prev) => ({
      ...prev,
      files: {
        ...prev.files,
        [slotNumber]: {
          ...prev.files[slotNumber],
          ...updated,
        },
      },
      lastSavedAt: new Date(),
    }));
  };

  if (isLoadingSession) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--cyan-primary)' }} />
        <p>Carregando ambiente clínico e dados da sessão...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header com Status do Rascunho */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Novo Caso Clínico FyAlign
            </h1>
            {draft.caseCode && (
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  background: 'var(--badge-setup-bg)',
                  color: 'var(--cyan-primary)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--badge-setup-border)',
                }}
              >
                {draft.caseCode}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '2px' }}>
            {draft.patient.fullName ? `Paciente: ${draft.patient.fullName}` : 'Prescrição digital de alinhadores transparentes'}
          </p>
        </div>

        {/* Indicador de Salvamento Automático */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
          {draft.isSaving ? (
            <span style={{ color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={14} className="spin" />
              <span>Salvando alterações...</span>
            </span>
          ) : draft.lastSavedAt ? (
            <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Check size={14} />
              <span>Rascunho salvo às {draft.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} />
              <span>Salvamento contínuo habilitado</span>
            </span>
          )}
        </div>
      </div>

      {/* Barra de Progresso em 7 Etapas */}
      <WizardProgress
        currentStep={draft.step}
        maxReachedStep={maxReachedStep}
        onStepClick={goToStep}
      />

      {/* Banner de Erro Global */}
      {draft.errorMessage && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'var(--badge-danger-bg)',
            border: '1px solid var(--badge-danger-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--badge-danger-text)',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{draft.errorMessage}</span>
        </div>
      )}

      {/* Renderização Condicional da Etapa Ativa */}
      {draft.step === 1 && (
        <StepProfessional
          professional={draft.professional}
          onNext={handleStep1Next}
        />
      )}

      {draft.step === 2 && (
        <StepPatient
          patientData={draft.patient}
          clinicName={draft.professional?.clinicName || 'Clínica OdontoPrime Ortodontia'}
          onChange={(p) => setDraft((prev) => ({ ...prev, patient: p }))}
          onNext={handleStep2Next}
          onBack={() => goToStep(1)}
        />
      )}

      {draft.step === 3 && (
        <StepClinicalCondition
          caseId={draft.caseId}
          conditionData={draft.condition}
          onChange={(c) => setDraft((prev) => ({ ...prev, condition: c, errorMessage: null }))}
          onNext={handleStep3Next}
          onBack={() => goToStep(2)}
          isSaving={draft.isSaving}
        />
      )}

      {draft.step === 4 && (
        <StepTreatmentPlan
          planData={draft.treatmentPlan}
          onChange={(t) => setDraft((prev) => ({ ...prev, treatmentPlan: t }))}
          onNext={handleStep4Next}
          onBack={() => goToStep(3)}
        />
      )}

      {draft.step === 5 && (
        <StepClinicalFiles
          caseId={draft.caseId}
          files={draft.files}
          onSlotChange={handleSlotChange}
          onNext={handleStep5Next}
          onBack={() => goToStep(4)}
        />
      )}

      {draft.step === 6 && (
        <StepConsent
          consentData={draft.consent}
          onChange={(c) => setDraft((prev) => ({ ...prev, consent: c }))}
          onNext={handleStep6Next}
          onBack={() => goToStep(5)}
        />
      )}

      {draft.step === 7 && (
        <StepReview
          draft={draft}
          onGoToStep={goToStep}
          onSubmitCase={handleSubmitCase}
          onBack={() => goToStep(6)}
        />
      )}
    </div>
  );
}

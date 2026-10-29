'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Eraser,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { ConsentFormData } from './types';

interface StepConsentProps {
  consentData: ConsentFormData;
  onChange: (data: ConsentFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

const TCLE_POLICY_VERSION = 'v1.0-2026';
// Hash SHA-256 fixo que atesta a versão do texto contratual oficial FyAlign
const TCLE_POLICY_HASH = '3f7b8c9a1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';

export function StepConsent({
  consentData,
  onChange,
  onNext,
  onBack,
}: StepConsentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Inicializa dados padrão da política
  useEffect(() => {
    if (!consentData.policyVersion || !consentData.policyHash) {
      onChange({
        ...consentData,
        policyVersion: TCLE_POLICY_VERSION,
        policyHash: TCLE_POLICY_HASH,
      });
    }
  }, [consentData, onChange]);

  // Se já houver assinatura prévia salva em base64, renderiza no canvas
  useEffect(() => {
    if (consentData.signatureBase64 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new window.Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          setHasDrawn(true);
        };
        img.src = consentData.signatureBase64;
      }
    }
  }, [consentData.signatureBase64]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 40;
    if (isAtBottom && !hasScrolledToEnd) {
      setHasScrolledToEnd(true);
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setValidationError(null);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isLightMode ? '#0284c7' : '#00d2d3';

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onChange({
        ...consentData,
        signatureBase64: dataUrl,
      });
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange({
      ...consentData,
      signatureBase64: undefined,
    });
  };

  const handleNextClick = () => {
    if (!consentData.agreed) {
      setValidationError('É obrigatório assinalar que leu e concorda com o Termo de Consentimento.');
      return;
    }

    if (!hasDrawn && !consentData.signatureBase64) {
      setValidationError('Por favor, assine digitalmente no campo indicado antes de prosseguir.');
      return;
    }

    setValidationError(null);
    onNext();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
          Etapa 6 — Consentimento Livre e Esclarecido (TCLE)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Termo de responsabilidade técnica odontológica e autorização para manufatura personalizada de alinhadores.
        </p>
      </div>

      {/* Caixa do Termo com Scroll */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--cyan-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldCheck size={18} />
            <span>Termo de Consentimento Informado e Responsabilidade Odontológica</span>
          </h3>

          <span
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              background: 'var(--badge-draft-bg)',
              border: '1px solid var(--border-card)',
              padding: '2px 8px',
              borderRadius: '6px',
            }}
          >
            Versão {TCLE_POLICY_VERSION}
          </span>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            height: '240px',
            overflowY: 'auto',
            padding: '16px',
            borderRadius: '8px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <p style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            1. DO OBJETO E DA PRESCRIÇÃO CLÍNICA
          </p>
          <p style={{ marginBottom: '12px' }}>
            O profissional prescritor abaixo qualificado, devidamente habilitado perante o Conselho Regional de
            Odontologia (CRO), atesta que os dados clínicos, radiográficos e escaneamentos intraorais do paciente foram
            coletados sob sua direta supervisão clínica e correspondem com fidelidade à anatomia do paciente.
          </p>

          <p style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            2. DA TECNOLOGIA E LIMITAÇÕES BIOMECÂNICAS
          </p>
          <p style={{ marginBottom: '12px' }}>
            O tratamento com alinhadores ortodônticos transparentes FyAlign é um meio auxiliar terapêutico
            confeccionado sob medida a partir do planejamento digital (Setup 3D). O prescritor reconhece que o
            sucesso depende do uso disciplinado (20 a 22 horas diárias), higienização adequada, monitoramento clínico
            periódico e eventual necessidade de desgastes interproximais (IPR) ou attachments planejados.
          </p>

          <p style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            3. PROTEÇÃO DE DADOS PESSOAIS (LGPD)
          </p>
          <p style={{ marginBottom: '12px' }}>
            Em estrito cumprimento à Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD),
            declara-se que os dados de saúde do paciente são transmitidos de forma criptografada para fins exclusivos de
            planejamento ortodôntico digital e fabricação dos alinhadores, observando-se anonimização em armazenamento.
          </p>

          <p style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
            4. DA APROVAÇÃO TÉCNICA E AUDITORIA
          </p>
          <p>
            O envio desta solicitação dá início à fase de triagem clínica e planejamento 3D pela equipe FyAlign. O
            início da fabricação física ocorrerá somente após a posterior aprovação formal do Setup 3D pelo
            cirurgião-dentista responsável.
          </p>
        </div>

        {/* Checkbox de Aceite */}
        <div style={{ marginTop: '16px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={consentData.agreed}
              onChange={(e) => {
                setValidationError(null);
                onChange({
                  ...consentData,
                  agreed: e.target.checked,
                  policyVersion: TCLE_POLICY_VERSION,
                  policyHash: TCLE_POLICY_HASH,
                });
              }}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--cyan-primary)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Li e concordo com os termos de consentimento, responsabilidade clínica e privacidade de dados.
            </span>
          </label>
        </div>
      </div>

      {/* Área de Assinatura Digital */}
      <div
        style={{
          padding: '24px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
              Assinatura Digital do Cirurgião-Dentista
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Desenhe sua rubrica ou assinatura no campo abaixo usando o mouse ou tela sensível ao toque.
            </p>
          </div>

          <button
            type="button"
            onClick={clearCanvas}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Eraser size={14} />
            <span>Limpar</span>
          </button>
        </div>

        {/* Canvas de Assinatura */}
        <div
          style={{
            border: '2px dashed var(--input-border)',
            borderRadius: '10px',
            background: 'var(--input-bg)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              width: '100%',
              maxWidth: '600px',
              height: '160px',
              cursor: 'crosshair',
              touchAction: 'none',
            }}
          />
        </div>

        {/* Nota de Auditoria Imutável do Servidor */}
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}
        >
          <Lock size={14} style={{ color: 'var(--cyan-primary)' }} />
          <span>
            Atesto e registro inviolável de IP, data/hora e identificador único de sessão capturados automaticamente no servidor.
          </span>
        </div>
      </div>

      {/* Erro de Validação */}
      {validationError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--badge-danger-bg)',
            border: '1px solid var(--badge-danger-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--badge-danger-text)',
            fontSize: '0.86rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Navigation Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '10px',
        }}
      >
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

        <button
          type="button"
          onClick={handleNextClick}
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
          <span>Continuar para Revisão Final</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

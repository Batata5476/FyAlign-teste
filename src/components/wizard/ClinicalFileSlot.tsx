'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Box,
  Image as ImageIcon,
  FileCheck,
  RefreshCw,
  Trash2,
  Loader2,
  Eye,
  Maximize2,
  X,
  ExternalLink,
} from 'lucide-react';
import { FileSlotInfo } from './types';
import { validateFileForSlot } from '@/lib/storage/validator';
import { SlotSchematicDrawing } from './SlotSchematicDrawing';
import { STLModalViewer } from '@/components/viewer3d/STLModalViewer';

interface ClinicalFileSlotProps {
  caseId: string | null;
  slotInfo: FileSlotInfo;
  onSlotChange: (slotNumber: number, updated: Partial<FileSlotInfo>) => void;
  disabled?: boolean;
}

export function ClinicalFileSlot({
  caseId,
  slotInfo,
  onSlotChange,
  disabled = false,
}: ClinicalFileSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [is3DViewerOpen, setIs3DViewerOpen] = useState(false);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);

  // Identidade visual por categoria com alto contraste em Light e Dark
  const getCategoryMeta = (category: string) => {
    switch (category) {
      case 'SCAN_3D':
        return {
          icon: Box,
          label: 'Scan 3D',
          badgeBg: 'rgba(0, 210, 211, 0.12)',
          badgeText: 'var(--cyan-primary)',
          badgeBorder: 'rgba(0, 210, 211, 0.3)',
        };
      case 'RADIOGRAPH':
        return {
          icon: FileCheck,
          label: 'Radiografia',
          badgeBg: 'rgba(147, 51, 234, 0.1)',
          badgeText: '#9333ea',
          badgeBorder: 'rgba(147, 51, 234, 0.25)',
        };
      case 'INTRAORAL':
        return {
          icon: ImageIcon,
          label: 'Intraoral',
          badgeBg: 'rgba(2, 132, 199, 0.1)',
          badgeText: '#0284c7',
          badgeBorder: 'rgba(2, 132, 199, 0.25)',
        };
      case 'EXTRAORAL':
      default:
        return {
          icon: ImageIcon,
          label: 'Extraoral',
          badgeBg: 'rgba(99, 102, 241, 0.1)',
          badgeText: '#6366f1',
          badgeBorder: 'rgba(99, 102, 241, 0.25)',
        };
    }
  };

  const catMeta = getCategoryMeta(slotInfo.category);
  const CatIcon = catMeta.icon;

  const is3D =
    slotInfo.category === 'SCAN_3D' ||
    ['.stl', '.ply', '.obj'].some((ext) =>
      (slotInfo.originalFileName || '').toLowerCase().endsWith(ext)
    );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  // URL efetiva de preview (preview local gerado ou rota do backend)
  const effectivePreviewUrl =
    slotInfo.previewUrl ||
    (!is3D && caseId && slotInfo.fileId
      ? `/api/cases/${caseId}/files/${slotInfo.fileId}`
      : undefined);

  const handleFileSelection = async (file: File) => {
    setSelectedFileObj(file);

    if (!caseId) {
      onSlotChange(slotInfo.slotNumber, {
        status: 'ERROR',
        errorMessage: 'Caso ainda não inicializado. Avance as etapas iniciais.',
      });
      return;
    }

    // 1. Validação local (F2.13)
    const localValidation = validateFileForSlot(
      slotInfo.slotNumber,
      file.name,
      file.size
    );

    if (!localValidation.valid) {
      onSlotChange(slotInfo.slotNumber, {
        status: 'ERROR',
        errorMessage: localValidation.error || 'Arquivo incompatível com as regras deste slot.',
      });
      return;
    }

    // Gera preview imediato para arquivos de imagem
    const isImageFile =
      file.type.startsWith('image/') ||
      ['.jpg', '.jpeg', '.png', '.heic'].some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
    const localPreviewUrl = isImageFile ? URL.createObjectURL(file) : undefined;

    // Marca como UPLOADING
    onSlotChange(slotInfo.slotNumber, {
      status: 'UPLOADING',
      originalFileName: file.name,
      fileSizeBytes: file.size,
      previewUrl: localPreviewUrl,
      progressPercent: 20,
      errorMessage: undefined,
    });

    try {
      // 2. Solicita Presigned URL (F2.03)
      const mimeType = file.type || 'application/octet-stream';
      const uploadUrlRes = await fetch(`/api/cases/${caseId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotNumber: slotInfo.slotNumber,
          fileName: file.name,
          mimeType,
          fileSizeBytes: file.size,
        }),
      });

      if (!uploadUrlRes.ok) {
        const errJson = await uploadUrlRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao gerar URL de upload');
      }

      const { uploadUrl, fileId } = await uploadUrlRes.json();

      onSlotChange(slotInfo.slotNumber, {
        progressPercent: 50,
        fileId,
      });

      // 3. Upload direto via HTTP PUT (S3 ou Storage Vault Local)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error('Falha na transmissão do arquivo para o servidor de armazenamento.');
      }

      const etag = putRes.headers.get('ETag') || undefined;

      onSlotChange(slotInfo.slotNumber, {
        progressPercent: 80,
      });

      // 4. Confirmação do upload no backend
      const confirmRes = await fetch(`/api/cases/${caseId}/files/${fileId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etag }),
      });

      if (!confirmRes.ok) {
        const errJson = await confirmRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao confirmar persistência do arquivo.');
      }

      // 5. Sucesso! Slot concluído
      onSlotChange(slotInfo.slotNumber, {
        status: 'UPLOADED',
        progressPercent: 100,
        fileId,
        previewUrl: localPreviewUrl || (caseId && fileId && isImageFile ? `/api/cases/${caseId}/files/${fileId}` : undefined),
        errorMessage: undefined,
      });
    } catch (err: any) {
      console.error(`Erro no upload do slot ${slotInfo.slotNumber}:`, err);
      onSlotChange(slotInfo.slotNumber, {
        status: 'ERROR',
        errorMessage: err.message || 'Erro inesperado durante o upload.',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async () => {
    if (!caseId || !slotInfo.fileId) {
      setSelectedFileObj(null);
      onSlotChange(slotInfo.slotNumber, {
        status: 'EMPTY',
        originalFileName: undefined,
        fileSizeBytes: undefined,
        fileId: undefined,
        previewUrl: undefined,
      });
      return;
    }

    try {
      const res = await fetch(`/api/cases/${caseId}/files/${slotInfo.fileId}/confirm`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Não foi possível remover o arquivo');
      }

      setSelectedFileObj(null);
      onSlotChange(slotInfo.slotNumber, {
        status: 'EMPTY',
        originalFileName: undefined,
        fileSizeBytes: undefined,
        fileId: undefined,
        previewUrl: undefined,
        errorMessage: undefined,
      });
    } catch (err: any) {
      onSlotChange(slotInfo.slotNumber, {
        errorMessage: err.message || 'Erro ao remover arquivo',
      });
    }
  };

  const isUploaded = slotInfo.status === 'UPLOADED';
  const isUploading = slotInfo.status === 'UPLOADING';
  const isError = slotInfo.status === 'ERROR';

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px',
          borderRadius: '12px',
          background: isUploaded
            ? 'var(--bg-card)'
            : isDragging
            ? 'var(--upload-drag-bg)'
            : 'var(--bg-card)',
          border: isUploaded
            ? '1.5px solid #10b981'
            : isDragging
            ? '1.5px dashed var(--cyan-primary)'
            : isError
            ? '1.5px solid var(--badge-danger-border)'
            : isHovered
            ? '1.5px solid var(--border-hover)'
            : '1px solid var(--border-card)',
          boxShadow: isUploaded
            ? '0 4px 14px rgba(16, 185, 129, 0.12)'
            : isHovered
            ? 'var(--shadow-card)'
            : 'var(--shadow-sm)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          minHeight: '260px',
          position: 'relative',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={slotInfo.allowedExtensions.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelection(e.target.files[0]);
            }
          }}
        />

        {/* Top Header do Slot */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Número do Slot */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '28px',
                  height: '24px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  background: isUploaded ? '#10b981' : 'var(--badge-draft-bg)',
                  color: isUploaded ? '#ffffff' : 'var(--text-main)',
                  border: isUploaded ? '1px solid #10b981' : '1px solid var(--border-card)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                #{slotInfo.slotNumber}
              </span>

              {/* Categoria do Slot (Pill) */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: catMeta.badgeBg,
                  color: catMeta.badgeText,
                  border: `1px solid ${catMeta.badgeBorder}`,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                }}
              >
                <CatIcon size={12} />
                <span>{catMeta.label}</span>
              </span>
            </div>

            {/* Status Badge */}
            {isUploaded && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem',
                  color: '#059669',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                <CheckCircle2 size={13} />
                <span>Concluído</span>
              </span>
            )}
            {isUploading && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem',
                  color: 'var(--cyan-primary)',
                  fontWeight: 700,
                  background: 'var(--badge-setup-bg)',
                  border: '1px solid var(--badge-setup-border)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                <Loader2 size={13} className="spin" />
                <span>Enviando</span>
              </span>
            )}
          </div>

          {/* Título e Descrição */}
          <h4
            style={{
              fontSize: '0.94rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '3px',
              lineHeight: 1.3,
            }}
          >
            {slotInfo.title}
          </h4>
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.35,
              marginBottom: '10px',
            }}
          >
            {slotInfo.description}
          </p>
        </div>

        {/* ÁREA CENTRAL: DESENHO SIMPLES (EMPTY) vs PREVIEW REAL (UPLOADED) */}
        <div style={{ margin: '6px 0' }}>
          {isUploaded ? (
            /* ==============================================================
               ESTADO COM PREVIEW DO ARQUIVO APÓS INSERIDO NO SLOT
               ============================================================== */
            <div
              style={{
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
              }}
            >
              {/* Preview de Imagem (Fotos Extraorais, Intraorais e Radiografias) */}
              {!is3D && effectivePreviewUrl ? (
                <div
                  style={{
                    position: 'relative',
                    height: '130px',
                    width: '100%',
                    background: '#090d16',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsLightboxOpen(true)}
                  title="Clique para ampliar a prévia"
                >
                  <img
                    src={effectivePreviewUrl}
                    alt={slotInfo.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                    }}
                  >
                    <Maximize2 size={13} />
                    <span>Ampliar</span>
                  </div>
                </div>
              ) : is3D ? (
                /* Preview para Modelo 3D (.STL, .PLY, .OBJ) */
                <div
                  style={{
                    height: '130px',
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(8, 20, 42, 0.8) 0%, rgba(13, 31, 60, 0.8) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    position: 'relative',
                  }}
                >
                  <SlotSchematicDrawing slotNumber={slotInfo.slotNumber} height={60} width={90} />
                  <button
                    type="button"
                    onClick={() => setIs3DViewerOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(0, 210, 211, 0.2)',
                      border: '1px solid rgba(0, 210, 211, 0.5)',
                      color: 'var(--cyan-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Box size={13} />
                    <span>Visualizador 3D Interativo</span>
                  </button>
                </div>
              ) : (
                /* Fallback de Imagem sem URL */
                <div
                  style={{
                    height: '110px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                  }}
                >
                  <SlotSchematicDrawing slotNumber={slotInfo.slotNumber} height={80} />
                </div>
              )}

              {/* Barra de Informações do Arquivo Inserido */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--input-bg)',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={slotInfo.originalFileName}
                  >
                    {slotInfo.originalFileName || 'Arquivo enviado'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatFileSize(slotInfo.fileSizeBytes)} • Validado
                  </div>
                </div>

                {/* Ações de Substituir e Excluir */}
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    title="Substituir arquivo"
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RefreshCw size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={disabled}
                    title="Excluir arquivo"
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'var(--badge-danger-bg)',
                      border: '1px solid var(--badge-danger-border)',
                      color: 'var(--badge-danger-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ) : isUploading ? (
            /* ==============================================================
               ESTADO DE UPLOAD EM ANDAMENTO
               ============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 0' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: 'var(--cyan-primary)',
                  fontWeight: 600,
                }}
              >
                <span>Transmitindo arquivo com integridade...</span>
                <span>{slotInfo.progressPercent || 20}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '7px',
                  borderRadius: '999px',
                  background: 'var(--input-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${slotInfo.progressPercent || 20}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--cyan-primary) 0%, #0284c7 100%)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {slotInfo.originalFileName} ({formatFileSize(slotInfo.fileSizeBytes)})
              </span>
            </div>
          ) : (
            /* ==============================================================
               ESTADO VAZIO: DESENHO SIMPLES ESPECÍFICO DO ARQUIVO + DROPZONE
               ============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* DESENHO SIMPLES ANATÔMICO CORRESPONDENTE AO ARQUIVO */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  borderRadius: '10px',
                  background: isHovered ? 'var(--upload-drag-bg)' : 'var(--input-bg)',
                  border: isHovered
                    ? '1.5px dashed var(--cyan-primary)'
                    : '1px solid var(--border-subtle)',
                  padding: '8px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Clique ou arraste o arquivo aqui"
              >
                <SlotSchematicDrawing
                  slotNumber={slotInfo.slotNumber}
                  height={94}
                />
              </div>

              {/* Botão de Upload / Dropzone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: isHovered ? 'var(--upload-drag-bg)' : 'var(--upload-empty-bg)',
                  border: isHovered
                    ? '1.5px dashed var(--cyan-primary)'
                    : '1.5px dashed var(--input-border)',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <UploadCloud size={16} style={{ color: 'var(--cyan-primary)' }} />
                <span>Selecionar arquivo</span>
              </button>

              {/* Metadados: Formatos e Tamanho */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.73rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ fontWeight: 500 }}>{slotInfo.allowedExtensions.join(', ')}</span>
                <span
                  style={{
                    background: 'var(--input-bg)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  Até {formatFileSize(slotInfo.maxSizeBytes)}
                </span>
              </div>
            </div>
          )}

          {/* Mensagem de Erro com Alto Contraste */}
          {isError && slotInfo.errorMessage && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--badge-danger-bg)',
                border: '1px solid var(--badge-danger-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--badge-danger-text)',
                fontSize: '0.76rem',
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{slotInfo.errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* ==============================================================
          MODAL LIGHTBOX: PRÉVIA AMPLIADA DA IMAGEM
          ============================================================== */}
      {isLightboxOpen && effectivePreviewUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '850px',
              width: '100%',
              borderRadius: '16px',
              padding: '20px',
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border-card)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Prévia: #{slotInfo.slotNumber} — {slotInfo.title}
                </h4>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {slotInfo.originalFileName} ({formatFileSize(slotInfo.fileSizeBytes)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                width: '100%',
                maxHeight: '65vh',
                background: '#090d16',
                borderRadius: '10px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={effectivePreviewUrl}
                alt={slotInfo.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL VIEWER: PRÉVIA 3D DE MALHA (STL/PLY/OBJ)
          ============================================================== */}
      {is3DViewerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setIs3DViewerOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '900px',
              width: '100%',
              borderRadius: '16px',
              padding: '24px',
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border-card)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Visualizador 3D: #{slotInfo.slotNumber} — {slotInfo.title}
                </h4>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {slotInfo.originalFileName} ({formatFileSize(slotInfo.fileSizeBytes)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIs3DViewerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <STLModalViewer
              slotNumber={slotInfo.slotNumber}
              fileName={slotInfo.originalFileName}
              fileSizeBytes={slotInfo.fileSizeBytes}
              fileUrl={caseId && slotInfo.fileId ? `/api/cases/${caseId}/files/${slotInfo.fileId}` : undefined}
              fileBlob={selectedFileObj || undefined}
              isUpper={slotInfo.slotNumber !== 12}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setIs3DViewerOpen(false)}
                className="btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                Fechar Visualizador 3D
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

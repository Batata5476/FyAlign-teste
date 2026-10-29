'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  RefreshCw,
  Eye,
  Box,
  Image as ImageIcon,
  PlusCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { SlotSpecification } from '@/lib/storage/validator';
import { STLModalViewer } from '@/components/viewer3d/STLModalViewer';

interface FileCardProps {
  slot: SlotSpecification & { file: any | null };
  caseId: string;
  onFileUploaded: () => void;
  onFileDeleted: () => void;
}

export function FileCard({ slot, caseId, onFileUploaded, onFileDeleted }: FileCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState<{ loaded: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isUploaded = slot.file && slot.file.status === 'UPLOADED';
  const is3D = slot.category === 'SCAN_3D' ||
    ['.stl', '.ply', '.obj'].some((ext) => (slot.file?.originalFileName || '').toLowerCase().endsWith(ext));
  const isRadiograph = slot.category === 'RADIOGRAPH';

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      startUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      startUpload(file);
    }
  };

  const startUpload = async (file: File) => {
    setErrorMessage(null);

    // Validação preliminar client-side
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!slot.allowedExtensions.includes(ext)) {
      setErrorMessage(`Formato inválido (${ext}). Formatos aceitos: ${slot.allowedExtensions.join(', ')}`);
      return;
    }

    if (file.size > slot.maxSizeBytes) {
      const maxMb = Math.round(slot.maxSizeBytes / (1024 * 1024));
      setErrorMessage(`Arquivo excede o limite de ${maxMb} MB.`);
      return;
    }

    // Gera preview local para imagens
    if (!is3D && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setLocalPreviewUrl(url);
    }

    try {
      setUploadProgress(0);
      setUploadedBytes({ loaded: 0, total: file.size });

      // 1. Solicita Presigned URL
      const presignedRes = await fetch(`/api/cases/${caseId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotNumber: slot.slotNumber,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
        }),
      });

      const presignedData = await presignedRes.json();
      if (!presignedRes.ok) {
        throw new Error(presignedData.error || 'Erro ao gerar URL de upload');
      }

      const { uploadUrl, fileId } = presignedData;

      // 2. Upload Direto via XMLHttpRequest para acompanhamento de progresso real em streaming
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        if (file.type) {
          xhr.setRequestHeader('Content-Type', file.type);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
            setUploadedBytes({ loaded: event.loaded, total: event.total });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Falha no upload para o storage (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('Erro de conexão ao enviar arquivo'));
        xhr.send(file);
      });

      // 3. Confirmação do Upload na API
      const confirmRes = await fetch(`/api/cases/${caseId}/files/${fileId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!confirmRes.ok) {
        throw new Error('Falha ao confirmar metadados do arquivo');
      }

      setUploadProgress(null);
      setUploadedBytes(null);
      onFileUploaded();
    } catch (err: any) {
      console.error(err);
      setUploadProgress(null);
      setUploadedBytes(null);
      setErrorMessage(err.message || 'Erro durante o upload');
    }
  };

  const handleDelete = async () => {
    if (!slot.file?.id) return;
    if (!confirm('Deseja realmente remover este arquivo?')) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/files/${slot.file.id}/confirm`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLocalPreviewUrl(null);
        onFileDeleted();
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        background: isDragging
          ? 'var(--upload-drag-bg)'
          : isUploaded
          ? 'var(--bg-card)'
          : 'var(--upload-empty-bg)',
        border: isDragging
          ? '2px dashed var(--cyan-primary)'
          : isUploaded
          ? '1px solid var(--badge-approved-border)'
          : errorMessage
          ? '1px solid var(--crimson-danger)'
          : '1px dashed var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '230px',
        position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isUploaded ? 'var(--shadow-card)' : 'var(--shadow-sm)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept={slot.allowedExtensions.join(',')}
        onChange={handleFileChange}
      />

      {/* Top Header do Card: Número do Slot + Badge de Categoria */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: isUploaded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 210, 211, 0.15)',
              color: isUploaded ? 'var(--emerald-success)' : 'var(--cyan-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.82rem'
            }}>
              {String(slot.slotNumber).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {is3D ? 'Malha 3D' : isRadiograph ? 'Exame Rx' : 'Foto'}
            </span>
          </div>

          <div>
            {isUploaded ? (
              <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                <CheckCircle2 size={11} />
                Enviado
              </span>
            ) : slot.required ? (
              <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                Obrigatório
              </span>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Opcional
              </span>
            )}
          </div>
        </div>

        {/* Título & Descrição Anatômica */}
        <h4 style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
          {slot.title}
        </h4>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.35, marginBottom: '12px' }}>
          {slot.description}
        </p>
      </div>

      {/* Conteúdo Central: Estado de Carregamento / Arquivo Concluído / Dropzone */}
      <div style={{ margin: '8px 0' }}>
        {uploadProgress !== null ? (
          /* Estado 2: Carregando (F2.09) */
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--cyan-primary)', fontWeight: 600 }}>Enviando arquivo...</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{uploadProgress}%</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  background: 'linear-gradient(90deg, var(--cyan-primary), var(--blue-vibrant))',
                  transition: 'width 0.2s ease',
                  boxShadow: '0 0 8px var(--cyan-primary)'
                }}
              />
            </div>
            {uploadedBytes && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px', textAlign: 'right' }}>
                {formatSize(uploadedBytes.loaded)} de {formatSize(uploadedBytes.total)}
              </p>
            )}
          </div>
        ) : isUploaded ? (
          /* Estado 3: Concluído com Sucesso (F2.10) */
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: is3D ? 'rgba(0, 210, 211, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {is3D ? <Box size={18} color="var(--cyan-primary)" /> : <ImageIcon size={18} color="var(--blue-vibrant)" />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {slot.file.originalFileName}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  {formatSize(slot.file.fileSizeBytes)}
                </p>
              </div>
            </div>

            {/* Ações: Preview Modal e Excluir (F2.12) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                title="Pré-visualizar Arquivo"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '4px'
                }}
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                title="Remover Arquivo"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '4px'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Estado 1: Pendente / Dropzone Receptiva (F2.08) */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.76rem',
            color: 'var(--text-dim)'
          }}>
            <UploadCloud size={16} color="var(--cyan-primary)" />
            <span>Arraste e solte o arquivo aqui</span>
          </div>
        )}

        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            color: '#fca5a5',
            marginTop: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <AlertCircle size={14} color="var(--crimson-danger)" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Botões Inferiores do Card: Botão de Inserir e Substituir */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {isUploaded ? (
          <button
            type="button"
            onClick={handleSelectClick}
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.78rem', padding: '7px 10px' }}
          >
            <RefreshCw size={13} />
            <span>Substituir Arquivo</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSelectClick}
            className="btn-primary"
            style={{ width: '100%', fontSize: '0.8rem', padding: '9px 12px' }}
          >
            <PlusCircle size={15} />
            <span>Inserir Arquivo</span>
          </button>
        )}
      </div>

      {/* Modal de Pré-Visualização (F2.12) */}
      {previewOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '2px' }}>{slot.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {slot.file?.originalFileName}
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              minHeight: '260px',
              background: 'var(--bg-main)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {localPreviewUrl ? (
                <img
                  src={localPreviewUrl}
                  alt={slot.title}
                  style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              ) : is3D ? (
                <STLModalViewer
                  slotNumber={slot.slotNumber}
                  fileName={slot.file?.originalFileName || selectedFile?.name}
                  fileSizeBytes={slot.file?.fileSizeBytes || selectedFile?.size}
                  fileUrl={slot.file?.id ? `/api/cases/${caseId}/files/${slot.file.id}` : undefined}
                  fileBlob={selectedFile || undefined}
                  isUpper={slot.slotNumber !== 12}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <ImageIcon size={48} color="var(--blue-vibrant)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Exame Clínico Armazenado com Sucesso</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Tamanho: {formatSize(slot.file?.fileSizeBytes)} • Status: Auditado
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', flexWrap: 'wrap', gap: '10px' }}>
              {is3D ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false);
                    router.push(`/dashboard/cases/${caseId}/setup`);
                  }}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  <Box size={14} />
                  <span>Abrir Visualizador 3D do Setup →</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Fechar Prévia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

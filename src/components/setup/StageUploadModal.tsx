'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  FileCheck2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
  FolderUp,
  FileText,
  Info,
} from 'lucide-react';
import { analyzeStageFiles, parseStageFileName, ParsedStageFile } from '@/lib/three/stageParser';

interface StageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseCode: string;
  nextVersion: number;
  onSuccess: (newSetup: any) => void;
}

interface ValidatedFileItem {
  file: File;
  parsed: ParsedStageFile | null;
  isValidGeometry: boolean;
  geometryError?: string;
  triangleCount?: number;
}

export function StageUploadModal({
  isOpen,
  onClose,
  caseId,
  caseCode,
  nextVersion,
  onSuccess,
}: StageUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileItems, setFileItems] = useState<ValidatedFileItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [unrecognizedFiles, setUnrecognizedFiles] = useState<string[]>([]);
  const [plannerNotes, setPlannerNotes] = useState('');
  const [isValidated, setIsValidated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validação rápida de geometria STL (Binário ou ASCII) no cliente
  const checkStlGeometry = async (file: File): Promise<{ valid: boolean; error?: string; triangles?: number }> => {
    if (file.size < 84) {
      return { valid: false, error: 'Arquivo corrompido ou truncado (< 84 bytes)' };
    }

    try {
      const headerSlice = await file.slice(0, 84).arrayBuffer();
      const view = new DataView(headerSlice);
      const triangleCount = view.getUint32(80, true);
      const expectedBinarySize = 84 + triangleCount * 50;

      if (file.size === expectedBinarySize) {
        return { valid: true, triangles: triangleCount };
      }

      // Fallback ASCII
      const textSlice = await file.slice(0, 256).text();
      if (textSlice.toLowerCase().includes('solid')) {
        return { valid: true, triangles: undefined };
      }

      return { valid: false, error: 'Estrutura geométrica STL inválida (tamanho não confere com contagem de triângulos)' };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Erro ao inspecionar geometria' };
    }
  };

  const processFileList = useCallback(async (files: File[]) => {
    setUploadError(null);
    setIsValidating(true);
    setSelectedFiles(files);

    const fileSummaries = files.map((f) => ({ name: f.name, size: f.size }));
    const analysis = analyzeStageFiles(fileSummaries);

    const items: ValidatedFileItem[] = [];
    const errors: string[] = [...analysis.errors];

    for (const file of files) {
      const parsed = parseStageFileName(file.name, file.size);
      if (!parsed) {
        items.push({
          file,
          parsed: null,
          isValidGeometry: false,
          geometryError: 'Nome do arquivo não segue os padrões aceitos (ex: 1-S-.stl / 1-I-.stl ou stage_0_upper.stl)',
        });
        continue;
      }

      const geom = await checkStlGeometry(file);
      if (!geom.valid) {
        errors.push(`${file.name}: ${geom.error}`);
      }

      items.push({
        file,
        parsed,
        isValidGeometry: geom.valid,
        geometryError: geom.error,
        triangleCount: geom.triangles,
      });
    }

    // Ordenar itens por estágio e arcada
    items.sort((a, b) => {
      const stageA = a.parsed?.stageNumber ?? 999;
      const stageB = b.parsed?.stageNumber ?? 999;
      if (stageA !== stageB) return stageA - stageB;
      return (a.parsed?.arch === 'UPPER' ? 0 : 1) - (b.parsed?.arch === 'UPPER' ? 0 : 1);
    });

    setFileItems(items);
    setValidationErrors(errors);
    setWarnings(analysis.warnings);
    setMissingFiles(analysis.missingFiles);
    setUnrecognizedFiles(analysis.unrecognizedFiles);
    setIsValidated(true);
    setIsValidating(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      processFileList(files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.toLowerCase().endsWith('.stl') || f.name.toLowerCase().endsWith('.ply')
      );
      if (files.length > 0) {
        processFileList(files);
      } else {
        setUploadError('Nenhum arquivo .stl válido encontrado na seleção arrastada.');
      }
    }
  };

  const handlePublish = async () => {
    if (fileItems.length === 0 || validationErrors.length > 0) return;

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      for (const item of fileItems) {
        formData.append('files', item.file, item.file.name);
      }
      if (plannerNotes.trim()) {
        formData.append('plannerComments', plannerNotes.trim());
      }

      const res = await fetch(`/api/cases/${caseId}/setups`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao publicar setup virtual.');
      }

      onSuccess(data.setup);
      onClose();
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Falha de comunicação ao publicar o setup.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const totalStages = new Set(
    fileItems.map((i) => i.parsed?.stageNumber).filter((s) => s !== undefined)
  ).size;

  const isValidForPublish =
    isValidated &&
    fileItems.length > 0 &&
    validationErrors.length === 0 &&
    unrecognizedFiles.length === 0 &&
    !isValidating &&
    !isUploading;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d131f',
          border: '1px solid var(--border-hover)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="var(--cyan-primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                Publicar Setup Virtual (v{nextVersion})
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Caso: <strong style={{ color: 'var(--cyan-primary)' }}>{caseCode}</strong> • Seleção
              múltipla de arquivos STL padronizados por estágio
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragging ? '2px dashed var(--cyan-primary)' : '2px dashed var(--border-hover)',
              borderRadius: '12px',
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'rgba(0, 210, 211, 0.08)' : 'rgba(0, 0, 0, 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".stl,.ply"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <FolderUp
              size={36}
              color={isDragging ? 'var(--cyan-primary)' : 'var(--text-muted)'}
              style={{ margin: '0 auto 10px' }}
            />
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Arraste múltiplos arquivos STL aqui ou clique para selecionar
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Nomenclatura aceita: <code style={{ color: 'var(--cyan-primary)' }}>1-S-.stl / 1-I-.stl</code>,{' '}
              <code style={{ color: 'var(--cyan-primary)' }}>12-S-.stl / 12-I-.stl</code> ou{' '}
              <code style={{ color: 'var(--cyan-primary)' }}>stage_0_upper.stl / stage_0_lower.stl</code>
            </p>
          </div>

          {/* Estado de Validação em Andamento */}
          {isValidating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', padding: '16px 0', color: 'var(--cyan-primary)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: '0.85rem' }}>Analisando cabeçalhos e geometria das malhas 3D...</span>
            </div>
          )}

          {/* Resumo dos Arquivos Identificados */}
          {fileItems.length > 0 && !isValidating && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck2 size={18} color="var(--cyan-primary)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                    {fileItems.length} arquivos identificados • {totalStages} estágio(s) detectado(s)
                  </span>
                </div>
                {validationErrors.length === 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--emerald-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={14} /> Todos os arquivos válidos
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--crimson-danger)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    <AlertCircle size={14} /> {validationErrors.length} inconsistência(s)
                  </span>
                )}
              </div>

              {/* Lista dos Arquivos Analisados */}
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                {fileItems.map((item, idx) => {
                  const isOk = item.parsed && item.isValidGeometry;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom:
                          idx < fileItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {isOk ? (
                          <CheckCircle2 size={16} color="var(--emerald-primary)" style={{ flexShrink: 0 }} />
                        ) : (
                          <AlertCircle size={16} color="var(--crimson-danger)" style={{ flexShrink: 0 }} />
                        )}
                        <span
                          style={{
                            fontFamily: 'monospace',
                            color: isOk ? 'var(--text-main)' : '#fca5a5',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.file.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        {item.parsed ? (
                          <span
                            style={{
                              background:
                                item.parsed.arch === 'UPPER'
                                  ? 'rgba(56, 189, 248, 0.15)'
                                  : 'rgba(168, 85, 247, 0.15)',
                              color:
                                item.parsed.arch === 'UPPER' ? '#38bdf8' : '#c084fc',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                            }}
                          >
                            Estágio {item.parsed.stageNumber} •{' '}
                            {item.parsed.arch === 'UPPER' ? 'Superior' : 'Inferior'}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                            }}
                          >
                            Não reconhecido
                          </span>
                        )}

                        <span style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>
                          {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alertas de Erros e Inconsistências */}
          {validationErrors.length > 0 && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertCircle size={16} color="var(--crimson-danger)" />
                <strong style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                  Problemas identificados nos arquivos:
                </strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#fca5a5', lineHeight: 1.5 }}>
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Avisos Informativos (ex: Início no Estágio 1) */}
          {warnings.length > 0 && validationErrors.length === 0 && (
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <AlertTriangle size={16} color="#eab308" />
                <strong style={{ fontSize: '0.85rem', color: '#fef08a' }}>
                  Aviso sobre a sequência clínica:
                </strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#fef08a', lineHeight: 1.5 }}>
                {warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Erro de Upload da API */}
          {uploadError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--crimson-danger)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#fca5a5',
                fontSize: '0.84rem',
              }}
            >
              {uploadError}
            </div>
          )}

          {/* Parecer Técnico do Planejador 3D */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                marginBottom: '6px',
              }}
            >
              Parecer Técnico do Planejador 3D (Opcional)
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Ex: Alinhamento e nivelamento com IPR anterior planejado no estágio 3. Attachments posicionados nos pré-molares."
              value={plannerNotes}
              onChange={(e) => setPlannerNotes(e.target.value)}
              style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {isValidForPublish ? (
              <span style={{ color: 'var(--emerald-primary)' }}>Pronto para publicação no FyAlign</span>
            ) : fileItems.length === 0 ? (
              <span>Selecione ao menos os arquivos do Estágio 0 (superior e inferior)</span>
            ) : (
              <span style={{ color: '#fca5a5' }}>Corrija as pendências acima para liberar</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="btn-secondary"
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid var(--border-hover)',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isValidForPublish || isUploading}
              className="btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                opacity: isValidForPublish && !isUploading ? 1 : 0.6,
                cursor: isValidForPublish && !isUploading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #00d2d3, #0984e3)',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Publicando Setup...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Publicar Setup v{nextVersion}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

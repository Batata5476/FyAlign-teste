'use client';

import React, { useRef } from 'react';
import { FileCard } from '@/components/upload/FileCard';
import { useAuth } from '@/lib/auth/AuthContext';
import { Camera, Smile, Eye, Box, FileCheck2, Upload, AlertCircle, Sparkles } from 'lucide-react';

interface UploadGridProps {
  slots: any[];
  caseId: string;
  onRefresh: () => void;
}

export function UploadGrid({ slots, caseId, onRefresh }: UploadGridProps) {
  const { can } = useAuth();
  const canUpload = can('FILE_UPLOAD');
  const batchInputRef = useRef<HTMLInputElement>(null);

  const extraoralSlots = slots.filter((s) => s.category === 'EXTRAORAL');
  const intraoralSlots = slots.filter((s) => s.category === 'INTRAORAL');
  const radiographSlots = slots.filter((s) => s.category === 'RADIOGRAPH');
  const scan3dSlots = slots.filter((s) => s.category === 'SCAN_3D');

  const totalRequired = slots.filter((s) => s.required).length;
  const completedRequired = slots.filter((s) => s.required && s.file?.status === 'UPLOADED').length;
  const percentComplete = Math.round((completedRequired / totalRequired) * 100);

  // Auto-mapeamento de arquivos em lote por palavras-chave no nome do arquivo (F2.21)
  const handleBatchFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      let matchedSlotNumber: number | null = null;

      if (lowerName.includes('repouso') || lowerName.includes('facial_f')) matchedSlotNumber = 1;
      else if (lowerName.includes('sorr') || lowerName.includes('smile')) matchedSlotNumber = 2;
      else if (lowerName.includes('perfil') || lowerName.includes('profile')) matchedSlotNumber = 3;
      else if (lowerName.includes('mordida_f') || lowerName.includes('anterior')) matchedSlotNumber = 4;
      else if (lowerName.includes('lat_d') || lowerName.includes('direita')) matchedSlotNumber = 5;
      else if (lowerName.includes('lat_e') || lowerName.includes('esquerda')) matchedSlotNumber = 6;
      else if (lowerName.includes('oclusal_sup') || lowerName.includes('maxila')) matchedSlotNumber = 7;
      else if (lowerName.includes('oclusal_inf') || lowerName.includes('mandibula')) matchedSlotNumber = 8;
      else if (lowerName.includes('panoram') || lowerName.includes('opg')) matchedSlotNumber = 9;
      else if (lowerName.includes('tele') || lowerName.includes('cefalom')) matchedSlotNumber = 10;
      else if (lowerName.includes('superior') && (lowerName.endsWith('.stl') || lowerName.endsWith('.ply'))) matchedSlotNumber = 11;
      else if (lowerName.includes('inferior') && (lowerName.endsWith('.stl') || lowerName.endsWith('.ply'))) matchedSlotNumber = 12;
      else if (lowerName.includes('bite') || lowerName.includes('registro')) matchedSlotNumber = 13;

      if (matchedSlotNumber) {
        try {
          const presignedRes = await fetch(`/api/cases/${caseId}/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slotNumber: matchedSlotNumber,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileSizeBytes: file.size,
            }),
          });

          if (presignedRes.ok) {
            const { uploadUrl, fileId } = await presignedRes.json();
            await fetch(uploadUrl, {
              method: 'PUT',
              headers: file.type ? { 'Content-Type': file.type } : {},
              body: file,
            });
            await fetch(`/api/cases/${caseId}/files/${fileId}/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
          }
        } catch (err) {
          console.error(`Erro ao subir ${file.name} em lote:`, err);
        }
      }
    }

    onRefresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
      {/* Banner de Progresso Geral da Documentação (F2.20) */}
      <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--border-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <FileCheck2 size={20} color="var(--cyan-primary)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Status da Documentação Clínica ({completedRequired} de {totalRequired} obrigatórios)
              </h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Todos os 13 arquivos obrigatórios devem ser carregados para liberar a submissão ao laboratório.
            </p>
          </div>

          {/* Botão de Upload em Lote Inteligente (F2.21) */}
          {canUpload && (
            <div>
              <input
                ref={batchInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleBatchFiles}
              />
              <button
                type="button"
                onClick={() => batchInputRef.current?.click()}
                className="btn-secondary"
                style={{ fontSize: '0.84rem', padding: '10px 16px' }}
              >
                <Upload size={16} />
                <span>Importar Arquivos em Lote</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra de Progresso Global */}
        <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${percentComplete}%`,
              background: percentComplete === 100 ? 'var(--emerald-success)' : 'linear-gradient(90deg, var(--cyan-primary), var(--blue-vibrant))',
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: percentComplete === 100 ? '0 0 12px var(--emerald-glow)' : '0 0 10px var(--cyan-glow)'
            }}
          />
        </div>
      </div>

      {/* SEÇÃO 1: Fotografias Extraorais (Facial) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Camera size={20} color="var(--cyan-primary)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>1. Fotografias Extraorais (Facial)</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>• 3 fotos obrigatórias</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          {extraoralSlots.map((slot) => (
            <FileCard
              key={slot.slotNumber}
              slot={slot}
              caseId={caseId}
              onFileUploaded={onRefresh}
              onFileDeleted={onRefresh}
            />
          ))}
        </div>
      </div>

      {/* SEÇÃO 2: Fotografias Intraorais */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Smile size={20} color="var(--cyan-primary)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>2. Fotografias Intraorais (Arcadas & Mordida)</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>• 5 fotos obrigatórias</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          {intraoralSlots.map((slot) => (
            <FileCard
              key={slot.slotNumber}
              slot={slot}
              caseId={caseId}
              onFileUploaded={onRefresh}
              onFileDeleted={onRefresh}
            />
          ))}
        </div>
      </div>

      {/* SEÇÃO 3: Exames Radiológicos */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Eye size={20} color="var(--cyan-primary)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>3. Exames Radiológicos</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>• 2 exames obrigatórios</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px' }}>
          {radiographSlots.map((slot) => (
            <FileCard
              key={slot.slotNumber}
              slot={slot}
              caseId={caseId}
              onFileUploaded={onRefresh}
              onFileDeleted={onRefresh}
            />
          ))}
        </div>
      </div>

      {/* SEÇÃO 4: Escaneamentos Intraorais Tridimensionais (3D) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Box size={20} color="var(--cyan-primary)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>4. Escaneamentos Intraorais 3D (.STL / .PLY)</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>• 2 malhas obrigatórias + 1 registro oclusal recomendado</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          {scan3dSlots.map((slot) => (
            <FileCard
              key={slot.slotNumber}
              slot={slot}
              caseId={caseId}
              onFileUploaded={onRefresh}
              onFileDeleted={onRefresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

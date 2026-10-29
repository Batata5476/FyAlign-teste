'use client';

import React, { useState } from 'react';

interface SetupApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  setupId: string;
  setupVersion: number;
  upperCount: number;
  lowerCount: number;
  doctorCro?: string;
  doctorName?: string;
  onSuccess: () => void;
  mode: 'APPROVE' | 'REJECT';
}

export const SetupApprovalModal: React.FC<SetupApprovalModalProps> = ({
  isOpen,
  onClose,
  caseId,
  setupId,
  setupVersion,
  upperCount,
  lowerCount,
  doctorCro,
  doctorName,
  onSuccess,
  mode,
}) => {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestedAdjustments, setRequestedAdjustments] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!acceptTerms) {
      setErrorMsg('É obrigatório assinalar o aceite da responsabilidade técnica clínica (RN-02).');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/cases/${caseId}/setups/${setupId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalAcceptance: true,
          clinicalNotes: notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao aprovar setup.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      setErrorMsg('A justificativa técnica de ajuste deve conter pelo menos 10 caracteres explicativos.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/cases/${caseId}/setups/${setupId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectionReason,
          requestedAdjustments,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao rejeitar setup.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="approval-backdrop">
      <div className="approval-card">
        {mode === 'APPROVE' ? (
          <>
            <div className="modal-header-approve">
              <span className="badge-setup-v">Setup v{setupVersion}</span>
              <h2>Aprovação Formal de Tratamento & Início de Produção</h2>
              <p>Validação clínica do planejamento ortodôntico digital</p>
            </div>

            <div className="approval-body">
              <div className="summary-box">
                <div className="summary-item">
                  <span className="label">Alinhadores Superiores:</span>
                  <span className="value highlight">{upperCount} alinhadores</span>
                </div>
                <div className="summary-item">
                  <span className="label">Alinhadores Inferiores:</span>
                  <span className="value highlight">{lowerCount} alinhadores</span>
                </div>
                <div className="summary-item">
                  <span className="label">Cirurgião Responsável:</span>
                  <span className="value">{doctorName || 'Dr(a). Cirurgião-Dentista'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Registro Profissional CRO:</span>
                  <span className="value">{doctorCro || 'Ativo'}</span>
                </div>
              </div>

              <div className="alert-legal">
                ⚠️ <strong>Atenção (RN-03):</strong> Ao aprovar este setup virtual, o planejamento torna-se
                imutável e a Ordem de Produção (OP) é emitida imediatamente para a termoformagem e corte a laser.
              </div>

              <label className="checkbox-legal">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  Declaro que revisei a cinemática 3D, mapa de contatos e cronograma de IPR e aprovo este plano como profissional responsável habilitado perante o CRO (RN-02).
                </span>
              </label>

              <div className="notes-field">
                <label>Instruções ou observações finais para o laboratório (opcional):</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Liberar guia de colagem de attachments junto ao alinhador #1..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {errorMsg && <div className="error-box">{errorMsg}</div>}
            </div>

            <div className="approval-footer">
              <button className="btn-cancel" onClick={onClose} disabled={loading}>
                Voltar à Análise 3D
              </button>
              <button className="btn-confirm-approve" onClick={handleApprove} disabled={loading}>
                {loading ? 'Emitindo OP...' : 'Assinar Eletronicamente & Iniciar Manufatura'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header-reject">
              <span className="badge-setup-v">Setup v{setupVersion}</span>
              <h2>Solicitação de Ajuste Técnico no Setup</h2>
              <p>Aponte as alterações clínicas necessárias para a equipe de planejadores 3D</p>
            </div>

            <div className="approval-body">
              <div className="form-group">
                <label>Motivo clínico do ajuste (mínimo 10 caracteres)*:</label>
                <textarea
                  rows={3}
                  placeholder="Ex: A rotação prevista no elemento #21 parece agressiva para a velocidade biológica; favor reduzir para 1 grau por alinhador e acrescentar attachment biselado."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Ajustes adicionais sugeridos ou diretrizes de IPR:</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Evitar IPR mesial no dente #33, transferir o desgaste para distal..."
                  value={requestedAdjustments}
                  onChange={(e) => setRequestedAdjustments(e.target.value)}
                />
              </div>

              {errorMsg && <div className="error-box">{errorMsg}</div>}
            </div>

            <div className="approval-footer">
              <button className="btn-cancel" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button className="btn-confirm-reject" onClick={handleReject} disabled={loading}>
                {loading ? 'Enviando...' : 'Rejeitar Setup & Solicitar v' + (setupVersion + 1)}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .approval-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 25, 47, 0.88);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }
        .approval-card {
          width: 100%;
          max-width: 580px;
          background: #0f2744;
          border: 1px solid rgba(0, 210, 211, 0.35);
          border-radius: 14px;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
          overflow: hidden;
        }
        .modal-header-approve {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(10, 25, 47, 0.8));
          padding: 1.5rem;
          border-bottom: 1px solid rgba(16, 185, 129, 0.3);
        }
        .modal-header-reject {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(10, 25, 47, 0.8));
          padding: 1.5rem;
          border-bottom: 1px solid rgba(239, 68, 68, 0.3);
        }
        .badge-setup-v {
          background: rgba(0, 210, 211, 0.2);
          color: #00d2d3;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          display: inline-block;
          margin-bottom: 0.5rem;
        }
        h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        p {
          font-size: 0.85rem;
          color: #94a3b8;
          margin: 0.3rem 0 0;
        }
        .approval-body {
          padding: 1.5rem;
        }
        .summary-box {
          background: #091728;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
        }
        .summary-item .label {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
        }
        .summary-item .value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #e2e8f0;
        }
        .summary-item .highlight {
          color: #10b981;
        }
        .alert-legal {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 0.8rem;
          font-size: 0.82rem;
          color: #fde68a;
          line-height: 1.4;
          margin-bottom: 1rem;
        }
        .checkbox-legal {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          font-size: 0.83rem;
          color: #cbd5e1;
          cursor: pointer;
          margin-bottom: 1rem;
          line-height: 1.4;
        }
        .checkbox-legal input {
          margin-top: 0.2rem;
        }
        .notes-field, .form-group {
          margin-bottom: 1rem;
        }
        label {
          display: block;
          font-size: 0.8rem;
          color: #94a3b8;
          margin-bottom: 0.4rem;
        }
        textarea {
          width: 100%;
          background: #091728;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #fff;
          padding: 0.7rem;
          font-size: 0.88rem;
          resize: vertical;
        }
        textarea:focus {
          outline: none;
          border-color: #00d2d3;
        }
        .error-box {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid #ef4444;
          color: #fca5a5;
          padding: 0.6rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }
        .approval-footer {
          padding: 1.2rem 1.5rem;
          background: rgba(10, 25, 47, 0.5);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: flex-end;
          gap: 0.8rem;
        }
        .btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #94a3b8;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-confirm-approve {
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          color: #fff;
          padding: 0.6rem 1.4rem;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .btn-confirm-reject {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: none;
          color: #fff;
          padding: 0.6rem 1.4rem;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-confirm-approve:disabled, .btn-confirm-reject:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

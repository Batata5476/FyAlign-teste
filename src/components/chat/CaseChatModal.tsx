'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FDI_ANATOMICAL_DICTIONARY } from '@/lib/chat/fdiMention';

interface Message {
  id: string;
  senderId: string;
  content: string;
  mentionedTeethFdi: string | null;
  attachmentUrls: string | null;
  isInternalLabOnly: boolean;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
    role: string;
    professionalIdCro?: string | null;
  };
}

interface CaseChatModalProps {
  caseId: string;
  caseCode: string;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CaseChatModal: React.FC<CaseChatModalProps> = ({
  caseId,
  caseCode,
  patientName,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [canPostInternal, setCanPostInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cases/${caseId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCanPostInternal(data.canPostInternal || false);
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000); // Polling leve a cada 5s
      return () => clearInterval(interval);
    }
  }, [isOpen, caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    try {
      setSending(true);
      const attachments = attachmentUrl.trim() ? [attachmentUrl.trim()] : [];

      const res = await fetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: inputText,
          isInternalLabOnly: isInternalOnly,
          attachmentUrls: attachments,
        }),
      });

      if (res.ok) {
        setInputText('');
        setAttachmentUrl('');
        setIsInternalOnly(false);
        fetchMessages();
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  // Renderizador de texto com links/badges para dentes FDI
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(#[1-4][1-8]\b)/g);
    return parts.map((part, index) => {
      if (/^#[1-4][1-8]$/.test(part)) {
        const toothCode = part.replace('#', '');
        const info = FDI_ANATOMICAL_DICTIONARY[toothCode];
        return (
          <span
            key={index}
            className="tooth-badge-interactive"
            title={info ? `${info.name} (${info.arch === 'UPPER' ? 'Superior' : 'Inferior'})` : 'Dente FDI'}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="chat-modal-card">
        {/* Header do Chat */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-title">
              💬 Chat Clínico • Caso {caseCode}
            </div>
            <div className="chat-subtitle">
              Paciente: <strong>{patientName}</strong> • Comunicação Direta com o Laboratório FyAlign
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>

        {/* Mensagens */}
        <div className="chat-messages-container">
          {loading && messages.length === 0 ? (
            <div className="chat-loading">Carregando histórico clínico...</div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              Nenhuma mensagem trocada ainda neste caso.<br />
              Inicie a conversa com a equipe de ortodontistas e planejadores 3D.
            </div>
          ) : (
            messages.map((m) => {
              const isLabUser = ['PLANNER_3D', 'PRODUCTION_QC', 'SUPER_ADMIN'].includes(m.sender.role);
              return (
                <div
                  key={m.id}
                  className={`chat-bubble ${isLabUser ? 'bubble-lab' : 'bubble-clinic'} ${
                    m.isInternalLabOnly ? 'bubble-internal' : ''
                  }`}
                >
                  <div className="bubble-header">
                    <span className="sender-name">
                      {m.sender.fullName}
                      {m.sender.professionalIdCro && (
                        <span className="sender-cro"> (CRO: {m.sender.professionalIdCro})</span>
                      )}
                    </span>
                    <span className="bubble-time">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {m.isInternalLabOnly && (
                    <div className="internal-badge-chip">🔒 NOTA INTERNA DO LABORATÓRIO</div>
                  )}

                  <div className="bubble-body">
                    {renderMessageContent(m.content)}
                  </div>

                  {m.attachmentUrls && (
                    <div className="bubble-attachments">
                      {(() => {
                        try {
                          const urls = JSON.parse(m.attachmentUrls) as string[];
                          return urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="attachment-link"
                            >
                              📎 Ver anexo / captura #{i + 1}
                            </a>
                          ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões rápidas de menção FDI */}
        <div className="fdi-quick-bar">
          <span className="fdi-quick-label">Menção Rápida FDI:</span>
          {['#11', '#12', '#21', '#22', '#16', '#26', '#36', '#46'].map((tooth) => (
            <button
              key={tooth}
              type="button"
              className="btn-fdi-quick"
              onClick={() => setInputText((prev) => `${prev} ${tooth} `)}
            >
              {tooth}
            </button>
          ))}
        </div>

        {/* Formulário de Envio */}
        <form onSubmit={handleSendMessage} className="chat-form">
          {canPostInternal && (
            <label className="checkbox-internal">
              <input
                type="checkbox"
                checked={isInternalOnly}
                onChange={(e) => setIsInternalOnly(e.target.checked)}
              />
              <span>🔒 Mensagem interna (Visível apenas para a equipe interna FyAlign)</span>
            </label>
          )}

          <div className="chat-input-row">
            <textarea
              className="chat-textarea"
              placeholder="Digite sua mensagem para o planejador... (Dica: digite #número para mencionar dentes, ex: #21)"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <button
              type="submit"
              className="btn-send-message"
              disabled={sending || !inputText.trim()}
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 25, 47, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }
        .chat-modal-card {
          width: 100%;
          max-width: 680px;
          height: 85vh;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-elevated);
          color: var(--text-main);
        }
        .chat-header {
          padding: 1rem 1.5rem;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chat-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--cyan-primary);
        }
        .chat-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-top: 0.2rem;
        }
        .btn-close-modal {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.4rem;
          cursor: pointer;
        }
        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .chat-loading, .chat-empty {
          text-align: center;
          color: var(--text-dim);
          font-size: 0.9rem;
          margin: auto;
          line-height: 1.5;
        }
        .chat-bubble {
          max-width: 80%;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          font-size: 0.9rem;
          line-height: 1.4;
          box-shadow: var(--shadow-sm);
        }
        .bubble-clinic {
          align-self: flex-start;
          background: var(--chat-clinic-bg);
          border-left: 3px solid var(--cyan-primary);
          color: var(--text-main);
        }
        .bubble-lab {
          align-self: flex-end;
          background: var(--chat-lab-bg);
          border-right: 3px solid var(--emerald-success);
          color: var(--text-main);
        }
        .bubble-internal {
          background: var(--badge-warning-bg) !important;
          border-color: var(--amber-warning) !important;
          color: var(--text-main) !important;
        }
        .bubble-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-bottom: 0.4rem;
        }
        .sender-name {
          font-weight: 600;
          color: var(--text-main);
        }
        .sender-cro {
          color: var(--cyan-primary);
        }
        .internal-badge-chip {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--amber-warning);
          background: var(--badge-warning-bg);
          border: 1px solid var(--badge-warning-border);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          margin-bottom: 0.4rem;
        }
        .bubble-attachments {
          margin-top: 0.5rem;
          padding-top: 0.4rem;
          border-top: 1px dashed var(--border-subtle);
        }
        .attachment-link {
          color: var(--cyan-primary);
          text-decoration: underline;
          font-size: 0.8rem;
        }
        .fdi-quick-bar {
          padding: 0.4rem 1rem;
          background: var(--btn-ghost-bg);
          border-top: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .fdi-quick-label {
          font-size: 0.75rem;
          color: var(--text-dim);
          margin-right: 0.3rem;
        }
        .btn-fdi-quick {
          background: var(--badge-setup-bg);
          border: 1px solid var(--badge-setup-border);
          color: var(--cyan-primary);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-fdi-quick:hover {
          background: var(--cyan-primary);
          color: #ffffff;
        }
        .chat-form {
          padding: 0.8rem 1rem;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
        }
        .checkbox-internal {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--amber-warning);
          margin-bottom: 0.5rem;
          cursor: pointer;
        }
        .chat-input-row {
          display: flex;
          gap: 0.6rem;
        }
        .chat-textarea {
          flex: 1;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 8px;
          color: var(--input-text);
          padding: 0.6rem;
          font-size: 0.88rem;
          resize: none;
        }
        .chat-textarea:focus {
          outline: none;
          border-color: var(--cyan-primary);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }
        .btn-send-message {
          background: #00d2d3;
          color: #0a192f;
          border: none;
          padding: 0 1.2rem;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-send-message:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        :global(.tooth-badge-interactive) {
          background: rgba(0, 210, 211, 0.2);
          color: #00d2d3;
          font-weight: 700;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          cursor: help;
          border-bottom: 1px dashed #00d2d3;
        }
      `}</style>
    </div>
  );
};

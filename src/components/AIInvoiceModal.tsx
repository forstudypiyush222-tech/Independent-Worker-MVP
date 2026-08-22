import { FC, useState, useEffect, useRef, KeyboardEvent } from 'react';
import type { AIInvoiceExtraction } from '../integration/ai-invoice/aiInvoiceTypes';
import { extractInvoiceFromText } from '../integration/ai-invoice/aiInvoiceService';
import './AIInvoiceModal.css';

interface AIInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (extraction: AIInvoiceExtraction) => void;
  currentCurrency?: string;
}

type ModalStep = 'input' | 'loading' | 'preview';

const SAMPLE_PROMPT =
  "Repaired Rahul's AC for ₹2500 and replaced the filter for ₹600. Payment due in 7 days.";

export const AIInvoiceModal: FC<AIInvoiceModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentCurrency = '₹',
}) => {
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState<ModalStep>('input');
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<AIInvoiceExtraction | null>(null);
  const [source, setSource] = useState<'gemini' | 'heuristic' | undefined>(undefined);
  const [fallbackWarning, setFallbackWarning] = useState<string | undefined>(undefined);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus textarea when opening in input state
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } else {
      // Reset step on close
      setStep('input');
      setError(null);
    }
  }, [isOpen]);

  // Handle Escape key safety
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (step === 'input') {
          onClose();
        }
        // In 'loading' and 'preview' steps, Escape is intentionally ignored to prevent accidental loss
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    // Backdrop click is allowed only during input state when not loading
    if (step === 'input') {
      onClose();
    }
  };

  const handleExtract = async () => {
    if (prompt.trim().length < 5) {
      setError('Please provide at least 5 characters describing the work performed.');
      return;
    }

    if (prompt.trim().length > 2000) {
      setError('Input exceeds maximum allowed length of 2000 characters.');
      return;
    }

    setError(null);
    setStep('loading');

    const result = await extractInvoiceFromText(prompt);

    if (result.success && result.data) {
      setExtraction(result.data);
      setSource(result.source);
      setFallbackWarning(result.warning);
      setStep('preview');
    } else {
      setError(result.error || 'Failed to extract invoice data. Please try again.');
      setStep('input');
    }
  };

  const handleApply = () => {
    if (extraction) {
      onApply(extraction);
      onClose();
    }
  };

  const handleKeyDownTextarea = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (prompt.trim().length >= 5 && step === 'input') {
        handleExtract();
      }
    }
  };

  const charCount = prompt.length;
  const isInputValid = charCount >= 5 && charCount <= 2000;

  return (
    <div
      className="ai-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-invoice-modal-title"
    >
      <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="ai-modal-header">
          <div className="ai-modal-header-text">
            <h2 id="ai-invoice-modal-title">
              <span>✨</span> Generate Invoice with AI
            </h2>
            <p>
              {step === 'preview'
                ? 'Review extracted line items and details before applying to invoice.'
                : 'Describe services, clients, rates, and terms in natural language.'}
            </p>
          </div>

          <button
            className="ai-modal-close-btn"
            onClick={onClose}
            disabled={step === 'loading'}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="ai-modal-body">
          {/* ERROR STATE BANNER */}
          {error && (
            <div className="ai-modal-error" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: INPUT */}
          {step === 'input' && (
            <div className="ai-modal-input-view">
              <div className="ai-modal-textarea-wrap">
                <textarea
                  ref={textareaRef}
                  className="ai-modal-textarea"
                  placeholder="e.g. Repaired Rahul's AC for ₹2500 and replaced the filter for ₹600. Payment due in 7 days."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDownTextarea}
                  maxLength={2000}
                />

                <div className="ai-modal-counter-row">
                  <button
                    type="button"
                    className="ai-sample-prompt-btn"
                    onClick={() => setPrompt(SAMPLE_PROMPT)}
                  >
                    Use Sample Prompt
                  </button>

                  <span style={{ color: charCount > 2000 ? '#dc2626' : undefined }}>
                    {charCount} / 2000
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LOADING */}
          {step === 'loading' && (
            <div className="ai-loading-container" aria-live="polite">
              <div className="ai-spinner"></div>
              <h3>Extracting Invoice Data...</h3>
              <p>Analyzing job description and extracting line items and terms.</p>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && extraction && (
            <div className="ai-modal-preview-view">
              {/* SOURCE BADGE */}
              <div>
                {source === 'gemini' ? (
                  <span className="ai-preview-source-badge ai-source-gemini">
                    <span>✨</span> AI Extraction
                  </span>
                ) : (
                  <span className="ai-preview-source-badge ai-source-heuristic">
                    <span>⚡</span> Offline Fallback
                  </span>
                )}
              </div>

              {fallbackWarning && (
                <p style={{ fontSize: '12px', color: '#854d0e', margin: '0 0 10px 0' }}>
                  {fallbackWarning}
                </p>
              )}

              {/* MANDATORY REVIEW WARNING */}
              <div className="ai-review-warning">
                ⚠️ Please review all items and rates before generating the final invoice.
              </div>

              {/* METADATA GRID */}
              <div className="ai-preview-grid">
                <div className="ai-preview-field">
                  <span className="ai-preview-label">Client Name</span>
                  <span className="ai-preview-value">
                    {extraction.clientName || '—'}
                  </span>
                </div>

                <div className="ai-preview-field">
                  <span className="ai-preview-label">Due Date</span>
                  <span className="ai-preview-value">
                    {extraction.suggestedDueDate ||
                      (extraction.dueInDays !== null
                        ? `Due in ${extraction.dueInDays} days`
                        : '—')}
                  </span>
                </div>

                {extraction.clientEmail && (
                  <div className="ai-preview-field">
                    <span className="ai-preview-label">Client Email</span>
                    <span className="ai-preview-value">{extraction.clientEmail}</span>
                    <span className="ai-preview-tag">Preview only — not saved to the invoice</span>
                  </div>
                )}

                {extraction.clientPhone && (
                  <div className="ai-preview-field">
                    <span className="ai-preview-label">Client Phone</span>
                    <span className="ai-preview-value">{extraction.clientPhone}</span>
                    <span className="ai-preview-tag">Preview only — not saved to the invoice</span>
                  </div>
                )}

                <div className="ai-preview-field">
                  <span className="ai-preview-label">Sales Tax</span>
                  <span className="ai-preview-value">
                    {extraction.taxRate === 0
                      ? '0% (No tax)'
                      : typeof extraction.taxRate === 'number' && extraction.taxRate > 0
                      ? `${extraction.taxRate}%`
                      : 'Not specified (preserves current)'}
                  </span>
                </div>
              </div>

              {/* LINE ITEMS TABLE */}
              <div className="ai-preview-items-title">Extracted Line Items:</div>
              <table className="ai-items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="right">Qty</th>
                    <th className="right">Rate ({currentCurrency})</th>
                  </tr>
                </thead>
                <tbody>
                  {extraction.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.description}</td>
                      <td className="right">{item.quantity}</td>
                      <td className="right">{item.rate.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* NOTES */}
              {extraction.notes && (
                <div style={{ marginTop: '10px' }}>
                  <span className="ai-preview-label">Notes:</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
                    {extraction.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="ai-modal-footer">
          {step === 'input' && (
            <>
              <button type="button" className="ai-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="ai-btn-primary"
                onClick={handleExtract}
                disabled={!isInputValid}
              >
                Generate with AI
              </button>
            </>
          )}

          {step === 'loading' && (
            <button type="button" className="ai-btn-secondary" disabled>
              Extracting...
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                className="ai-btn-secondary"
                onClick={() => setStep('input')}
              >
                Back / Edit Prompt
              </button>
              <button type="button" className="ai-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="ai-btn-primary" onClick={handleApply}>
                Apply to Invoice
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInvoiceModal;

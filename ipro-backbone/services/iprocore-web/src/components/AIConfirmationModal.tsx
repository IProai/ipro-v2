import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiSuggestion, confirmSuggestion } from '../lib/ai';

interface Props {
    suggestion: AiSuggestion;
    onClose: () => void;
}

export function AIConfirmationModal({ suggestion, onClose }: Props) {
    const { t } = useTranslation();
    const [executing, setExecuting] = useState(false);
    const [result, setResult] = useState<{ id?: string; error?: string } | null>(null);

    const handleAction = async (action: 'confirm' | 'dismiss') => {
        setExecuting(true);
        setResult(null);
        try {
            const data = await confirmSuggestion(suggestion.id, action);
            if (action === 'confirm') {
                setResult({ id: data.workflowRunId });
            } else {
                onClose();
            }
        } catch (err: any) {
            setResult({ error: err.message });
        } finally {
            setExecuting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="glass-card modal-content" style={{ maxWidth: '600px', width: '90%', padding: 'var(--space-8)' }}>
                <header style={{ marginBottom: 'var(--space-6)' }}>
                    <h2 className="console-title">{t('ai.confirmation.title')}</h2>
                    <p className="console-subtitle">{t('ai.confirmation.subtitle')}</p>
                </header>

                <div className="confirmation-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* Draft Section */}
                    <div className="draft-section">
                        <label className="section-title" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                            {t('ai.confirmation.draftLabel')}
                        </label>
                        <div className="form-input" style={{ whiteSpace: 'pre-wrap', minHeight: '100px', background: 'rgba(0,0,0,0.2)' }}>
                            {suggestion.suggestionText}
                        </div>
                    </div>

                    {/* Context Section */}
                    <div className="context-section">
                        <label className="section-title" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                            {t('ai.confirmation.contextLabel')}
                        </label>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            {suggestion.contextSummary}
                        </div>
                    </div>

                    {/* Results / Status */}
                    {result?.id && (
                        <div className="success-banner" style={{ margin: 0 }}>
                            {t('ai.confirmation.success', { id: result.id })}
                        </div>
                    )}
                    {result?.error && (
                        <div className="error-banner" style={{ margin: 0 }}>
                            {t('ai.confirmation.error', { error: result.error })}
                        </div>
                    )}

                    {/* Governance Note */}
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                        🛡️ {t('ai.confirmation.governanceNote')}
                    </p>

                    {/* Actions */}
                    <div className="modal-actions" style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                        {!result?.id ? (
                            <>
                                <button
                                    className="btn-primary"
                                    disabled={executing}
                                    onClick={() => handleAction('confirm')}
                                >
                                    {executing ? t('ai.confirmation.executing') : t('ai.confirmation.confirm')}
                                </button>
                                <button
                                    className="widget-btn secondary"
                                    style={{ margin: 0, flex: 1 }}
                                    disabled={executing}
                                    onClick={() => handleAction('dismiss')}
                                >
                                    {t('ai.confirmation.dismiss')}
                                </button>
                            </>
                        ) : (
                            <button className="btn-primary" onClick={onClose}>
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes modalEnter {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}

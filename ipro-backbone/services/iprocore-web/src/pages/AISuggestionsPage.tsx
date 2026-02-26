import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { fetchSuggestions, AiSuggestion } from '../lib/ai';
import { AIConfirmationModal } from '../components/AIConfirmationModal';

type Tab = 'suggestions' | 'activity' | 'playbooks';

export function AISuggestionsPage() {
    const { t } = useTranslation();
    const location = useLocation();
    const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [selectedSuggestion, setSelectedSuggestion] = useState<AiSuggestion | null>(null);

    const getActiveTab = (): Tab => {
        if (location.pathname.includes('activity')) return 'activity';
        if (location.pathname.includes('playbooks')) return 'playbooks';
        return 'suggestions';
    };
    const tab = getActiveTab();

    const loadSuggestions = () => {
        setLoading(true);
        fetchSuggestions()
            .then((data) => {
                setSuggestions(data);
                setLoading(false);
            })
            .catch(() => {
                setError(t('errors.networkError'));
                setLoading(false);
            });
    };

    useEffect(() => {
        if (tab === 'suggestions') {
            loadSuggestions();
        }
    }, [tab]);

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('ai.title')}</h1>
                    </div>
                    <div className="header-tabs">
                        <Link
                            to="/console/ai/suggestions"
                            className={`tab${tab === 'suggestions' ? ' active' : ''}`}
                        >
                            {t('ai.tabs.suggestions')}
                        </Link>
                        <Link
                            to="/console/ai/playbooks"
                            className={`tab${tab === 'playbooks' ? ' active' : ''}`}
                        >
                            {t('ai.tabs.playbooks')}
                        </Link>
                        <Link
                            to="/console/ai/activity"
                            className={`tab${tab === 'activity' ? ' active' : ''}`}
                        >
                            {t('ai.tabs.activity')}
                        </Link>
                    </div>
                </header>

                <section className="dashboard-section full-width">
                    <h2 className="section-title">{t('ai.suggestions.title')}</h2>
                    <p className="console-subtitle">{t('ai.suggestions.subtitle')}</p>

                    {loading && <div className="loading-state">Loading…</div>}
                    {error && <div className="error-banner">{error}</div>}

                    {!loading && suggestions.length === 0 && (
                        <div className="empty-state">{t('ai.suggestions.empty')}</div>
                    )}

                    {!loading && suggestions.length > 0 && (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('ai.suggestions.type')}</th>
                                        <th>{t('ai.suggestions.context')}</th>
                                        <th>{t('ai.suggestions.status')}</th>
                                        <th>{t('ai.suggestions.expires')}</th>
                                        <th>{t('ai.suggestions.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suggestions.map((s) => (
                                        <tr key={s.id}>
                                            <td className="font-medium">{s.suggestionType}</td>
                                            <td>{s.contextSummary}</td>
                                            <td>
                                                <span className={`badge badge-${s.status}`}>
                                                    {t(`ai.suggestions.${s.status}`)}
                                                </span>
                                            </td>
                                            <td>{new Date(s.expiresAt).toLocaleString()}</td>
                                            <td>
                                                {s.status === 'pending' ? (
                                                    <button
                                                        className="btn-primary"
                                                        style={{ padding: '4px 12px', fontSize: '12px', width: 'auto' }}
                                                        onClick={() => setSelectedSuggestion(s)}
                                                    >
                                                        {t('ai.suggestions.view')}
                                                    </button>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {selectedSuggestion && (
                <AIConfirmationModal
                    suggestion={selectedSuggestion}
                    onClose={() => {
                        setSelectedSuggestion(null);
                        loadSuggestions();
                    }}
                />
            )}
        </div>
    );
}

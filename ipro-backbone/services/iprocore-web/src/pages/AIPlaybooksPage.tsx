import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { fetchPlaybooks, AiPlaybook } from '../lib/ai';

export function AIPlaybooksPage() {
    const { t } = useTranslation();
    const [playbooks, setPlaybooks] = useState<AiPlaybook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPlaybooks()
            .then((data) => {
                setPlaybooks(data);
                setLoading(false);
            })
            .catch(() => {
                setError(t('errors.networkError'));
                setLoading(false);
            });
    }, [t]);

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('ai.title')}</h1>
                    </div>
                    <div className="header-tabs">
                        <Link to="/console/ai/suggestions" className="tab">
                            {t('ai.tabs.suggestions')}
                        </Link>
                        <Link to="/console/ai/playbooks" className="tab active">
                            {t('ai.tabs.playbooks')}
                        </Link>
                        <Link to="/console/ai/activity" className="tab">
                            {t('ai.tabs.activity')}
                        </Link>
                    </div>
                </header>

                <section className="dashboard-section full-width">
                    <h2 className="section-title">{t('ai.playbooks.title')}</h2>
                    <p className="console-subtitle">{t('ai.playbooks.subtitle')}</p>

                    {loading && <div className="loading-state">Loading…</div>}
                    {error && <div className="error-banner">{error}</div>}

                    {!loading && playbooks.length === 0 && (
                        <div className="empty-state">{t('ai.playbooks.empty')}</div>
                    )}

                    {!loading && playbooks.length > 0 && (
                        <div className="dashboard-grid">
                            {playbooks.map((pb, i) => (
                                <div key={i} className="product-tile">
                                    <div className="tile-icon">🤖</div>
                                    <div className="tile-body">
                                        <div className="tile-name">{pb.playbookLabel}</div>
                                        <div className="tile-desc">{pb.description}</div>
                                        <div className="tile-meta">
                                            <span className="tile-type">{pb.sourceType}: {pb.source}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="tile-launch-btn"
                                        onClick={() => {
                                            // Future: open workflow builder scoped to this playbook
                                            alert('Playbook selection: Scope to JAD workflow builder (coming soon).');
                                        }}
                                    >
                                        Explore Strategy →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

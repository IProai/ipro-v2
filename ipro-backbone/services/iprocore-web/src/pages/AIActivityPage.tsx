import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { fetchActivity, AiActivityLog } from '../lib/ai';

export function AIActivityPage() {
    const { t } = useTranslation();
    const [activity, setActivity] = useState<AiActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchActivity()
            .then((data) => {
                setActivity(data);
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
                        <Link to="/console/ai/playbooks" className="tab">
                            {t('ai.tabs.playbooks')}
                        </Link>
                        <Link to="/console/ai/activity" className="tab active">
                            {t('ai.tabs.activity')}
                        </Link>
                    </div>
                </header>

                <section className="dashboard-section full-width">
                    <h2 className="section-title">{t('ai.activity.title')}</h2>
                    <p className="console-subtitle">{t('ai.activity.subtitle')}</p>

                    {loading && <div className="loading-state">Loading…</div>}
                    {error && <div className="error-banner">{error}</div>}

                    {!loading && activity.length === 0 && (
                        <div className="empty-state">{t('ai.activity.empty')}</div>
                    )}

                    {!loading && activity.length > 0 && (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('ai.activity.action')}</th>
                                        <th>{t('ai.activity.actor')}</th>
                                        <th>{t('ai.activity.trigger')}</th>
                                        <th>{t('ai.activity.timestamp')}</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activity.map((log) => (
                                        <tr key={log.id}>
                                            <td className="font-medium">
                                                <span className="pill">{log.action}</span>
                                            </td>
                                            <td>{log.actorId}</td>
                                            <td>
                                                <span className="badge badge-blue">{log.triggerSource}</span>
                                            </td>
                                            <td>{new Date(log.createdAt).toLocaleString()}</td>
                                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {log.workflowRunId && `Run: ${log.workflowRunId}`}
                                                {log.meta && JSON.stringify(log.meta)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

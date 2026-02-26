import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../components/Sidebar';
import { getAccessToken } from '../lib/auth';

interface PortfolioItem {
    id: string; name: string; type: string; version: string;
    status: string; rolloutMode: string; killSwitch: boolean; sortOrder: number;
    allowlistTenants: string[]; allowlistPlans: string[];
}

export function ControlTowerPage() {
    const { t } = useTranslation();
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    // Inline version edit state
    const [editVersionId, setEditVersionId] = useState<string | null>(null);
    const [editVersionVal, setEditVersionVal] = useState('');

    const token = getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        fetch('/api/portfolio', { headers, credentials: 'include' })
            .then((r) => r.json())
            .then((d) => { setItems(d.items ?? []); setLoading(false); })
            .catch(() => { setError(t('errors.networkError')); setLoading(false); });
    }, []);

    const updateStatus = async (id: string, status: string) => {
        setSavingId(id);
        const r = await fetch(`/api/portfolio/${id}/status`, {
            method: 'PATCH', headers, credentials: 'include',
            body: JSON.stringify({ status }),
        });
        if (r.ok) {
            const { item } = await r.json();
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        }
        setSavingId(null);
    };

    const updateRollout = async (id: string, rolloutMode: string) => {
        setSavingId(id);
        const r = await fetch(`/api/portfolio/${id}/rollout`, {
            method: 'PATCH', headers, credentials: 'include',
            body: JSON.stringify({ rolloutMode }),
        });
        if (r.ok) {
            const { item } = await r.json();
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        }
        setSavingId(null);
    };

    const saveVersion = async (id: string) => {
        if (!editVersionVal.trim()) return;
        setSavingId(id);
        const r = await fetch(`/api/portfolio/${id}`, {
            method: 'PATCH', headers, credentials: 'include',
            body: JSON.stringify({ version: editVersionVal.trim() }),
        });
        if (r.ok) {
            const { item } = await r.json();
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        }
        setEditVersionId(null);
        setSavingId(null);
    };

    const activateKillSwitch = async (id: string) => {
        if (!window.confirm(t('controlTower.portfolio.killSwitchConfirm'))) return;
        setSavingId(id);
        const r = await fetch(`/api/portfolio/${id}/kill-switch`, {
            method: 'PATCH', headers, credentials: 'include',
        });
        if (r.ok) {
            const { item } = await r.json();
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        }
        setSavingId(null);
    };

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('controlTower.portfolio.title')}</h1>
                        <p className="console-subtitle">{t('controlTower.portfolio.subtitle')}</p>
                    </div>
                </header>

                {loading && <div className="loading-state">Loading…</div>}
                {error && <div className="error-banner">{error}</div>}

                {!loading && !error && (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('controlTower.portfolio.name')}</th>
                                    <th>{t('controlTower.portfolio.type')}</th>
                                    <th>{t('controlTower.portfolio.version')}</th>
                                    <th>{t('controlTower.portfolio.status')}</th>
                                    <th>{t('controlTower.portfolio.rollout')}</th>
                                    <th>{t('controlTower.portfolio.killSwitch')}</th>
                                    <th>{t('controlTower.portfolio.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 && (
                                    <tr><td colSpan={7} className="empty-row">{t('portfolio.noItems')}</td></tr>
                                )}
                                {items.map((item) => (
                                    <tr key={item.id} className={item.killSwitch ? 'row-disabled' : ''}>
                                        <td className="font-medium">{item.name}</td>
                                        <td><span className="pill">{item.type}</span></td>

                                        {/* ── Version — inline edit ── */}
                                        <td>
                                            {editVersionId === item.id ? (
                                                <span className="version-edit-row">
                                                    <input
                                                        className="version-input"
                                                        value={editVersionVal}
                                                        onChange={(e) => setEditVersionVal(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveVersion(item.id);
                                                            if (e.key === 'Escape') setEditVersionId(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button className="btn-xs btn-primary" onClick={() => saveVersion(item.id)}>✓</button>
                                                    <button className="btn-xs" onClick={() => setEditVersionId(null)}>✕</button>
                                                </span>
                                            ) : (
                                                <span
                                                    className="version-display"
                                                    title={t('controlTower.portfolio.clickToEdit')}
                                                    onClick={() => { setEditVersionId(item.id); setEditVersionVal(item.version); }}
                                                >
                                                    {item.version} ✎
                                                </span>
                                            )}
                                        </td>

                                        {/* ── Status dropdown ── */}
                                        <td>
                                            <select
                                                value={item.status}
                                                disabled={item.killSwitch || savingId === item.id}
                                                onChange={(e) => updateStatus(item.id, e.target.value)}
                                                className={`status-select status-${item.status}`}
                                            >
                                                <option value="draft">{t('portfolio.status.draft')}</option>
                                                <option value="published">{t('portfolio.status.published')}</option>
                                                <option value="disabled">{t('portfolio.status.disabled')}</option>
                                            </select>
                                        </td>

                                        {/* ── Rollout mode selector ── */}
                                        <td>
                                            <select
                                                value={item.rolloutMode}
                                                disabled={item.killSwitch || savingId === item.id}
                                                onChange={(e) => updateRollout(item.id, e.target.value)}
                                                className="rollout-select"
                                            >
                                                <option value="all">{t('controlTower.portfolio.rolloutAll')}</option>
                                                <option value="allowlistTenants">{t('controlTower.portfolio.rolloutTenants')}</option>
                                                <option value="allowlistPlans">{t('controlTower.portfolio.rolloutPlans')}</option>
                                            </select>
                                        </td>

                                        {/* ── Kill Switch ── */}
                                        <td>
                                            {item.killSwitch ? (
                                                <span className="badge badge-red">{t('controlTower.portfolio.killSwitchActive')}</span>
                                            ) : (
                                                <span className="badge badge-green">{t('controlTower.portfolio.killSwitchInactive')}</span>
                                            )}
                                        </td>
                                        <td>
                                            {!item.killSwitch && (
                                                <button
                                                    className="kill-switch-btn"
                                                    disabled={savingId === item.id}
                                                    onClick={() => activateKillSwitch(item.id)}
                                                >
                                                    ⚡ {t('controlTower.portfolio.activate')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}

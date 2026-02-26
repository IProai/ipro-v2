import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { getAccessToken } from '../lib/auth';

interface TenantMembership {
    tenantId: string; tenantSlug: string; tenantName: string;
    plan: string; role: string; isCurrent: boolean;
}

interface DashboardSummary {
    user: { id: string; email: string; twoFaEnabled: boolean; lastLoginAt?: string | null };
    tenant: { id: string; name: string; plan: string };
    tenantMemberships: TenantMembership[];
    portfolioTiles: Array<{
        id: string; name: string; type: string; icon?: string;
        descriptionEn: string; descriptionAr: string; launchUrlProd?: string; version: string;
    }>;
    onboardingProgress: { total: number; completed: number; pct: number };
    securityBadge: { twoFaEnabled: boolean; sessionCount: number; lastLoginAt: string | null };
    jadReadiness: { status: string; message: string };
}

// ─── Tile Launch Card — Phase 03 SSO-aware launch ────────────────────────────

function TileLaunchCard({
    tile, isAr, t, authHeader,
}: {
    tile: DashboardSummary['portfolioTiles'][number];
    isAr: boolean;
    t: (key: string, opts?: Record<string, unknown>) => string;
    authHeader: string;
}) {
    const [launching, setLaunching] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);

    const handleLaunch = async () => {
        setLaunching(true);
        setLaunchError(null);
        const r = await fetch(`/api/portfolio/${tile.id}/launch`, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        const data = await r.json().catch(() => ({}));
        setLaunching(false);
        if (r.ok && data.redirectUrl) {
            window.location.href = data.redirectUrl;
        } else {
            setLaunchError(data.error ?? t('portfolio.launch.failed'));
        }
    };

    return (
        <div className="product-tile">
            <div className="tile-icon">{tile.icon ?? '📦'}</div>
            <div className="tile-body">
                <div className="tile-name">{tile.name}</div>
                <div className="tile-desc">
                    {isAr ? tile.descriptionAr : tile.descriptionEn}
                </div>
                <div className="tile-meta">
                    <span className="tile-type">{tile.type}</span>
                    <span className="tile-version">{t('dashboard.tiles.version', { version: tile.version })}</span>
                </div>
                {launchError && <div className="tile-error">{launchError}</div>}
            </div>
            {tile.launchUrlProd && (
                <button
                    id={`launch-${tile.id}`}
                    className="tile-launch-btn"
                    disabled={launching}
                    onClick={handleLaunch}
                >
                    {launching ? '…' : `${t('dashboard.tiles.launch')} ↗`}
                </button>
            )}
        </div>
    );
}

export function DashboardPage() {
    const { t, i18n } = useTranslation();
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const token = getAccessToken(); // available for TileLaunchCard authHeader prop

    useEffect(() => {
        fetch('/api/dashboard/summary', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
        })
            .then((r) => r.json())
            .then((data) => { setSummary(data); setLoading(false); })
            .catch(() => { setError(t('errors.networkError')); setLoading(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);

    const isAr = i18n.language === 'ar';

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('dashboard.title')}</h1>
                        {summary && (
                            <p className="console-subtitle">{t('dashboard.welcome', { name: summary.user.email.split('@')[0] })}</p>
                        )}
                    </div>
                    {/* ── Tenant Switcher ── Blueprint §Tenant Switcher */}
                    {summary && summary.tenantMemberships.length > 1 && (
                        <div className="tenant-switcher">
                            <select
                                className="tenant-select"
                                value={summary.tenant.id}
                                onChange={(e) => {
                                    const selected = summary.tenantMemberships.find((m) => m.tenantId === e.target.value);
                                    if (selected && !selected.isCurrent) {
                                        // Re-route to login with the target tenant slug pre-filled
                                        // Full re-auth is required to get a new tenant-scoped JWT
                                        window.location.href = `/login?tenantSlug=${encodeURIComponent(selected.tenantSlug)}`;
                                    }
                                }}
                            >
                                {summary.tenantMemberships.map((m) => (
                                    <option key={m.tenantId} value={m.tenantId}>
                                        {m.tenantName} ({m.plan}) — {m.role}{m.isCurrent ? ' ✓' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </header>

                {loading && <div className="loading-state">Loading…</div>}
                {error && <div className="error-banner">{error}</div>}

                {summary && (
                    <div className="dashboard-grid">
                        {/* ── Product Tiles ─────────────────────────────────────── */}
                        <section className="dashboard-section full-width">
                            <h2 className="section-title">{t('nav.portfolio')}</h2>
                            {summary.portfolioTiles.length === 0 ? (
                                <div className="empty-state">{t('dashboard.tiles.empty')}</div>
                            ) : (
                                <div className="tiles-grid">
                                    {summary.portfolioTiles.map((tile) => (
                                        <TileLaunchCard
                                            key={tile.id}
                                            tile={tile}
                                            isAr={isAr}
                                            t={t}
                                            authHeader={`Bearer ${token}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* ── Security Badge ────────────────────────────────────── */}
                        <section className="dashboard-section">
                            <h2 className="section-title">{t('dashboard.security.title')}</h2>
                            <div className="badge-card">
                                <div className="badge-row">
                                    <span>{t('dashboard.security.twoFa')}</span>
                                    <span className={`badge ${summary.securityBadge.twoFaEnabled ? 'badge-green' : 'badge-red'}`}>
                                        {summary.securityBadge.twoFaEnabled ? t('dashboard.security.enabled') : t('dashboard.security.disabled')}
                                    </span>
                                </div>
                                <div className="badge-row">
                                    <span>{t('dashboard.security.sessions', { count: summary.securityBadge.sessionCount })}</span>
                                    <span className="badge badge-blue">{summary.securityBadge.sessionCount}</span>
                                </div>
                                <div className="badge-row">
                                    <span>
                                        {summary.securityBadge.lastLoginAt
                                            ? t('dashboard.security.lastLogin', {
                                                date: new Date(summary.securityBadge.lastLoginAt).toLocaleString(i18n.language),
                                            })
                                            : t('dashboard.security.neverLoggedIn')}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* ── JAD Readiness Badge ───────────────────────────────── */}
                        <section className="dashboard-section">
                            <h2 className="section-title">{t('dashboard.jadBadge.title')}</h2>
                            <div className="badge-card jad-badge">
                                <div className="jad-status">{t('dashboard.jadBadge.status')}</div>
                                <div className="jad-hint">{t('dashboard.jadBadge.hint')}</div>
                            </div>
                        </section>

                        {/* ── Onboarding Progress ───────────────────────────────── */}
                        <section className="dashboard-section">
                            <h2 className="section-title">{t('dashboard.onboardingWidget.title')}</h2>
                            <div className="widget-card">
                                <div className="progress-bar-track">
                                    <div className="progress-bar-fill" style={{ width: `${summary.onboardingProgress.pct}%` }} />
                                </div>
                                <p className="progress-label">
                                    {t('dashboard.onboardingWidget.complete', { pct: summary.onboardingProgress.pct })}
                                </p>
                                <Link to="/console/onboarding/checklist" className="widget-link">
                                    {t('dashboard.onboardingWidget.viewChecklist')} →
                                </Link>
                            </div>
                        </section>

                        {/* ── Help Widget ───────────────────────────────────────── */}
                        <section className="dashboard-section">
                            <h2 className="section-title">{t('dashboard.helpWidget.title')}</h2>
                            <div className="widget-card help-widget">
                                <Link to="/console/help/tickets" className="widget-btn">
                                    {t('dashboard.helpWidget.openTicket')}
                                </Link>
                                <Link to="/console/help/knowledge-base" className="widget-btn secondary">
                                    {t('dashboard.helpWidget.viewKB')}
                                </Link>
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}

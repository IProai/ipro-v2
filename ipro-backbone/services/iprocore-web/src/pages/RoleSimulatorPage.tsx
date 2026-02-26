import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../components/Sidebar';
import { getAccessToken } from '../lib/auth';

interface SimulatorMeta {
    permissions: { key: string; description: string }[];
    roles: { id: string; name: string; isSystem: boolean }[];
    tenantUsers: { id: string; email: string }[];
}

interface CheckResult {
    requestId: string;
    targetUser: { id: string; email: string };
    permissionKey: string;
    allowed: boolean;
    reason: string;
    checks: {
        hasMembership: boolean;
        memberRole?: string;
        implicitGrant?: boolean;
        permissionFound?: boolean;
        allRolePermissions?: string[];
    };
}

export function RoleSimulatorPage() {
    const { t } = useTranslation();

    const [meta, setMeta] = useState<SimulatorMeta | null>(null);
    const [metaLoading, setMetaLoading] = useState(false);
    const [metaError, setMetaError] = useState<string | null>(null);

    const [targetUserId, setTargetUserId] = useState('');
    const [permissionKey, setPermissionKey] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<CheckResult | null>(null);
    const [checkError, setCheckError] = useState<string | null>(null);

    const token = getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const loadMeta = async () => {
        if (meta) return; // already loaded
        setMetaLoading(true);
        setMetaError(null);
        const r = await fetch('/api/security/role-simulator', { headers, credentials: 'include' });
        if (r.ok) {
            setMeta(await r.json());
        } else {
            const d = await r.json().catch(() => ({}));
            setMetaError(d.error ?? t('errors.networkError'));
        }
        setMetaLoading(false);
    };

    const runCheck = async () => {
        if (!targetUserId || !permissionKey) return;
        setChecking(true);
        setResult(null);
        setCheckError(null);
        const r = await fetch('/api/security/role-simulator/check', {
            method: 'POST', headers, credentials: 'include',
            body: JSON.stringify({ targetUserId, permissionKey }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
            setResult(data as CheckResult);
        } else {
            setCheckError(data.error ?? t('errors.networkError'));
        }
        setChecking(false);
    };

    // Eagerly load meta on mount
    if (!meta && !metaLoading && !metaError) {
        loadMeta();
    }

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('security.roleSimulator.title')}</h1>
                        <p className="console-subtitle">{t('security.roleSimulator.subtitle')}</p>
                    </div>
                    <span className="badge badge-yellow">{t('security.founderOnly')}</span>
                </header>

                {metaError && <div className="error-banner">{metaError}</div>}

                {metaLoading && <div className="loading-state">Loading…</div>}

                {meta && (
                    <div className="simulator-grid">
                        {/* ── Input Panel ───────────────── */}
                        <section className="widget-card simulator-panel">
                            <h2 className="section-title">{t('security.roleSimulator.simulate')}</h2>

                            <div className="form-group">
                                <label htmlFor="sim-user" className="form-label">
                                    {t('security.roleSimulator.targetUser')}
                                </label>
                                <select
                                    id="sim-user"
                                    className="form-select"
                                    value={targetUserId}
                                    onChange={(e) => setTargetUserId(e.target.value)}
                                >
                                    <option value="">— {t('security.roleSimulator.selectUser')} —</option>
                                    {meta.tenantUsers.map((u) => (
                                        <option key={u.id} value={u.id}>{u.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="sim-perm" className="form-label">
                                    {t('security.roleSimulator.permission')}
                                </label>
                                <select
                                    id="sim-perm"
                                    className="form-select"
                                    value={permissionKey}
                                    onChange={(e) => setPermissionKey(e.target.value)}
                                >
                                    <option value="">— {t('security.roleSimulator.selectPerm')} —</option>
                                    {meta.permissions.map((p) => (
                                        <option key={p.key} value={p.key}>
                                            {p.key} — {p.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                className="btn-primary"
                                disabled={!targetUserId || !permissionKey || checking}
                                onClick={runCheck}
                            >
                                {checking ? t('security.roleSimulator.checking') : t('security.roleSimulator.runCheck')}
                            </button>

                            {checkError && <div className="error-banner mt-2">{checkError}</div>}
                        </section>

                        {/* ── Result Panel ──────────────── */}
                        {result && (
                            <section className={`widget-card simulator-result ${result.allowed ? 'result-allowed' : 'result-denied'}`}>
                                <div className="result-verdict">
                                    <span className={`badge badge-xl ${result.allowed ? 'badge-green' : 'badge-red'}`}>
                                        {result.allowed ? '✅ ALLOWED' : '🚫 DENIED'}
                                    </span>
                                </div>
                                <p className="result-reason">{result.reason}</p>
                                <hr />
                                <h3 className="section-title">{t('security.roleSimulator.checkChain')}</h3>
                                <ul className="check-chain">
                                    <li>
                                        <span className="check-label">{t('security.roleSimulator.hasMembership')}</span>
                                        <span className={`badge ${result.checks.hasMembership ? 'badge-green' : 'badge-red'}`}>
                                            {result.checks.hasMembership ? '✓' : '✗'}
                                        </span>
                                    </li>
                                    {result.checks.memberRole && (
                                        <li>
                                            <span className="check-label">{t('security.roleSimulator.role')}</span>
                                            <span className="pill">{result.checks.memberRole}</span>
                                        </li>
                                    )}
                                    {result.checks.implicitGrant !== undefined && (
                                        <li>
                                            <span className="check-label">{t('security.roleSimulator.implicitGrant')}</span>
                                            <span className={`badge ${result.checks.implicitGrant ? 'badge-green' : 'badge-blue'}`}>
                                                {result.checks.implicitGrant ? 'Yes' : 'No'}
                                            </span>
                                        </li>
                                    )}
                                </ul>
                                {result.checks.allRolePermissions && result.checks.allRolePermissions.length > 0 && (
                                    <>
                                        <h3 className="section-title mt-2">{t('security.roleSimulator.allPerms')}</h3>
                                        <div className="perm-list">
                                            {result.checks.allRolePermissions.map((p) => (
                                                <span
                                                    key={p}
                                                    className={`pill ${p === result.permissionKey ? 'pill-highlight' : ''}`}
                                                >
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                                <p className="result-request-id">
                                    {t('security.roleSimulator.requestId')}: <code>{result.requestId}</code>
                                </p>
                            </section>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authStore } from '../lib/auth';
import { LangToggle } from '../components/LangToggle';

export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [tenantSlug, setTenantSlug] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, tenantSlug }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || t('errors.invalidCredentials'));
                return;
            }

            const { accessToken } = await res.json();
            authStore.setToken(accessToken);
            navigate('/console/dashboard');
        } catch {
            setError(t('errors.networkError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={s.page}>
            {/* Background blur orbs */}
            <div style={{ ...s.orb, ...s.orb1 }} />
            <div style={{ ...s.orb, ...s.orb2 }} />

            {/* Lang toggle top-right */}
            <div style={s.langBar}>
                <LangToggle />
            </div>

            <div className="glass-card" style={s.card}>
                {/* Logo / wordmark */}
                <div style={s.logoRow}>
                    <img src="/logo.jpg" alt="IProCore Logo" style={s.logoIconImg} />
                    <span style={s.logoText}>IProCore</span>
                </div>

                <h1 style={s.title}>{t('login.title')}</h1>
                <p style={s.subtitle}>{t('login.subtitle')}</p>

                <form onSubmit={handleSubmit} style={s.form} noValidate>
                    <div style={s.field}>
                        <label style={s.label}>{t('login.tenantSlug')}</label>
                        <input
                            className="form-input"
                            type="text"
                            value={tenantSlug}
                            onChange={(e) => setTenantSlug(e.target.value)}
                            placeholder="your-organisation"
                            required
                            autoComplete="organization"
                        />
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>{t('login.email')}</label>
                        <input
                            className="form-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div style={s.field}>
                        <div style={s.labelRow}>
                            <label style={s.label}>{t('login.password')}</label>
                            <a href="#" style={s.forgot}>{t('login.forgotPassword')}</a>
                        </div>
                        <input
                            className="form-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    {error && <div style={s.errorBox}>{error}</div>}

                    <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
                        {loading ? t('login.loading') : t('login.submit')}
                    </button>
                </form>
            </div>

            <p style={s.footer}>IProCore — Intellect ProActive Ecosystem</p>
        </div>
    );
}

// ─── Inline styles (no class conflicts) ──────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        position: 'relative',
        overflow: 'hidden',
    },
    orb: {
        position: 'absolute',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
    },
    orb1: {
        width: 500, height: 500,
        background: 'rgba(99,102,241,0.15)',
        top: '-120px', left: '-120px',
    },
    orb2: {
        width: 400, height: 400,
        background: 'rgba(6,182,212,0.10)',
        bottom: '-80px', right: '-80px',
    },
    langBar: {
        position: 'absolute',
        top: 'var(--space-6)',
        right: 'var(--space-6)',
    },
    card: {
        width: '100%',
        maxWidth: 420,
        padding: 'var(--space-10)',
        boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
    },
    logoIconImg: {
        height: '40px',
        width: 'auto',
        objectFit: 'contain' as const,
    },
    logoIcon: {
        fontSize: 28,
        color: 'var(--brand-primary)',
        lineHeight: 1,
    },
    logoText: {
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--text-primary)',
        letterSpacing: '-0.5px',
    },
    title: {
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--font-bold)',
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-2)',
    },
    subtitle: {
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
        marginBottom: 'var(--space-8)',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
    },
    label: {
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)',
        color: 'var(--text-secondary)',
    },
    labelRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    forgot: {
        fontSize: 'var(--text-xs)',
        color: 'var(--brand-primary)',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-error-500)',
        padding: 'var(--space-3) var(--space-4)',
        fontSize: 'var(--text-sm)',
    },
    footer: {
        marginTop: 'var(--space-8)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
    },
};

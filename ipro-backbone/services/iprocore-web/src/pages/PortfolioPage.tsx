import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authStore } from '../lib/auth';
import { LangToggle } from '../components/LangToggle';

interface PortfolioItem {
    id: string;
    name: string;
    type: string;
    status: 'draft' | 'published' | 'disabled';
    descriptionEn: string;
    descriptionAr: string;
    version: string;
    updatedAt: string;
}

export function PortfolioPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const isAr = i18n.language === 'ar';

    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/portfolio', {
                headers: { Authorization: `Bearer ${authStore.getToken()}` },
                credentials: 'include',
            });
            if (!res.ok) { setError(t('errors.forbidden')); return; }
            const data = await res.json();
            setItems(data.items ?? []);
        } catch {
            setError(t('errors.networkError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const badgeClass = (status: string) =>
        status === 'published' ? 'badge badge-published' :
            status === 'disabled' ? 'badge badge-disabled' : 'badge badge-draft';

    return (
        <div style={s.layout}>
            {/* Sidebar */}
            <nav style={s.sidebar}>
                <div style={s.sidebarLogo}>
                    <img src="/logo.jpg" alt="IProCore Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-base)' }}>IProCore</span>
                </div>
                <ul style={s.navList}>
                    <li><button style={s.navItem} onClick={() => navigate('/console/dashboard')}>
                        <span>◈</span> {t('nav.dashboard')}
                    </button></li>
                    <li><button style={{ ...s.navItem, ...s.navItemActive }} onClick={() => { }}>
                        <span>◉</span> {t('nav.portfolio')}
                    </button></li>
                </ul>
                <div style={s.sidebarFooter}>
                    <LangToggle />
                    <button style={s.logoutBtn} onClick={() => {
                        authStore.clearToken();
                        navigate('/login');
                    }}>{t('nav.logout')}</button>
                </div>
            </nav>

            {/* Main */}
            <main style={s.main}>
                <header style={s.header}>
                    <div>
                        <h1 style={s.pageTitle}>{t('portfolio.title')}</h1>
                        <p style={s.pageSubtitle}>{t('portfolio.subtitle')}</p>
                    </div>
                </header>

                {error && <div style={s.errorBox}>{error}</div>}

                {loading ? (
                    <div style={s.loading}>…</div>
                ) : items.length === 0 ? (
                    <div className="glass-card" style={s.emptyCard}>
                        <p style={s.emptyText}>{t('portfolio.noItems')}</p>
                    </div>
                ) : (
                    <div style={s.table}>
                        {/* Table header */}
                        <div style={s.tableHeader}>
                            <span style={s.col}>Name</span>
                            <span style={s.col}>Type</span>
                            <span style={s.col}>Version</span>
                            <span style={s.col}>Status</span>
                            <span style={s.col}>Description</span>
                        </div>
                        {items.map((item) => (
                            <div className="glass-card" key={item.id} style={s.tableRow}>
                                <span style={{ ...s.col, fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>
                                    {item.name}
                                </span>
                                <span style={{ ...s.col, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                    {item.type}
                                </span>
                                <span style={{ ...s.col, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                    {item.version}
                                </span>
                                <span style={s.col}>
                                    <span className={badgeClass(item.status)}>
                                        {t(`portfolio.status.${item.status}`)}
                                    </span>
                                </span>
                                <span style={{ ...s.col, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                    {isAr ? item.descriptionAr : item.descriptionEn}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    layout: { display: 'flex', minHeight: '100vh' },
    sidebar: {
        width: 'var(--nav-width)', minHeight: '100vh',
        background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', padding: 'var(--space-6)', gap: 'var(--space-8)', flexShrink: 0,
    },
    sidebarLogo: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' },
    navList: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 },
    navItem: {
        width: '100%', background: 'none', border: 'none', borderRadius: 'var(--radius-md)',
        color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
        padding: 'var(--space-3) var(--space-4)', textAlign: 'start',
        display: 'flex', gap: 'var(--space-3)', alignItems: 'center', cursor: 'pointer',
    },
    navItemActive: { background: 'var(--brand-glow)', color: 'var(--brand-primary)' },
    sidebarFooter: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
    logoutBtn: {
        background: 'none', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
        fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-4)', cursor: 'pointer',
    },
    main: { flex: 1, padding: 'var(--space-10)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    pageTitle: { fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' },
    pageSubtitle: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' },
    errorBox: {
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 'var(--radius-md)', color: 'var(--color-error-500)',
        padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)',
    },
    loading: { color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-12)' },
    emptyCard: { padding: 'var(--space-10)', textAlign: 'center' },
    emptyText: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' },
    table: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
    tableHeader: {
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 3fr',
        padding: '0 var(--space-4)',
        color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.07em',
    },
    tableRow: {
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 3fr',
        padding: 'var(--space-4)',
        alignItems: 'center',
    },
    col: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

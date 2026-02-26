import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { clearAccessToken } from '../lib/auth';

const NAV_ITEMS = [
    { key: 'nav.dashboard', path: '/console/dashboard' },
    { key: 'nav.controlTower', path: '/console/control-tower' },
    { key: 'nav.onboarding', path: '/console/onboarding' },
    { key: 'nav.help', path: '/console/help' },
    { key: 'nav.ai', path: '/console/ai/suggestions' },
];

export function Sidebar() {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    const handleLogout = () => {
        clearAccessToken();
        window.location.href = '/login';
    };

    const toggleLang = () => {
        const next = i18n.language === 'en' ? 'ar' : 'en';
        void i18n.changeLanguage(next);
    };

    return (
        <aside className="sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <img src="/logo.jpg" alt="IProCore Logo" className="sidebar-brand-logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
                <span className="sidebar-brand-name">IProCore</span>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const active = location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.key}
                            to={item.path}
                            className={`sidebar-nav-item${active ? ' active' : ''}`}
                        >
                            {t(item.key)}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom actions */}
            <div className="sidebar-footer">
                <button className="sidebar-lang-btn" onClick={toggleLang}>
                    {t('nav.toggleLang')}
                </button>
                <button className="sidebar-logout-btn" onClick={handleLogout}>
                    {t('nav.logout')}
                </button>
            </div>
        </aside>
    );
}

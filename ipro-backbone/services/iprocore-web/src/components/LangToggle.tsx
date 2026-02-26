import { useTranslation } from 'react-i18next';

export function LangToggle() {
    const { t, i18n } = useTranslation();

    const toggle = () => {
        const next = i18n.language === 'ar' ? 'en' : 'ar';
        i18n.changeLanguage(next);
    };

    return (
        <button onClick={toggle} style={styles.btn} aria-label="Toggle language">
            {t('nav.toggleLang')}
        </button>
    );
}

const styles: Record<string, React.CSSProperties> = {
    btn: {
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-full)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)',
        padding: '6px 14px',
        cursor: 'pointer',
        transition: 'color var(--transition-fast), border-color var(--transition-fast)',
    },
};

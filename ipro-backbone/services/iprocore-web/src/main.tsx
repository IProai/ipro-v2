import React from 'react';
import ReactDOM from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import App from './App.tsx';
import './styles/tokens.css';
import enJson from './i18n/en.json';
import arJson from './i18n/ar.json';

// ─── i18next init ─────────────────────────────────────────────────────────────
i18n.use(initReactI18next).init({
    resources: {
        en: { translation: enJson },
        ar: { translation: arJson },
    },
    lng: localStorage.getItem('ipro_locale') || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

// Apply RTL dir to document — Skill 03: true RTL (not just text-align)
function applyDir(lang: string) {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
}

applyDir(i18n.language);

i18n.on('languageChanged', (lang) => {
    applyDir(lang);
    localStorage.setItem('ipro_locale', lang);
});

// ─── Render ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);

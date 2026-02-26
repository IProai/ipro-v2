import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { getAccessToken } from '../lib/auth';

interface OnboardingStep {
    id: string; key: string; titleEn: string; titleAr: string;
    order: number; isRequired: boolean; completedAt: string | null;
}

const WIZARD_STEPS = ['welcome', 'portfolio', 'team', 'connect'] as const;

export function OnboardingPage() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isWizard = location.pathname.includes('setup-wizard');
    const isAr = i18n.language === 'ar';
    const token = getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [steps, setSteps] = useState<OnboardingStep[]>([]);
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState<string | null>(null);
    const [wizardStep, setWizardStep] = useState(0);

    useEffect(() => {
        fetch('/api/onboarding/steps', { headers, credentials: 'include' })
            .then((r) => r.json())
            .then((d) => { setSteps(d.steps ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const markComplete = async (key: string) => {
        setMarking(key);
        const r = await fetch(`/api/onboarding/steps/${key}/complete`, {
            method: 'POST', headers, credentials: 'include',
        });
        if (r.ok) {
            const { step } = await r.json();
            setSteps((prev) => prev.map((s) => (s.key === step.key ? step : s)));
        }
        setMarking(null);
    };

    const completed = steps.filter((s) => s.completedAt).length;
    const pct = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('onboarding.title')}</h1>
                    </div>
                    <div className="header-tabs">
                        <Link to="/console/onboarding/checklist" className={`tab${!isWizard ? ' active' : ''}`}>
                            {t('onboarding.checklist.title')}
                        </Link>
                        <Link to="/console/onboarding/setup-wizard" className={`tab${isWizard ? ' active' : ''}`}>
                            {t('onboarding.wizard.title')}
                        </Link>
                    </div>
                </header>

                {/* ── Checklist Tab ── */}
                {!isWizard && (
                    <section className="onboarding-checklist">
                        <div className="progress-header">
                            <span>{t('onboarding.checklist.progress', { completed, total: steps.length })}</span>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                        {loading && <div className="loading-state">Loading…</div>}
                        <ul className="checklist">
                            {steps.map((step) => {
                                const title = isAr ? step.titleAr : step.titleEn;
                                const done = !!step.completedAt;
                                return (
                                    <li key={step.key} className={`checklist-item${done ? ' done' : ''}`}>
                                        <span className="checklist-check">{done ? '✓' : '○'}</span>
                                        <span className="checklist-title">{title}</span>
                                        {!done && (
                                            <button
                                                className="checklist-btn"
                                                disabled={marking === step.key}
                                                onClick={() => markComplete(step.key)}
                                            >
                                                {marking === step.key ? '…' : t('onboarding.checklist.complete')}
                                            </button>
                                        )}
                                        {done && <span className="badge badge-green">{t('onboarding.checklist.done')}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                {/* ── Wizard Tab ── */}
                {isWizard && (
                    <section className="wizard">
                        <div className="wizard-steps-track">
                            {WIZARD_STEPS.map((s, i) => (
                                <div key={s} className={`wizard-step-dot${i === wizardStep ? ' active' : i < wizardStep ? ' done' : ''}`}>
                                    {i + 1}
                                </div>
                            ))}
                        </div>

                        <div className="wizard-panel">
                            {wizardStep === 0 && (
                                <div className="wizard-content">
                                    <h2>{t('onboarding.wizard.steps.welcome')}</h2>
                                    <p>Welcome to IProCore. This wizard will guide you through the first steps of setting up your ecosystem.</p>
                                </div>
                            )}
                            {wizardStep === 1 && (
                                <div className="wizard-content">
                                    <h2>{t('onboarding.wizard.steps.portfolio')}</h2>
                                    <p>Go to <Link to="/console/control-tower">Control Tower → Portfolio</Link> to add and publish your first product.</p>
                                </div>
                            )}
                            {wizardStep === 2 && (
                                <div className="wizard-content">
                                    <h2>{t('onboarding.wizard.steps.team')}</h2>
                                    <p>Team invitations will be available in Phase 03. Your team management module is coming soon.</p>
                                </div>
                            )}
                            {wizardStep === 3 && (
                                <div className="wizard-content">
                                    <h2>{t('onboarding.wizard.steps.connect')}</h2>
                                    <p>Product SSO connections will be available in Phase 03. Your integration layer is coming soon.</p>
                                </div>
                            )}
                        </div>

                        <div className="wizard-footer">
                            <button className="btn-secondary" onClick={() => setWizardStep((s) => Math.max(0, s - 1))} disabled={wizardStep === 0}>
                                {t('onboarding.wizard.back')}
                            </button>
                            {wizardStep < WIZARD_STEPS.length - 1 ? (
                                <button className="btn-primary" onClick={() => setWizardStep((s) => s + 1)}>
                                    {t('onboarding.wizard.next')}
                                </button>
                            ) : (
                                <Link to="/console/dashboard" className="btn-primary">{t('onboarding.wizard.finish')}</Link>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

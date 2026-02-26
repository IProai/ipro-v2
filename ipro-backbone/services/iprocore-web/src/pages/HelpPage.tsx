import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { getAccessToken } from '../lib/auth';
import { fetchHelpSuggestion, AiSuggestion } from '../lib/ai';
import { AIConfirmationModal } from '../components/AIConfirmationModal';

interface KBArticle {
    id: string; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; category: string;
}
interface HelpTicket {
    id: string; subject: string; status: string; createdAt: string;
    user: { email: string };
}

type Tab = 'kb' | 'tutorials' | 'tickets';

export function HelpPage() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isAr = i18n.language === 'ar';
    const token = getAccessToken();
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const getDefaultTab = (): Tab => {
        if (location.pathname.includes('knowledge-base')) return 'kb';
        if (location.pathname.includes('tutorials')) return 'tutorials';
        return 'tickets';
    };
    const [tab, setTab] = useState<Tab>(getDefaultTab());

    const [articles, setArticles] = useState<KBArticle[]>([]);
    const [tickets, setTickets] = useState<HelpTicket[]>([]);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const [loadingTickets, setLoadingTickets] = useState(false);

    // Ticket form state
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);

    // AI suggestion state
    const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
    const [suggestingId, setSuggestingId] = useState<string | null>(null);

    useEffect(() => {
        setLoadingArticles(true);
        fetch('/api/help/articles', { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => { setArticles(d.articles ?? []); setLoadingArticles(false); })
            .catch(() => setLoadingArticles(false));
    }, []);

    useEffect(() => {
        setLoadingTickets(true);
        fetch('/api/help/tickets', { headers: authHeaders, credentials: 'include' })
            .then((r) => r.json())
            .then((d) => { setTickets(d.tickets ?? []); setLoadingTickets(false); })
            .catch(() => setLoadingTickets(false));
    }, []);

    const submitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !body.trim()) return;
        setSubmitting(true);
        const r = await fetch('/api/help/tickets', {
            method: 'POST', headers: authHeaders, credentials: 'include',
            body: JSON.stringify({ subject, body }),
        });
        if (r.ok) {
            const { ticket } = await r.json();
            setTickets((prev) => [ticket, ...prev]);
            setSubject('');
            setBody('');
            setSubmitMsg(t('help.tickets.submitSuccess'));
            setTimeout(() => setSubmitMsg(null), 3000);
        }
        setSubmitting(false);
    };

    const handleAiSuggest = async (ticketId: string) => {
        setSuggestingId(ticketId);
        try {
            const suggestion = await fetchHelpSuggestion(ticketId);
            setAiSuggestion(suggestion);
        } catch (err) {
            alert(t('errors.networkError'));
        } finally {
            setSuggestingId(null);
        }
    };

    return (
        <div className="console-layout">
            <Sidebar />
            <main className="console-main">
                <header className="console-header">
                    <div>
                        <h1 className="console-title">{t('help.title')}</h1>
                    </div>
                    <div className="header-tabs">
                        <Link
                            to="/console/help/knowledge-base"
                            className={`tab${tab === 'kb' ? ' active' : ''}`}
                            onClick={() => setTab('kb')}
                        >
                            {t('help.tabs.kb')}
                        </Link>
                        <Link
                            to="/console/help/tutorials"
                            className={`tab${tab === 'tutorials' ? ' active' : ''}`}
                            onClick={() => setTab('tutorials')}
                        >
                            {t('help.tabs.tutorials')}
                        </Link>
                        <Link
                            to="/console/help/tickets"
                            className={`tab${tab === 'tickets' ? ' active' : ''}`}
                            onClick={() => setTab('tickets')}
                        >
                            {t('help.tabs.tickets')}
                        </Link>
                    </div>
                </header>

                {/* ── Knowledge Base Tab ── */}
                {tab === 'kb' && (
                    <section className="help-kb">
                        {loadingArticles && <div className="loading-state">Loading…</div>}
                        {!loadingArticles && articles.length === 0 && (
                            <div className="empty-state">{t('help.articles.empty')}</div>
                        )}
                        <div className="kb-grid">
                            {articles.map((article) => (
                                <div key={article.id} className="kb-card">
                                    <div className="kb-category">{t('help.articles.category', { category: article.category })}</div>
                                    <h3 className="kb-title">{isAr ? article.titleAr : article.titleEn}</h3>
                                    <p className="kb-body">{isAr ? article.bodyAr : article.bodyEn}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Tutorials Tab ── */}
                {tab === 'tutorials' && (
                    <section className="help-tutorials">
                        <div className="tutorials-grid">
                            {/* Tutorials are static shell per Phase 02 spec — AI video/interactive content in Phase 05 */}
                            {[
                                { id: 't1', titleEn: 'Getting Started with IProCore', titleAr: 'البدء مع IProCore', duration: '5 min', level: 'beginner' },
                                { id: 't2', titleEn: 'Setting Up Your Portfolio', titleAr: 'إعداد محفظتك', duration: '8 min', level: 'beginner' },
                                { id: 't3', titleEn: 'Onboarding Your Team', titleAr: 'تهيئة فريقك', duration: '10 min', level: 'intermediate' },
                                { id: 't4', titleEn: 'Using the Control Tower', titleAr: 'استخدام برج التحكم', duration: '12 min', level: 'intermediate' },
                                { id: 't5', titleEn: 'Publishing & Kill Switch', titleAr: 'النشر ومفتاح الإيقاف', duration: '6 min', level: 'advanced' },
                                { id: 't6', titleEn: 'Understanding Audit Logs', titleAr: 'فهم سجلات التدقيق', duration: '7 min', level: 'advanced' },
                            ].map((tutorial) => (
                                <div key={tutorial.id} className="tutorial-card">
                                    <div className="tutorial-thumb">▶</div>
                                    <div className="tutorial-body">
                                        <h3 className="tutorial-title">{isAr ? tutorial.titleAr : tutorial.titleEn}</h3>
                                        <div className="tutorial-meta">
                                            <span className="tutorial-duration">⏱ {tutorial.duration}</span>
                                            <span className={`tutorial-level level-${tutorial.level}`}>{tutorial.level}</span>
                                        </div>
                                        <div className="tutorial-coming">{t('help.tutorials.comingSoon')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Tickets Tab ── */}
                {tab === 'tickets' && (
                    <section className="help-tickets">
                        {/* Create ticket form */}
                        <div className="ticket-form-card">
                            <h2>{t('help.tickets.new')}</h2>
                            {submitMsg && <div className="success-banner">{submitMsg}</div>}
                            <form onSubmit={submitTicket} className="ticket-form">
                                <div className="form-field">
                                    <label>{t('help.tickets.subject')}</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder={t('help.tickets.subject')}
                                        required
                                    />
                                </div>
                                <div className="form-field">
                                    <label>{t('help.tickets.body')}</label>
                                    <textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        rows={5}
                                        placeholder={t('help.tickets.body')}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? '…' : t('help.tickets.submit')}
                                </button>
                            </form>
                        </div>

                        {/* Ticket history */}
                        <div className="ticket-list">
                            <h2>{t('help.tickets.historyTitle')}</h2>
                            {loadingTickets && <div className="loading-state">Loading…</div>}
                            {!loadingTickets && tickets.length === 0 && (
                                <div className="empty-state">{t('help.tickets.empty')}</div>
                            )}
                            {tickets.map((ticket) => (
                                <div key={ticket.id} className="ticket-row">
                                    <div className="ticket-subject">{ticket.subject}</div>
                                    <span className={`badge status-badge-${ticket.status}`}>
                                        {t(`help.tickets.status.${ticket.status}`)}
                                    </span>
                                    <span className="ticket-date">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                    <button
                                        className="btn-primary"
                                        style={{ padding: '4px 12px', fontSize: '12px', width: 'auto', marginLeft: 'auto' }}
                                        disabled={!!suggestingId}
                                        onClick={() => handleAiSuggest(ticket.id)}
                                    >
                                        {suggestingId === ticket.id ? '…' : t('help.tickets.aiSuggest')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {aiSuggestion && (
                <AIConfirmationModal
                    suggestion={aiSuggestion}
                    onClose={() => setAiSuggestion(null)}
                />
            )}
        </div>
    );
}

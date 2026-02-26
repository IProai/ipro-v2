import { getAccessToken } from './auth';

export interface AiSuggestion {
    id: string;
    suggestionType: 'workflow_draft' | 'onboarding_draft' | 'help_reply' | 'integration_suggestion';
    contextSummary: string;
    suggestionText: string;
    status: 'pending' | 'confirmed' | 'dismissed' | 'expired';
    confirmedAt?: string;
    confirmedByUserId?: string;
    workflowRunId?: string;
    expiresAt: string;
    createdAt: string;
}

export interface AiActivityLog {
    id: string;
    actorId: string;
    action: string;
    suggestionId?: string;
    workflowRunId?: string;
    triggerSource: string;
    requestId: string;
    meta: any;
    createdAt: string;
}

export interface AiPlaybook {
    source: string;
    sourceType: string;
    portfolioItemId: string;
    playbookLabel: string;
    description: string;
}

const getHeaders = () => {
    const token = getAccessToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export async function fetchSuggestions(): Promise<AiSuggestion[]> {
    const res = await fetch('/api/ai/suggestions', {
        headers: getHeaders(),
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    const data = await res.json();
    return data.suggestions;
}

export async function confirmSuggestion(id: string, action: 'confirm' | 'dismiss') {
    const res = await fetch(`/api/ai/suggestions/${id}/confirm`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ confirmationAction: action }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to confirm suggestion');
    }
    return res.json();
}

export async function fetchActivity(limit = 50): Promise<AiActivityLog[]> {
    const res = await fetch(`/api/ai/activity?limit=${limit}`, {
        headers: getHeaders(),
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch AI activity');
    const data = await res.json();
    return data.activity;
}

export async function fetchPlaybooks(): Promise<AiPlaybook[]> {
    const res = await fetch('/api/ai/playbooks', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch playbooks');
    const data = await res.json();
    return data.playbooks;
}

export async function fetchHelpSuggestion(ticketId: string): Promise<AiSuggestion> {
    const res = await fetch(`/api/help/tickets/${ticketId}/ai-suggest`, {
        headers: getHeaders(),
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch AI help suggestion');
    const data = await res.json();
    return data.suggestion;
}

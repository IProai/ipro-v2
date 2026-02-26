/**
 * In-memory access token store.
 * Access token lives in memory (not localStorage) — XSS safe.
 * Refresh token in HttpOnly cookie — handled automatically by browser.
 * Blueprint §Auth: short-lived access token.
 */

let _accessToken: string | null = null;

export const authStore = {
    getToken: () => _accessToken,
    setToken: (t: string) => { _accessToken = t; },
    clearToken: () => { _accessToken = null; },
    isAuthenticated: () => !!_accessToken,
};

/** Convenience helpers for direct import in pages/components */
export const getAccessToken = (): string | null => _accessToken;
export const clearAccessToken = (): void => { _accessToken = null; };

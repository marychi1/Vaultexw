export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('vaultex-token');
}

export function isSignedIn(): boolean {
    return Boolean(getAuthToken());
}

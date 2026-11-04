export function getApiBaseUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    const rawUrl = configuredUrl || (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : '');
    if (!rawUrl) {
        throw new Error('NEXT_PUBLIC_API_URL must point to the deployed VAULTEX backend.');
    }

    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('NEXT_PUBLIC_API_URL must be a valid backend origin.');
    }

    const localDevelopmentUrl =
        process.env.NODE_ENV === 'development' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

    if (
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        (url.protocol !== 'https:' && !localDevelopmentUrl)
    ) {
        throw new Error('NEXT_PUBLIC_API_URL must be an HTTPS backend origin (HTTP is allowed for local development).');
    }

    return url.origin;
}

export type SandboxWireInput = {
    amount: number;
    currencyCode: 'USD';
    recipientName: string;
    bankAccountId: string;
    counterpartyId: string;
    description?: string;
    pin: string;
};

export type SandboxWireReceipt = {
    reference: string;
    status: string;
    amount: number;
    currencyCode: string;
    recipient: { name: string };
    submittedAt: string;
    statusNote: string;
};

export async function submitSandboxWire(
    input: SandboxWireInput,
    idempotencyKey: string,
) {
    const token = typeof window === 'undefined' ? null : localStorage.getItem('vaultex-token');
    if (!token) throw new Error('Sign in before submitting a sandbox wire.');

    const response = await fetch(`${getApiBaseUrl()}/api/column/transfers/wire/sandbox`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(input),
        cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result.error || 'Sandbox wire submission failed.');
        Object.assign(error, { status: response.status });
        throw error;
    }

    return result as SandboxWireReceipt;
}

export async function requestOtp(phone: string) {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OTP request failed');
    return data;
}

export async function verifyOtp(phone: string, code: string) {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OTP verification failed');
    return data;
}

export async function loginUser(phone: string, pin: string, deviceName = 'Web Browser') {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, deviceId: `next-${Date.now()}`, deviceName }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    return data;
}

export async function signupUser(phone: string, pin: string, code: string) {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phone,
            pin,
            code,
            deviceId: `next-${Date.now()}`,
            deviceName: 'Web Browser',
        }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Signup failed');
    return data;
}

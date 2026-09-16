const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function resolveApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configuredUrl || DEFAULT_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

export async function requestOtp(phone: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'OTP request failed');
  return data;
}

export async function verifyOtp(phone: string, code: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'OTP verification failed');
  return data;
}

export async function loginUser(phone: string, pin: string, deviceName = 'Web Browser') {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin, deviceId: `next-${Date.now()}`, deviceName }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function signupUser(phone: string, pin: string, walletAddress: string, encryptedPrivateKey: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      pin,
      walletAddress,
      encryptedPrivateKey,
      deviceId: `next-${Date.now()}`,
      deviceName: 'Web Browser',
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export async function getWallet(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/wallet`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load wallet');
  return data;
}

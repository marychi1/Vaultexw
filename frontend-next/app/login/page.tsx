"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSignedIn } from '@/lib/wallet';
import { loginUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+1 555 123 4567');
  const [pin, setPin] = useState('1234');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!phone || !pin) {
      setMessage('Please provide phone and PIN.');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      const result = await loginUser(phone, pin);
      localStorage.setItem('vaultex-token', result.token);
      localStorage.setItem('vaultex-user', JSON.stringify({ phone, walletAddress: result.user.walletAddress }));
      setMessage('Login successful. Redirecting...');
      window.location.href = '/dashboard';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-block narrow">
      <section className="card">
        <p className="eyebrow">Welcome back</p>
        <h1>Login to Vaultex</h1>

        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

          <label>
            PIN
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </label>

          <button className="button primary full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="muted">
            Need an account? <a href="/signup">Create one</a>
          </p>

          {message && <p className="muted">{message}</p>}
        </form>
      </section>
    </div>
  );
}

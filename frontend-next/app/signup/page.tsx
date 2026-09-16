"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSignedIn } from '@/lib/wallet';
import { requestOtp, verifyOtp, signupUser } from '@/lib/api';

export default function SignUpPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+1 555 123 4567');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('1234');
  const [confirmPin, setConfirmPin] = useState('1234');
  const [step, setStep] = useState<'phone' | 'otp' | 'pin'>('phone');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleRequestOtp = async () => {
    try {
      setLoading(true);
      await requestOtp(phone);
      setMessage('OTP sent to your phone.');
      setStep('otp');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setLoading(true);
      await verifyOtp(phone, otp);
      setMessage('OTP verified. Create your PIN.');
      setStep('pin');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!phone || !pin || !confirmPin) {
      setMessage('Please complete all fields.');
      return;
    }

    if (pin !== confirmPin) {
      setMessage('PINs do not match.');
      return;
    }

    try {
      setLoading(true);
      const walletAddress = '0x1c89d6b3b2aad82f3519c5e4938e2e8976030b36';
      const encryptedPrivateKey = 'demo-encrypted-key';
      const result = await signupUser(phone, pin, walletAddress, encryptedPrivateKey);
      localStorage.setItem('vaultex-token', result.token);
      localStorage.setItem('vaultex-user', JSON.stringify({ phone, walletAddress }));
      setMessage('Account created successfully!');
      window.location.href = '/dashboard';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-block narrow">
      <section className="card">
        <p className="eyebrow">Create account</p>
        <h1>Create your wallet</h1>

        <div className="form-stack">
          {step === 'phone' && (
            <>
              <label>
                Phone number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <button className="button primary full" onClick={handleRequestOtp} disabled={loading}>
                {loading ? 'Sending...' : 'Request OTP'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <label>
                OTP code
                <input value={otp} onChange={(e) => setOtp(e.target.value)} />
              </label>
              <button className="button primary full" onClick={handleVerifyOtp} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </>
          )}

          {step === 'pin' && (
            <form onSubmit={handleSubmit} className="form-stack">
              <label>
                Create PIN
                <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
              </label>

              <label>
                Confirm PIN
                <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
              </label>

              <button className="button primary full" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create wallet'}
              </button>
            </form>
          )}

          {message && <p className="muted">{message}</p>}
        </div>
      </section>
    </div>
  );
}

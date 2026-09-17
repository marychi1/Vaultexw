"use client";

import { FormEvent, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { sendWallet } from '@/lib/api';
import { getAuthToken, hydrateWalletFromBackend } from '@/lib/wallet';

export default function SendPage() {
    const [to, setTo] = useState('0x1c89d6b3b2aad82f3519c5e4938e2e8976030b36');
    const [amount, setAmount] = useState('250');
    const [pin, setPin] = useState('1234');
    const [status, setStatus] = useState('');
    const [sending, setSending] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        const nextAmount = Number(amount);

        if (!to || !nextAmount || nextAmount <= 0) {
            setStatus('Please enter a valid recipient and amount.');
            return;
        }

        if (!getAuthToken()) {
            setStatus('Please sign in again to continue.');
            window.location.href = '/login';
            return;
        }

        setSending(true);
        try {
            await sendWallet(getAuthToken()!, to, nextAmount, pin);
            await hydrateWalletFromBackend();
            setStatus(`Transfer initiated: ${nextAmount} USDT to ${to}`);
            window.location.href = '/dashboard';
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Transfer failed.');
        } finally {
            setSending(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="page-block narrow auth-shell">
                <section className="auth-card card">
                    <div className="auth-header">
                        <div className="eyebrow">Send funds</div>
                        <h1>Send USDT</h1>
                    </div>

                    <form onSubmit={handleSubmit} className="form-stack">
                        <label>
                            Recipient address
                            <input value={to} onChange={(e) => setTo(e.target.value)} />
                        </label>

                        <label>
                            Amount (USDT)
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        </label>

                        <label>
                            PIN
                            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
                        </label>

                        <button className="button primary full" type="submit" disabled={sending}>
                            {sending ? 'Sending...' : 'Confirm transfer'}
                        </button>

                        {status && <p className="status-message">{status}</p>}
                    </form>
                </section>
            </div>
        </ProtectedRoute>
    );
}

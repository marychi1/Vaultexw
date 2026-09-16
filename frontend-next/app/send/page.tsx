"use client";

import { FormEvent, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { createWalletTransaction, getAuthToken, getWalletState, saveWalletState, WalletState } from '@/lib/wallet';

export default function SendPage() {
  const [to, setTo] = useState('0x1c89d6b3b2aad82f3519c5e4938e2e8976030b36');
  const [amount, setAmount] = useState('250');
  const [pin, setPin] = useState('1234');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const wallet = getWalletState();
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

    if (pin !== '1234') {
      setStatus('PIN verification failed.');
      return;
    }

    setSending(true);
    const updatedBalance = Math.max(0, wallet.balance - nextAmount);
    const updated: WalletState = {
      ...wallet,
      balance: updatedBalance,
      transactions: [
        createWalletTransaction({
          type: 'withdrawal',
          amount: -nextAmount,
          status: 'pending',
        }),
        ...wallet.transactions,
      ],
    };

    saveWalletState(updated);
    setStatus(`Transfer initiated: ${nextAmount} USDT to ${to}`);
    setSending(false);
    window.location.href = '/dashboard';
  };

  return (
    <ProtectedRoute>
      <div className="page-block narrow">
        <section className="card">
          <p className="eyebrow">Send funds</p>
          <h1>Send USDT</h1>

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

            {status && <p className="muted">{status}</p>}
          </form>
        </section>
      </div>
    </ProtectedRoute>
  );
}

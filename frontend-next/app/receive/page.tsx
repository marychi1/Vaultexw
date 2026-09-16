"use client";

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { defaultWallet, getWalletState, hydrateWalletFromBackend, saveWalletState } from '@/lib/wallet';

export default function ReceivePage() {
  const [wallet, setWallet] = useState(defaultWallet);

  useEffect(() => {
    const localWallet = getWalletState();
    if (localWallet.address) {
      setWallet(localWallet);
    }

    hydrateWalletFromBackend().then((next) => {
      setWallet(next);
      saveWalletState(next);
    }).catch(() => {
      setWallet(localWallet);
    });
  }, []);

  return (
    <ProtectedRoute>
      <div className="page-block narrow">
        <section className="card">
          <p className="eyebrow">Receive funds</p>
          <h1>Wallet address</h1>

          <div className="form-stack">
            <label>
              USDT address
              <input value={wallet.address || ''} readOnly />
            </label>

            <div className="card secondary-box">
              <p className="muted">Share this address to receive USDT on Polygon.</p>
              <p><strong>{wallet.address || 'Address unavailable'}</strong></p>
            </div>

            <a href="/dashboard" className="button primary full">Back to dashboard</a>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}

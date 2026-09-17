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
            <div className="page-block narrow auth-shell">
                <section className="auth-card card">
                    <div className="auth-header">
                        <div className="eyebrow">Receive funds</div>
                        <h1>Wallet address</h1>
                    </div>

                    <div className="form-stack">
                        <label>
                            USDT address
                            <input value={wallet.address || ''} readOnly />
                        </label>

                        <div className="secondary-box receive-box">
                            <p className="muted">Share this address to receive USDT on Polygon.</p>
                            <p className="address-display"><strong>{wallet.address || 'Address unavailable'}</strong></p>
                        </div>

                        <a href="/dashboard" className="button primary full">Back to dashboard</a>
                    </div>
                </section>
            </div>
        </ProtectedRoute>
    );
}

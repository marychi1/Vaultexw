"use client";

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { defaultWallet, getWalletState, hydrateWalletFromBackend, saveWalletState, WalletState } from '@/lib/wallet';

export default function DashboardPage() {
    const [wallet, setWallet] = useState<WalletState>(defaultWallet);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        async function loadWallet() {
            const hydrated = await hydrateWalletFromBackend();
            if (!active) return;
            setWallet(hydrated);
            saveWalletState(hydrated);
            setLoading(false);
        }

        const localWallet = getWalletState();
        if (localWallet.address) {
            setWallet(localWallet);
            setLoading(false);
        }

        loadWallet();

        return () => {
            active = false;
        };
    }, []);

    const transactionRows = wallet.transactions.length ? wallet.transactions : [];

    return (
        <ProtectedRoute>
            <div className="page-block">
                <section className="card hero-card">
                    <div>
                        <p className="eyebrow">Balance</p>
                        <h1>{loading ? 'Loading...' : `${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}</h1>
                        <p className="muted">Wallet: {wallet.address || 'Not available'}</p>
                    </div>
                    <div className="actions">
                        <a href="/send" className="button primary">Send</a>
                        <a href="/receive" className="button secondary">Receive</a>
                    </div>
                </section>

                <section className="grid two-col">
                    <div className="card">
                        <h2>Portfolio</h2>
                        <div className="stat-row">
                            <span>Network</span>
                            <strong>Polygon</strong>
                        </div>
                        <div className="stat-row">
                            <span>Phone</span>
                            <strong>{wallet.phone || 'Unknown'}</strong>
                        </div>
                        <div className="stat-row">
                            <span>Security</span>
                            <strong>PIN + OTP</strong>
                        </div>
                    </div>

                    <div className="card">
                        <h2>Quick actions</h2>
                        <div className="stacked-actions">
                            <a href="/send" className="button primary full">Send USDT</a>
                            <a href="/receive" className="button secondary full">Receive USDT</a>
                            <a href="/dashboard" className="button secondary full">View history</a>
                        </div>
                    </div>
                </section>

                <section className="card">
                    <h2>Recent Transactions</h2>
                    {transactionRows.length === 0 ? (
                        <p className="muted">No transactions yet.</p>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactionRows.map((tx) => (
                                    <tr key={tx.id}>
                                        <td>{tx.id}</td>
                                        <td>{tx.type}</td>
                                        <td>{tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} USDT</td>
                                        <td>{tx.date}</td>
                                        <td><span className={`pill ${tx.status}`}>{tx.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </ProtectedRoute>
    );
}

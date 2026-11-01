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
            <div className="page-block wallet-page">
                <section className="card wallet-hero">
                    <div>
                        <div className="eyebrow">Balance</div>
                        <h1>{loading ? 'Loading...' : `${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}</h1>
                        <p className="muted wallet-address-line">Wallet: {wallet.address || 'Not available'}</p>
                    </div>
                    <div className="actions">
                        <a href="/send" className="button primary">Send</a>
                        <a href="/receive" className="button secondary">Receive</a>
                    </div>
                </section>

                <section className="wallet-metrics">
                    <div className="metric-block">
                        <div className="label">Available balance</div>
                        <strong>{loading ? '...' : `${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong>
                        <span className="metric-trend">USDT on Polygon</span>
                    </div>
                    <div className="metric-block">
                        <div className="label">Payment security</div>
                        <strong>PIN</strong>
                        <span className="metric-trend">Required to send</span>
                    </div>
                    <div className="metric-block">
                        <div className="label">Network</div>
                        <strong>Polygon</strong>
                        <span className="metric-trend">USDT transfers</span>
                    </div>
                </section>

                <section className="grid two-col wallet-grid">
                    <div className="card summary-card">
                        <div className="eyebrow-title">Portfolio</div>
                        <h2>Account overview</h2>
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

                    <div className="card summary-card">
                        <div className="eyebrow-title">Quick actions</div>
                        <h2>Move funds instantly</h2>
                        <div className="stacked-actions">
                            <a href="/send" className="button primary full">Send USDT</a>
                            <a href="/receive" className="button secondary full">Receive USDT</a>
                            <a href="/dashboard" className="button secondary full">View history</a>
                        </div>
                    </div>
                </section>

                <section className="card transaction-card">
                    <div className="eyebrow-title">Recent activity</div>
                    <h2>Recent Transactions</h2>
                    {transactionRows.length === 0 ? (
                        <p className="muted">No transactions yet.</p>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Recipient</th>
                                    <th>Reference</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactionRows.map((tx) => (
                                    <tr key={tx.id}>
                                        <td title={tx.recipient || tx.type}>
                                            {tx.recipient ? `${tx.recipient.slice(0, 8)}...${tx.recipient.slice(-6)}` : tx.type}
                                        </td>
                                        <td title={tx.reference || tx.id}>
                                            {`${(tx.reference || tx.id).slice(0, 10)}...${(tx.reference || tx.id).slice(-8)}`}
                                        </td>
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

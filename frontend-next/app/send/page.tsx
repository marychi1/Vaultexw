"use client";

import { FormEvent, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { sendWallet } from '@/lib/api';
import { getAuthToken, hydrateWalletFromBackend } from '@/lib/wallet';

type TransferReceipt = {
    txHash: string;
    to: string;
    amount: number;
    status: 'completed' | 'pending' | 'failed';
    network: string;
    completedAt: string;
};

function shorten(value: string) {
    return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function SendPage() {
    const [to, setTo] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState('');
    const [sending, setSending] = useState(false);
    const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
    const [copied, setCopied] = useState('');

    const copyValue = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            window.setTimeout(() => setCopied(''), 1800);
        } catch {
            setStatus(`Could not copy ${label.toLowerCase()}. Select and copy it manually.`);
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setStatus('');

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
            const result = await sendWallet(getAuthToken()!, to, nextAmount, pin);
            await hydrateWalletFromBackend();
            setReceipt({
                txHash: result.txHash,
                to: result.to,
                amount: Number(result.amount),
                status: result.status,
                network: result.network,
                completedAt: result.completedAt,
            });
            setPin('');
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
                        <div className="eyebrow">{receipt ? 'Payment receipt' : 'Send funds'}</div>
                        <h1>{receipt ? 'Transfer details' : 'Send USDT'}</h1>
                    </div>

                    {receipt ? (
                        <div className="receipt">
                            <div className={`receipt-status ${receipt.status}`}>
                                <span aria-hidden="true">{receipt.status === 'completed' ? '✓' : '!'}</span>
                                <div>
                                    <strong>{receipt.status === 'completed' ? 'Delivered to recipient wallet' : receipt.status === 'pending' ? 'Transfer in progress' : 'Transfer failed'}</strong>
                                    <small>{receipt.status === 'completed' ? 'Confirmed on the Polygon network' : receipt.status === 'pending' ? 'Waiting for Polygon network confirmation' : 'The transfer was not confirmed'}</small>
                                </div>
                            </div>
                            <ol className={`transfer-progress ${receipt.status}`} aria-label="Transfer progress">
                                <li className="complete">
                                    <span className="progress-marker" aria-hidden="true">✓</span>
                                    <span className="progress-copy"><strong>Sent</strong><small>Transaction submitted</small></span>
                                </li>
                                <li className={receipt.status === 'completed' ? 'complete' : receipt.status === 'pending' ? 'current' : 'failed'}>
                                    <span className="progress-marker" aria-hidden="true">{receipt.status === 'completed' ? '✓' : receipt.status === 'pending' ? '2' : '!'}</span>
                                    <span className="progress-copy"><strong>In progress</strong><small>{receipt.status === 'completed' ? 'Network confirmation received' : receipt.status === 'pending' ? 'Confirming on Polygon' : 'Confirmation failed'}</small></span>
                                </li>
                                <li className={receipt.status === 'completed' ? 'complete' : receipt.status === 'pending' ? 'upcoming' : 'upcoming'}>
                                    <span className="progress-marker" aria-hidden="true">{receipt.status === 'completed' ? '✓' : '3'}</span>
                                    <span className="progress-copy"><strong>Delivered</strong><small>Available at the recipient wallet on Polygon</small></span>
                                </li>
                            </ol>
                            <div className="receipt-amount">{receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT</div>
                            <dl className="receipt-details">
                                <div>
                                    <dt>Recipient wallet</dt>
                                    <dd>
                                        <span title={receipt.to}>{shorten(receipt.to)}</span>
                                        <button type="button" className="copy-button" onClick={() => void copyValue('Recipient wallet', receipt.to)}>
                                            {copied === 'Recipient wallet' ? 'Copied' : 'Copy'}
                                        </button>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Reference</dt>
                                    <dd>
                                        <span title={receipt.txHash}>{shorten(receipt.txHash)}</span>
                                        <button type="button" className="copy-button" onClick={() => void copyValue('Reference', receipt.txHash)}>
                                            {copied === 'Reference' ? 'Copied' : 'Copy'}
                                        </button>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Network</dt>
                                    <dd>{receipt.network}</dd>
                                </div>
                                <div>
                                    <dt>Date and time</dt>
                                    <dd>{new Date(receipt.completedAt).toLocaleString()}</dd>
                                </div>
                            </dl>
                            <p className="receipt-note">This receipt shows payment details only. It does not include your private credentials or account balance.</p>
                            <div className="receipt-actions">
                                <button type="button" className="button secondary" onClick={() => window.print()}>Print / Save receipt</button>
                                <a className="button secondary" href={`https://polygonscan.com/tx/${encodeURIComponent(receipt.txHash)}`} target="_blank" rel="noreferrer">View on PolygonScan</a>
                                <button type="button" className="button primary" onClick={() => {
                                    setReceipt(null);
                                    setTo('');
                                    setAmount('');
                                    setStatus('');
                                }}>Send another</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="form-stack">
                            <label>
                                Recipient wallet address
                                <input autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} />
                            </label>

                            <label>
                                Amount (USDT)
                                <input type="number" min="0" step="0.000001" value={amount} onChange={(e) => setAmount(e.target.value)} />
                            </label>

                            <label>
                                PIN
                                <input type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
                            </label>

                            <button className="button primary full" type="submit" disabled={sending}>
                                {sending ? 'Sending...' : 'Confirm transfer'}
                            </button>

                            {status && <p className="status-message" role="alert">{status}</p>}
                        </form>
                    )}
                </section>
            </div>
        </ProtectedRoute>
    );
}

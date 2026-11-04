"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitSandboxWire, type SandboxWireReceipt } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

type Attempt = { key: string; fingerprint: string };

export default function WireSandboxForm() {
    const attempt = useRef<Attempt | null>(null);
    const [amount, setAmount] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [bankAccountId, setBankAccountId] = useState('');
    const [counterpartyId, setCounterpartyId] = useState('');
    const [description, setDescription] = useState('');
    const [pin, setPin] = useState('');
    const [retryLocked, setRetryLocked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [receipt, setReceipt] = useState<SandboxWireReceipt | null>(null);
    const [signedIn, setSignedIn] = useState(false);

    useEffect(() => {
        setSignedIn(Boolean(getAuthToken()));
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(amount)) {
            setMessage('Enter a positive USD amount with no more than two decimal places.');
            return;
        }
        const amountInCents = Math.round(Number(amount) * 100);
        if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
            setMessage('Enter a positive USD amount with no more than two decimal places.');
            return;
        }

        const input = {
            amount: amountInCents,
            currencyCode: 'USD' as const,
            recipientName: recipientName.trim(),
            bankAccountId: bankAccountId.trim(),
            counterpartyId: counterpartyId.trim(),
            description: description.trim() || undefined,
            pin,
        };
        const fingerprint = JSON.stringify(input);
        if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
            attempt.current = { key: crypto.randomUUID(), fingerprint };
        }

        setBusy(true);
        setMessage('');
        try {
            const result = await submitSandboxWire(input, attempt.current.key);
            setReceipt(result);
            setMessage('Sandbox request accepted by Column. This is not a live payment.');
        } catch (error) {
            const status = typeof error === 'object' && error !== null && 'status' in error
                ? Number(error.status)
                : undefined;
            if (status === undefined || status >= 500) {
                setRetryLocked(true);
                setMessage('The result may be uncertain. Retry this exact request with the same idempotency key; do not create a new request until it is reconciled.');
            } else {
                setMessage(error instanceof Error ? error.message : 'Sandbox wire submission failed.');
            }
        } finally {
            setBusy(false);
        }
    }

    function resetForm() {
        attempt.current = null;
        setAmount('');
        setRecipientName('');
        setBankAccountId('');
        setCounterpartyId('');
        setDescription('');
        setPin('');
        setRetryLocked(false);
        setReceipt(null);
        setMessage('');
    }

    return (
        <div className="sandbox-workspace">
            {!signedIn && (
                <p className="sandbox-notice" role="status">
                    Sign in to your test account before submitting. Sandbox access requires a configured Column test key.
                </p>
            )}
            {receipt ? (
                <section className="sandbox-receipt" aria-live="polite">
                    <div className="eyebrow-title">Column sandbox response</div>
                    <div className="sandbox-receipt-status">
                        <span>Test status</span>
                        <strong>{receipt.status}</strong>
                    </div>
                    <dl>
                        <div><dt>Amount</dt><dd>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(receipt.amount)}</dd></div>
                        <div><dt>Recipient</dt><dd>{receipt.recipient.name}</dd></div>
                        <div><dt>Reference</dt><dd>{receipt.reference}</dd></div>
                        <div><dt>Submitted</dt><dd>{new Date(receipt.submittedAt).toLocaleString()}</dd></div>
                    </dl>
                    <p>{receipt.statusNote}</p>
                    <button className="button secondary" onClick={resetForm} type="button">Start another test</button>
                </section>
            ) : (
                <form className="sandbox-form" onSubmit={handleSubmit}>
                    <div className="sandbox-form-heading">
                        <div>
                            <span className="eyebrow-title">USD · test environment only</span>
                            <h2>Transfer details</h2>
                        </div>
                        <span className="sandbox-chip">SANDBOX</span>
                    </div>
                    <div className="sandbox-fields">
                        <label>
                            Amount (USD)
                            <input
                                inputMode="decimal"
                                pattern="[0-9]+([.][0-9]{1,2})?"
                                placeholder="250.00"
                                required
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                disabled={busy || retryLocked}
                            />
                        </label>
                        <label>
                            Recipient name
                            <input
                                autoComplete="off"
                                maxLength={100}
                                required
                                value={recipientName}
                                onChange={(event) => setRecipientName(event.target.value)}
                                disabled={busy || retryLocked}
                            />
                        </label>
                        <label>
                            Sandbox bank account ID
                            <input
                                autoComplete="off"
                                required
                                value={bankAccountId}
                                onChange={(event) => setBankAccountId(event.target.value)}
                                disabled={busy || retryLocked}
                            />
                        </label>
                        <label>
                            Sandbox counterparty ID
                            <input
                                autoComplete="off"
                                required
                                value={counterpartyId}
                                onChange={(event) => setCounterpartyId(event.target.value)}
                                disabled={busy || retryLocked}
                            />
                        </label>
                        <label className="sandbox-field-wide">
                            Description <span>(optional)</span>
                            <input
                                maxLength={140}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                disabled={busy || retryLocked}
                            />
                        </label>
                        <label className="sandbox-field-wide">
                            Account PIN
                            <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="current-password"
                                minLength={4}
                                maxLength={8}
                                pattern="[0-9]{4,8}"
                                required
                                value={pin}
                                onChange={(event) => setPin(event.target.value)}
                                disabled={busy || retryLocked}
                            />
                        </label>
                    </div>
                    <div className="sandbox-submit-row">
                        <p>This calls Column only when the backend is explicitly configured with a test key and sandbox mode.</p>
                        <button className="button primary" type="submit" disabled={busy || !signedIn}>
                            {busy ? 'Submitting…' : retryLocked ? 'Retry same request' : 'Submit sandbox wire'}
                        </button>
                    </div>
                    {message && <p className="status-message" role="status" aria-live="polite">{message}</p>}
                </form>
            )}
        </div>
    );
}

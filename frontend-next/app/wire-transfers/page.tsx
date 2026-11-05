import Link from 'next/link';

export default function WireTransfersPage() {
    return (
        <main className="page-block narrow">
            <section className="card">
                <div className="eyebrow">Bank wire service</div>
                <h1>USD sandbox testing</h1>
                <p className="muted">
                    The authenticated backend frontend includes a sandbox-only test wire form.
                    Live submission remains disabled unless separately approved and configured.
                </p>
                <p className="muted">
                    Sandbox submissions require a non-production backend, an explicit sandbox opt-in,
                    a Column test key, PostgreSQL tracking, and test bank-account/counterparty IDs.
                    The customer app is not connected to this submission flow.
                </p>
                <p className="muted">
                    Column has confirmed that its outgoing domestic USD wires use Fedwire. VAULTEX
                    production access is still unverified, and this integration does not select the
                    settlement rail. Sandbox tests do not establish that VAULTEX is enabled for live
                    Fedwire transfers.
                </p>
                <div className="actions">
                    <Link href="/send" className="button primary">Open wire sandbox</Link>
                    <Link href="/" className="button secondary">Back to home</Link>
                </div>
            </section>
        </main>
    );
}

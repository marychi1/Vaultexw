import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import WireSandboxForm from '@/components/WireSandboxForm';

export default function SendPage() {
    return (
        <ProtectedRoute>
            <main className="page-block sandbox-page">
                <section className="sandbox-hero">
                    <div>
                        <div className="eyebrow">Column test environment</div>
                        <h1>Send a <span className="highlight">test wire.</span></h1>
                        <p>
                            Exercise the USD wire flow against Column sandbox using test bank-account
                            and counterparty IDs. No live transfer is enabled by this screen.
                        </p>
                        <Link className="button secondary" href="/wire-transfers">Review service limits</Link>
                    </div>
                    <aside className="sandbox-guardrail">
                        <span className="sandbox-chip">SANDBOX ONLY</span>
                        <strong>No live funds</strong>
                        <p>Backend rejects this route in production and rejects keys that are not Column test keys.</p>
                    </aside>
                </section>
                <WireSandboxForm />
            </main>
        </ProtectedRoute>
    );
}

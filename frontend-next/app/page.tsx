export default function HomePage() {
    return (
        <main className="page-block premium-home">
            <section className="hero-shell">
                <div className="hero-copy">
                    <div className="eyebrow">Thoughtful banking, built for trust</div>
                    <h1>
                        Move money with <span className="highlight">clarity.</span>
                    </h1>
                    <p>
                        A focused workspace for domestic USD bank wires, with clear status at every step.
                        Explore the test flow safely before any live service is made available.
                    </p>
                    <div className="actions">
                        <a href="/send" className="button primary">Open wire sandbox</a>
                        <a href="/wire-transfers" className="button secondary">How it works</a>
                    </div>
                    <div className="hero-assurance">
                        <span aria-hidden="true">✓</span>
                        Test environment only
                        <span className="assurance-divider" aria-hidden="true" />
                        Live wires remain disabled
                    </div>
                </div>
                <aside className="hero-visual premium-visual" aria-label="Wire transfer service information">
                    <div className="visual-topline"><span>VAULTEX / BANK WIRES</span><span className="sandbox-chip">USD ONLY</span></div>
                    <div className="visual-amount">Clear, considered<br />wire testing.</div>
                    <div className="visual-caption">Transfer availability is controlled by backend configuration.</div>
                    <div className="visual-rule" />
                    <div className="visual-row"><span>Transfer scope</span><strong>Domestic USD</strong></div>
                    <div className="visual-row"><span>Environment</span><strong>See verified banner above</strong></div>
                    <div className="visual-footnote">A Column status is not proof of beneficiary-bank credit.</div>
                </aside>
            </section>

            <section className="premium-intro">
                <div className="eyebrow-title">A more considered way to test</div>
                <h2>Every detail, designed around confidence.</h2>
            </section>
            <section className="grid two-col premium-cards">
                <div className="feature-card">
                    <div className="feature-icon" aria-hidden="true">01</div>
                    <div className="eyebrow-title">Safe by default</div>
                    <h2>Sandbox, not production.</h2>
                    <p>
                        The test route requires an explicit environment opt-in and a Column test key.
                        Production always rejects sandbox submissions.
                    </p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon" aria-hidden="true">02</div>
                    <div className="eyebrow-title">Clear expectations</div>
                    <h2>Status is not settlement.</h2>
                    <p>
                        Column test responses help validate integration behavior. They do not represent
                        beneficiary-bank credit or prove live service availability.
                    </p>
                </div>
            </section>
            <footer className="site-footer premium-footer">
                <span>VAULTEX</span>
                <span>Domestic USD wire testing · no live funds</span>
            </footer>
        </main>
    );
}

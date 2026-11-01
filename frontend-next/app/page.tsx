export default function HomePage() {
    return (
        <main className="page-block">
            <section className="hero-shell">
                <div className="hero-copy">
                    <div className="eyebrow">Bank wire transfers</div>
                    <h1>
                        A focused service for <span className="highlight">bank payments.</span>
                    </h1>
                    <p>
                        VAULTEX is being rebuilt for domestic bank wires. Transfers are not currently
                        available from this application, and international corridors have not been confirmed.
                    </p>
                    <div className="actions">
                        <a href="/wire-transfers" className="button primary">Wire service status</a>
                        <a href="/contact" className="button secondary">Contact us</a>
                    </div>
                </div>
            </section>

            <section className="grid two-col">
                <div className="feature-card">
                    <div className="eyebrow-title">Current status</div>
                    <h2>No live wires are enabled.</h2>
                    <p>
                        The customer application is not yet connected to an authenticated bank-wire
                        service. Do not use it to initiate or rely on a transfer.
                    </p>
                </div>
                <div className="feature-card">
                    <div className="eyebrow-title">International availability</div>
                    <h2>Corridors need confirmation.</h2>
                    <p>
                        Supported countries, currencies, beneficiary requirements, fees, and delivery
                        times must be confirmed with Column before international wires can be offered.
                    </p>
                </div>
            </section>
        </main>
    );
}

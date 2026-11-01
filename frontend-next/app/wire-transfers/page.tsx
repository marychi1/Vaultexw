export default function WireTransfersPage() {
    return (
        <main className="page-block narrow">
            <section className="card">
                <div className="eyebrow">Bank wire service</div>
                <h1>Transfers are not enabled</h1>
                <p className="muted">
                    VAULTEX is not currently connected to a customer-authorized bank-wire workflow.
                    Do not submit payment instructions through this site.
                </p>
                <p className="muted">
                    The backend currently models USD wires only. International availability, supported
                    corridors, currencies, fees, and delivery times still require confirmation from Column.
                </p>
                <a href="/" className="button secondary">Back to home</a>
            </section>
        </main>
    );
}

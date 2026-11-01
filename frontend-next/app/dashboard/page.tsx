import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <div className="page-block narrow">
                <section className="card">
                    <div className="eyebrow">Account</div>
                    <h1>Bank wires are not available yet</h1>
                    <p className="muted">
                        This account does not have a connected bank-wire service. No transfer can be
                        started or tracked here.
                    </p>
                    <a href="/wire-transfers" className="button primary">View wire service status</a>
                </section>
            </div>
        </ProtectedRoute>
    );
}

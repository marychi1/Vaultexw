export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 980, margin: '0 auto' }}>
      <section style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'center' }}>
        <div>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', marginBottom: '0.75rem', fontSize: '0.8rem' }}>Secure USDT wallet</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: '1rem' }}>Manage your digital assets with confidence.</h1>
          <p style={{ color: '#cbd5e1', fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 620 }}>
            Vaultex gives you a secure wallet experience with OTP verification, PIN protection, wallet access, and a clean dashboard for transfers and balances.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.75rem' }}>
            <a href="/signup" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '0.9rem 1.3rem', background: '#22c55e', color: '#03130b', fontWeight: 700 }}>Create wallet</a>
            <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '0.9rem 1.3rem', background: '#1e293b', border: '1px solid #334155', color: '#e5e7eb', fontWeight: 700 }}>Login</a>
          </div>
        </div>

        <div style={{ border: '1px solid #334155', borderRadius: 18, padding: '1.5rem', background: 'rgba(17,24,39,0.9)', boxShadow: '0 20px 30px rgba(15,23,42,0.28)' }}>
          <h2 style={{ marginBottom: '1rem' }}>Why Vaultex</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ border: '1px solid #334155', borderRadius: 12, padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Wallet</h3>
              <p style={{ margin: 0, color: '#cbd5e1' }}>Dashboard, balance visibility, and transfer actions in one place.</p>
            </div>
            <div style={{ border: '1px solid #334155', borderRadius: 12, padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Security</h3>
              <p style={{ margin: 0, color: '#cbd5e1' }}>OTP checks, PIN protection, and device-aware auth controls.</p>
            </div>
            <div style={{ border: '1px solid #334155', borderRadius: 12, padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Ready for growth</h3>
              <p style={{ margin: 0, color: '#cbd5e1' }}>Built for later expansion into on-chain data, notifications, and richer product flows.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

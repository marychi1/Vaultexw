export default function HomePage() {
    return (
        <main className="page-block">
            <section className="hero-shell">
                <div className="hero-copy">
                    <div className="eyebrow">Secure USDT wallet</div>
                    <h1>
                        Manage your digital assets with <span className="highlight">confidence.</span>
                    </h1>
                    <p>
                        A secure digital wallet experience for people and businesses moving value with
                        clarity, control, and confidence.
                    </p>
                    <div className="actions">
                        <a href="#platform" className="button primary">Explore Vaultex</a>
                        <a href="/contact" className="button secondary">Contact us</a>
                    </div>
                </div>

                <div className="hero-visual" aria-label="Wallet overview card">
                    <div className="wallet-panel">
                        <div className="wallet-top">
                            <div className="wallet-label">Portfolio</div>
                            <div className="wallet-chip" />
                        </div>

                        <div className="wallet-balance">
                            <strong>
                                $<span>76,840</span>
                            </strong>
                            <div className="wallet-address">0x4A92...b84C</div>
                        </div>

                        <div className="asset-list">
                            <div className="asset-item">
                                <div className="asset-meta">
                                    <div className="asset-dot cyan">₮</div>
                                    <div>
                                        <div className="asset-name">USDT</div>
                                    </div>
                                </div>
                                <div className="asset-right">
                                    <div className="asset-value">$42,380</div>
                                    <div className="asset-change up">+2.4%</div>
                                </div>
                            </div>

                            <div className="asset-item">
                                <div className="asset-meta">
                                    <div className="asset-dot violet">Ξ</div>
                                    <div>
                                        <div className="asset-name">ETH</div>
                                    </div>
                                </div>
                                <div className="asset-right">
                                    <div className="asset-value">$18,950</div>
                                    <div className="asset-change up">+1.7%</div>
                                </div>
                            </div>

                            <div className="asset-item">
                                <div className="asset-meta">
                                    <div className="asset-dot mint">₿</div>
                                    <div>
                                        <div className="asset-name">BTC</div>
                                    </div>
                                </div>
                                <div className="asset-right">
                                    <div className="asset-value">$15,510</div>
                                    <div className="asset-change down">-0.6%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="trust-strip">
                <div>Bank-grade security</div>
                <div>USDT-first rails</div>
                <div>Live transaction visibility</div>
                <div>Protected access</div>
            </div>

            <div className="metric-grid">
                <div className="metric">
                    <div className="label">Verified wallets</div>
                    <strong>24K+</strong>
                </div>
                <div className="metric">
                    <div className="label">Daily volume</div>
                    <strong>$8.4M</strong>
                </div>
                <div className="metric">
                    <div className="label">Uptime</div>
                    <strong>99.98%</strong>
                </div>
            </div>

            <div className="grid two-col" id="platform">
                <div className="feature-card">
                    <div className="eyebrow-title">Why Vaultex</div>
                    <h2>Built for secure, everyday finance.</h2>
                    <p>
                        Designed for users who want a clean wallet experience without sacrificing safety,
                        control, or clarity.
                    </p>
                    <ul className="feature-list">
                        <li>Security designed into every interaction</li>
                        <li>Clear visibility across balances and movement</li>
                        <li>Infrastructure ready for the next generation of finance</li>
                    </ul>
                </div>

                <div className="feature-card">
                    <div className="eyebrow-title">Operational confidence</div>
                    <h2>Institutional-grade trust signals.</h2>
                    <p>
                        Every interaction is designed to feel premium, transparent, and reliable enough
                        for serious wallet activity and future product growth.
                    </p>
                    <ul className="feature-list">
                        <li>High-contrast dark mode with premium cyan and violet accents</li>
                        <li>Clear typography system built for wallet data and value displays</li>
                        <li>App-ready foundation for secure financial workflows</li>
                    </ul>
                </div>
            </div>

            <section className="story-grid">
                <div className="story-card story-card-dark">
                    <div className="eyebrow-title">How it works</div>
                    <h2>From onboarding to transfer in three steps.</h2>
                    <div className="steps">
                        <div className="step">
                            <span>01</span>
                            <div>
                                <h3>Create your wallet</h3>
                                <p>Secure signup with identity-ready onboarding and device tracking.</p>
                            </div>
                        </div>
                        <div className="step">
                            <span>02</span>
                            <div>
                                <h3>Verify and protect</h3>
                                <p>Use OTP verification and PIN controls to keep your account secure.</p>
                            </div>
                        </div>
                        <div className="step">
                            <span>03</span>
                            <div>
                                <h3>Move funds fast</h3>
                                <p>Send, receive, and track transfers with a clear, user-friendly workflow.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="story-card story-card-accent">
                    <div className="eyebrow-title">Built for scale</div>
                    <h2>Frictionless financial experiences.</h2>
                    <p>
                        Vaultex is designed to evolve from secure wallet access into a broader financial
                        platform without breaking the user experience.
                    </p>
                    <div className="cta-mini">
                        <strong>Let&apos;s build what&apos;s next</strong>
                        <a href="/contact" className="button primary">Start a conversation</a>
                    </div>
                </div>
            </section>

            <section className="bottom-cta">
                <div>
                    <div className="eyebrow-title">Work with Vaultex</div>
                    <h2>Bring a more secure financial future into focus.</h2>
                </div>
                <div className="bottom-actions">
                    <a href="/contact" className="button primary">Contact us</a>
                </div>
            </section>

            <footer className="site-footer">
                <div className="footer-brand">
                    <span className="brand-mark" aria-hidden="true" />
                    <span>VAULTEX</span>
                </div>
                <div className="footer-links">
                    <a href="#platform">Platform</a>
                    <a href="/contact">Contact</a>
                </div>
                <div className="footer-meta">Digital finance, with intention.</div>
            </footer>
        </main>
    );
}

export default function ContactPage() {
    return (
        <main className="page-block contact-page">
            <section className="contact-hero">
                <div>
                    <div className="eyebrow">Start a conversation</div>
                    <h1>Let&apos;s move value forward.</h1>
                    <p>
                        Tell us what you are building, what you need to move, or where your current
                        financial workflow is getting in the way. The Vaultex team will be in touch.
                    </p>
                </div>
                <div className="contact-signal" aria-hidden="true">
                    <span className="contact-signal-ring" />
                    <span className="contact-signal-core" />
                </div>
            </section>

            <section className="contact-grid">
                <div className="contact-card">
                    <div className="eyebrow-title">Reach the team</div>
                    <h2>Useful conversations start here.</h2>
                    <p>
                        Whether you are exploring a partnership, need product information, or want to
                        understand the platform, send us a note and we will route it to the right person.
                    </p>
                    <a className="contact-email" href="mailto:hello@vaultex.io">hello@vaultex.io</a>
                </div>

                <form className="contact-form" action="mailto:hello@vaultex.io" method="post" encType="text/plain">
                    <label htmlFor="name">Name</label>
                    <input id="name" name="name" type="text" autoComplete="name" required />

                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required />

                    <label htmlFor="message">How can we help?</label>
                    <textarea id="message" name="message" rows={6} required />

                    <button className="button primary" type="submit">Send message</button>
                </form>
            </section>
        </main>
    );
}

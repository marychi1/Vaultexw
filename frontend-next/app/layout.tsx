"use client";

import './globals.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isSignedIn } from '@/lib/wallet';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const [signedIn, setSignedIn] = useState(false);

    useEffect(() => {
        setSignedIn(isSignedIn());
        const onStorage = () => setSignedIn(isSignedIn());
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const signOut = () => {
        localStorage.removeItem('vaultex-token');
        localStorage.removeItem('vaultex-user');
        localStorage.removeItem('vaultex-wallet');
        setSignedIn(false);
        window.location.href = '/login';
    };

    return (
        <html lang="en">
            <body>
                <div className="shell">
                    <header className="topbar">
                        <div className="brand" aria-label="Vaultex home">
                            <span className="brand-mark" aria-hidden="true" />
                            <span className="brand-text">V<span>AULT</span>EX</span>
                        </div>
                        <nav className="nav">
                            <Link href="/">Home</Link>
                            {!signedIn && <Link href="/login">Login</Link>}
                            {!signedIn && <Link href="/signup">Sign up</Link>}
                            {signedIn && <Link href="/dashboard">Dashboard</Link>}
                            {signedIn && <Link href="/send">Send</Link>}
                            {signedIn && <Link href="/receive">Receive</Link>}
                            {signedIn && <button type="button" className="nav-button" onClick={signOut}>Sign out</button>}
                        </nav>
                    </header>
                    <main>{children}</main>
                </div>
            </body>
        </html>
    );
}

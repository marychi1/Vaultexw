"use client";

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';

type Environment = 'development' | 'staging' | 'production';
type WireSubmissions = 'sandbox' | 'live' | 'disabled';
type EnvironmentResponse = { environment?: Environment; wireSubmissions?: WireSubmissions };

export default function EnvironmentBanner() {
    const [status, setStatus] = useState<EnvironmentResponse | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let active = true;
        let apiBaseUrl: string;
        try {
            apiBaseUrl = getApiBaseUrl();
        } catch {
            setStatus(null);
            setChecking(false);
            return () => {
                active = false;
            };
        }

        fetch(`${apiBaseUrl}/api/environment`, {
            cache: 'no-store',
        })
            .then(async (response) => {
                if (!response.ok) throw new Error('Environment status unavailable');
                const result = await response.json() as EnvironmentResponse;
                if (!['development', 'staging', 'production'].includes(result.environment || '')) {
                    throw new Error('Environment status invalid');
                }
                if (!['sandbox', 'live', 'disabled'].includes(result.wireSubmissions || '')) {
                    throw new Error('Wire submission status invalid');
                }
                if (active) setStatus(result);
            })
            .catch(() => {
                if (active) setStatus(null);
            })
            .finally(() => {
                if (active) setChecking(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const environment = status?.environment;
    const wireSubmissions = status?.wireSubmissions;
    const copy = checking
        ? 'Checking transfer environment…'
        : !environment || !wireSubmissions
            ? 'ENVIRONMENT UNVERIFIED — backend API is not configured or reachable.'
            : environment === 'production'
                ? wireSubmissions === 'live'
                    ? 'PRODUCTION ENVIRONMENT — live wire submissions are enabled.'
                    : 'PRODUCTION ENVIRONMENT — wire submissions are disabled.'
                : environment === 'staging'
                    ? 'STAGING ENVIRONMENT — no live wire submissions.'
                    : wireSubmissions === 'sandbox'
                        ? 'DEVELOPMENT / COLUMN SANDBOX — test mode only. No live funds move.'
                        : 'DEVELOPMENT / SANDBOX — live transfers are disabled; Column test submission is not configured.';

    return (
        <div className={`environment-banner environment-${environment || (checking ? 'checking' : 'unknown')}`} role="status" aria-live="polite">
            <span className="environment-indicator" aria-hidden="true" />
            <span>{copy}</span>
        </div>
    );
}

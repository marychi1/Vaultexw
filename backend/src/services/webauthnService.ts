import { Fido2Lib } from 'fido2-lib';
import Database from './database';

function toBase64Url(buf: Buffer) {
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(base64url: string) {
    base64url = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64url.length % 4) base64url += '=';
    return Buffer.from(base64url, 'base64');
}

const f2l = new Fido2Lib({
    timeout: 60000,
    rpId: 'localhost',
    rpName: 'Vaultex',
    challengeSize: 64,
    attestation: 'direct',
    authenticatorRequireResidentKey: false,
    authenticatorUserVerification: 'preferred',
});

export default class WebAuthnService {
    static async generateRegistrationOptions(phone: string) {
        const user = { id: toBase64Url(Buffer.from(phone)), name: phone, displayName: phone };
        const opts = await f2l.attestationOptions();
        opts.user = user as any;
        const challengeValue = opts.challenge as any;
        const challenge = toBase64Url(Buffer.from(challengeValue));
        opts.challenge = challengeValue as any;
        opts.pubKeyCredParams = [{ type: 'public-key', alg: -7 }];
        opts.timeout = 60000;

        Database.createWebAuthnChallenge(phone, challenge);
        return opts;
    }

    static async verifyRegistration(phone: string, attestationResponse: any) {
        const storedChallenge = Database.getWebAuthnChallenge(phone);
        if (!storedChallenge) {
            throw new Error('No registration challenge found for phone');
        }

        const clientAttestationResponse = {
            ...attestationResponse,
            rawId: fromBase64Url(attestationResponse.rawId),
            response: {
                clientDataJSON: fromBase64Url(attestationResponse.response.clientDataJSON),
                attestationObject: fromBase64Url(attestationResponse.response.attestationObject),
            },
        } as any;

        const expected = {
            challenge: fromBase64Url(storedChallenge.challenge),
            origin: 'http://localhost:5173',
            factor: 'either',
        } as any;

        const regResult = await f2l.attestationResult(clientAttestationResponse, expected);
        Database.removeWebAuthnChallenge(phone);

        const authnrData = regResult.authnrData;
        const credentialId = toBase64Url(authnrData.get('credId'));
        const publicKey = authnrData.get('credentialPublicKeyPem') || authnrData.get('credentialPublicKey');
        const counter = authnrData.get('counter') || 0;

        Database.storeCredential(phone, credentialId, publicKey, counter);
        return { registered: true };
    }

    static async generateAssertionOptions(phone: string) {
        const allowCredentials = Database.getCredentialsForPhone(phone).map((c: any) => ({
            id: fromBase64Url(c.credentialId) as any,
            type: 'public-key' as const,
        }));
        const opts = await f2l.assertionOptions();
        const challengeValue = opts.challenge as any;
        const challenge = toBase64Url(Buffer.from(challengeValue));
        opts.challenge = challengeValue as any;
        opts.allowCredentials = allowCredentials as any;

        Database.createWebAuthnChallenge(phone, challenge);
        return opts;
    }

    static async verifyAssertion(phone: string, assertionResponse: any) {
        const storedChallenge = Database.getWebAuthnChallenge(phone);
        if (!storedChallenge) {
            throw new Error('No assertion challenge found for phone');
        }

        const clientAssertionResponse = {
            ...assertionResponse,
            rawId: fromBase64Url(assertionResponse.rawId),
            response: {
                clientDataJSON: fromBase64Url(assertionResponse.response.clientDataJSON),
                authenticatorData: fromBase64Url(assertionResponse.response.authenticatorData),
                signature: fromBase64Url(assertionResponse.response.signature),
                userHandle: assertionResponse.response.userHandle ? fromBase64Url(assertionResponse.response.userHandle) : null,
            },
        } as any;

        const credential = Database.getCredential(phone, clientAssertionResponse.id);
        if (!credential) {
            throw new Error('Unknown credential');
        }

        const expected = {
            challenge: fromBase64Url(storedChallenge.challenge),
            origin: 'http://localhost:5173',
            factor: 'either',
            publicKey: credential.publicKey,
            prevCounter: credential.counter,
        } as any;

        const result = await f2l.assertionResult(clientAssertionResponse, expected);
        Database.updateCredentialCounter(phone, clientAssertionResponse.id, result.authnrData.get('counter'));
        Database.removeWebAuthnChallenge(phone);
        return { authenticated: true };
    }
}

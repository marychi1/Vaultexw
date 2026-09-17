class MockFido2Lib {
    constructor() { }

    async attestationOptions() {
        return {
            challenge: Buffer.alloc(32),
            rp: { id: 'localhost', name: 'Vaultex' },
            user: { id: 'mock-user', name: 'mock-user', displayName: 'Mock User' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            timeout: 60000,
        };
    }

    async assertionOptions() {
        return {
            challenge: Buffer.alloc(32),
            allowCredentials: [],
            timeout: 60000,
        };
    }

    async attestationResult() {
        return {
            authnrData: new Map([
                ['credId', Buffer.from('mock-cred-id')],
                ['credentialPublicKeyPem', 'mock-public-key'],
                ['counter', 1],
            ]),
        };
    }

    async assertionResult() {
        return {
            authnrData: new Map([['counter', 1]]),
        };
    }
}

module.exports = {
    Fido2Lib: MockFido2Lib,
};

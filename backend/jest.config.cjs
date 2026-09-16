module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    moduleNameMapper: {
        '^uuid$': '<rootDir>/__mocks__/uuid.js',
        '^fido2-lib$': '<rootDir>/__mocks__/fido2-lib.js',
    },
};

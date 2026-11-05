import type { Pool } from 'pg';
import Database from '../src/services/database';
import PostgresService from '../src/services/postgresService';

describe('customer counterparty database ownership', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.restoreAllMocks();
    });

    test('scopes beneficiary lookup by user, provider ID, and active state', async () => {
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://test.invalid/db';
        const query = jest.fn().mockResolvedValue({ rows: [] });
        jest.spyOn(PostgresService, 'getPool').mockReturnValue({ query } as unknown as Pool);
        jest.spyOn(PostgresService, 'ensureSchema').mockResolvedValue(true);

        await expect(Database.getColumnCustomerCounterpartyForUser('user_123', 'cpty_456'))
            .resolves.toBeUndefined();

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE user_id = $1 AND counterparty_id = $2 AND status = \'ACTIVE\''),
            ['user_123', 'cpty_456'],
        );
    });
});

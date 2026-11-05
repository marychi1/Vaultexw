import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/authService';
import Database from '../services/database';

interface AuthRequest extends Request {
    userId?: string;
    deviceId?: string;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = AuthService.verifyAuthToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        const device = await Database.getDeviceById(decoded.deviceId);
        if (!device || !device.authorized || device.userId !== decoded.userId) {
            return res.status(403).json({ error: 'Device access revoked or unauthorized' });
        }

        req.userId = decoded.userId;
        req.deviceId = decoded.deviceId;
        return next();
    } catch (error) {
        console.error('[Auth] Device authorization lookup failed:', error);
        return res.status(503).json({ error: 'Unable to verify device authorization' });
    }
};

export default authMiddleware;

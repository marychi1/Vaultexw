import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/authService';
import Database from '../services/database';

interface AuthRequest extends Request {
    userId?: string;
    deviceId?: string;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = AuthService.verifyAuthToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const device = await Database.getDeviceById(decoded.deviceId);
    if (!device || !device.authorized) {
        return res.status(403).json({ error: 'Device access revoked or unauthorized' });
    }

    req.userId = decoded.userId;
    req.deviceId = decoded.deviceId;
    next();
};

export default authMiddleware;

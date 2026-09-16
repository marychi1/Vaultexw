import { v4 as uuidv4 } from 'uuid';
import Database from './database';
import { OTP } from '../models/types';

class OTPService {
    static generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    static createOTP(phone: string): OTP {
        const otp: OTP = {
            id: uuidv4(),
            phone,
            code: this.generateOTP(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            attempts: 0,
            createdAt: new Date(),
        };

        return Database.createOTP(otp);
    }

    static verifyOTP(phone: string, code: string): boolean {
        const otp = Database.getOTPByPhone(phone);

        if (!otp) {
            return false;
        }

        if (otp.expiresAt < new Date()) {
            return false;
        }

        if (otp.attempts >= 3) {
            return false;
        }

        if (otp.code !== code) {
            Database.updateOTP(otp.id, { attempts: otp.attempts + 1 });
            return false;
        }

        return true;
    }

    static sendOTPToPhone(phone: string): { code: string; expiresAt: Date } {
        // In production, use a service like Twilio to send SMS
        // For now, we'll log it
        const otp = this.createOTP(phone);
        console.log(`[OTP Service] Sending OTP ${otp.code} to ${phone} (expires at ${otp.expiresAt})`);
        // Audit log
        try {
            // Lazy import to avoid circular deps
            const AuditService = require('./auditService').default;
            AuditService.logEvent('otp_sent', { phone, otpId: otp.id });
        } catch (err) {
            // ignore
        }

        return { code: otp.code, expiresAt: otp.expiresAt };
    }
}

export default OTPService;

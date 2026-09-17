import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import Database from './database';
import { OTP } from '../models/types';
import { getBackendConfig } from '../config';

class OTPService {
    static generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    static async createOTP(phone: string): Promise<OTP> {
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

    static async verifyOTP(phone: string, code: string): Promise<boolean> {
        const otp = await Database.getOTPByPhone(phone);

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
            await Database.updateOTP(otp.id, { attempts: otp.attempts + 1 });
            return false;
        }

        return true;
    }

    static async sendOTPToPhone(phone: string): Promise<{ code: string; expiresAt: Date }> {
        const otp = await this.createOTP(phone);
        const config = getBackendConfig();

        if (config.otpProvider === 'twilio') {
            await this.sendWithTwilio(phone, otp.code, config);
        } else {
            console.log(`[OTP Service] Sending OTP ${otp.code} to ${phone} (expires at ${otp.expiresAt})`);
        }
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

    private static async sendWithTwilio(phone: string, code: string, config: ReturnType<typeof getBackendConfig>): Promise<void> {
        if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromPhone) {
            throw new Error('Twilio OTP configuration is incomplete');
        }

        const body = new URLSearchParams({
            To: phone,
            From: config.twilioFromPhone,
            Body: `Your Vaultex verification code is ${code}. It expires in 10 minutes.`,
        }).toString();

        await new Promise<void>((resolve, reject) => {
            const request = https.request({
                hostname: 'api.twilio.com',
                path: `/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
                method: 'POST',
                auth: `${config.twilioAccountSid}:${config.twilioAuthToken}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body),
                },
            }, (response) => {
                let responseBody = '';
                response.on('data', (chunk) => { responseBody += chunk; });
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Twilio OTP request failed (${response.statusCode}): ${responseBody}`));
                    }
                });
            });

            request.on('error', reject);
            request.write(body);
            request.end();
        });
    }
}

export default OTPService;

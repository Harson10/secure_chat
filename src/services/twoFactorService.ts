import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export class TwoFactorService {
    // Génère un secret pour 2FA
    static generateSecret(username: string) {
        const secret = speakeasy.generateSecret({
            name: `YourApp:${username}`,
            length: 20
        });
        return {
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url
        };
    }

    // Génère un QR code à partir de l'URL otpauth
    static async generateQRCode(otpauthUrl: string): Promise<string> {
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
            return qrCodeDataUrl;
        } catch (error) {
            throw new Error('Erreur lors de la génération du QR code');
        }
    }

    // Vérifie le token 2FA
    static verifyToken(token: string, secret: string): boolean {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1 // Permet une tolérance d'un intervalle avant/après
        });
    }
}
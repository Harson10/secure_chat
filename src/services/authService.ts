import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Exportation du service d'authentification
export const authService = {
  /**
   * Hachage d'un mot de passe
   * @param {string} password - Mot de passe à hacher
   * @returns {Promise<string>} - Mot de passe haché
   */
  hashPassword: async (password: string): Promise<string> => {
    // Génération d'un sel pour le hachage
    const salt = await bcrypt.genSalt(10);
    // Hachage du mot de passe avec le sel
    return bcrypt.hash(password, salt);
  },

  /**
   * Vérification d'un mot de passe
   * @param {string} password - Mot de passe à vérifier
   * @param {string} hashedPassword - Mot de passe haché à comparer
   * @returns {Promise<boolean>} - Résultat de la vérification
   */
  verifyPassword: async (password: string, hashedPassword: string): Promise<boolean> => {
    return bcrypt.compare(password, hashedPassword);
  },

  /**
   * Génération d'un jeton JWT
   * @param {number} userId - Identifiant de l'utilisateur
   * @returns {string} - Jeton JWT
   */
  generateToken: (userId: number): string => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' });
  },

  /**
   * Vérification d'un jeton JWT
   * @param {string} token - Jeton JWT à vérifier
   * @returns {{ userId: number } | null} - Résultat de la vérification
   */
  verifyToken: (token: string): { userId: number } | null => {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: number };
    } catch (error) {
      console.log(error);
      return null;
    }
  },

  /**
   * Génération d'un secret pour l'authentification à deux facteurs
   * @returns {string} - Secret
   */
  generateTwoFactorSecret: (): string => {
    return speakeasy.generateSecret().base32;
  },

  /**
   * Vérification d'un jeton d'authentification à deux facteurs
   * @param {string} token - Jeton à vérifier
   * @param {string} secret - Secret à comparer
   * @returns {boolean} - Résultat de la vérification
   */
  verifyTwoFactorToken: (token: string, secret: string): boolean => {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
    });
  },
};
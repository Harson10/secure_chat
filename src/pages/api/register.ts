import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/authService';
import { encryptionService } from '@/services/encryptionService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Vérifie si l'utilisateur n'est pas déjà authentifié
  const session = await getServerSession(req, res, authOptions);
  if (session) {
    return res.status(400).json({ message: 'Vous êtes déjà connecté' });
  }

  try {
    const { username, email, password, enable2FA } = req.body;

    // Validation des données
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Cet email ou nom d\'utilisateur est déjà utilisé'
      });
    }

    const hashedPassword = await authService.hashPassword(password);
    const { publicKey, privateKey } = encryptionService.generateKeyPair();

    // Génération des données 2FA si activé
    let secret2FA = null;
    let qrCode = null;

    if (enable2FA) {
      secret2FA = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(email, 'VotreApp', secret2FA);
      qrCode = await QRCode.toDataURL(otpauth);
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        hashedPassword,
        publicKey,
        privateKey,
        twoFactorSecret: secret2FA,
        twoFactorEnabled: enable2FA
      },
    });

    const token = authService.generateToken(user.id);

    // Si 2FA est activé, on renvoie les données nécessaires pour la configuration
    if (enable2FA) {
      return res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        qrCode,
        secret2FA,
      });
    }

    // Sinon, on termine l'inscription normalement
    return res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      privateKey,
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors de l\'inscription'
    });
  }
}

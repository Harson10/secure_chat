import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/authService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  // Vérifie si l'utilisateur n'est pas déjà authentifié
  const session = await getServerSession(req, res, authOptions);
  if (session) {
    return res.status(400).json({ message: 'Vous êtes déjà connecté' });
  }

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        hashedPassword: true,
        isTwoFactorEnabled: true,
        privateKey: true,
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Identifiants invalides' });
    }

    const isPasswordValid = await authService.verifyPassword(password, user.hashedPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Identifiants invalides' });
    }

    if (user.isTwoFactorEnabled) {
      // Stocker temporairement l'ID de l'utilisateur pour la vérification 2FA
      return res.status(200).json({
        requires2FA: true,
        userId: user.id,
        message: 'Authentification en deux facteurs requise'
      });
    }

    // Pour NextAuth, on n'a plus besoin de générer notre propre token
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        privateKey: user.privateKey
      }
    });
  } catch (error) {
    console.error('Erreur de connexion:', error);
    return res.status(500).json({ message: 'Une erreur est survenue lors de la connexion' });
  }
}

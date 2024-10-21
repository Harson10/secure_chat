import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '../../services/authService';

const prisma = new PrismaClient();

/**
 * Fonction de gestion de la requête de connexion
 * @param req Requête HTTP
 * @param res Réponse HTTP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non existant' });
    }

    const isPasswordValid = await authService.verifyPassword(password, user.hashedPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    if (user.isTwoFactorEnabled) {
      return res.status(200).json({ message: 'Authentification en deux facteurs requis', userId: user.id });
    }

    const token = authService.generateToken(user.id);

    res.status(200).json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    res.status(400).json({ message: 'Error logging in: ' + error });
  }
}
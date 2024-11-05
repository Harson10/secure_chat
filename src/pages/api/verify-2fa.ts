import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '../../services/authService';

const prisma = new PrismaClient();

/**
 * Fonction de gestion de la vérification de l'authentification à deux facteurs
 * @param req Requête HTTP
 * @param res Réponse HTTP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { userId, token } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Utilisateur invalide ou aucun jeton de deux facteurs configuré' });
    }

    const isTokenValid = authService.verifyTwoFactorToken(token, user.twoFactorSecret);

    if (!isTokenValid) {
      return res.status(400).json({ message: 'Token à deux facteurs invalide' });
    }

    const jwtToken = authService.generateToken(user.id);

    res.status(200).json({ user: { id: user.id, username: user.username, email: user.email }, token: jwtToken });
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la vérification de l\'authentification à deux facteurs: ' + error });
  }
}
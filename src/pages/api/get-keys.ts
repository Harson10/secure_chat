import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/authService';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Non autorisé' });
  }

  try {
    const decodedToken = authService.verifyToken(token);
    if (!decodedToken) {
      return res.status(401).json({ message: 'Token invalide' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: { privateKey: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json({ privateKey: user.privateKey });
  } catch (error) {
    console.error('Erreur lors de la récupération des clés:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
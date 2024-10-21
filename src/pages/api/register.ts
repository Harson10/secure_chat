import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '../../services/authService';
import { encryptionService } from '../../services/encryptionService';

const prisma = new PrismaClient();

/**
 * Fonction de gestion de la requête d'inscription
 * @param req Requête HTTP
 * @param res Réponse HTTP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  const { username, email, password } = req.body;

  try {
    const hashedPassword = await authService.hashPassword(password);
    const { publicKey, privateKey } = encryptionService.generateKeyPair();

    // Création d'un nouvel utilisateur dans la base de données
    const user = await prisma.user.create({
      data: {
        username,
        email,
        hashedPassword,
        publicKey,
        privateKey
      },
    });

    const token = authService.generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      privateKey,
    });
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de l\'inscription:', error });
  }
}
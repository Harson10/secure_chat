// Importation des dépendances nécessaires
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '../../services/authService';

// Création d'une instance de PrismaClient
const prisma = new PrismaClient();

/**
 * Fonction de gestion de la requête de récupération des messages
 * @param req Requête HTTP
 * @param res Réponse HTTP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Methode supportée' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Non autorisée' });
  }

  const decodedToken = authService.verifyToken(token);
  if (!decodedToken) {
    return res.status(401).json({ message: 'Token invalide' });
  }

  // Récupération de l'ID de conversation dans les paramètres de la requête
  const { conversationId } = req.query;

  // Vérification de la présence de l'ID de conversation
  if (!conversationId) {
    return res.status(400).json({ message: 'ID de conversation requis' });
  }

  try {
    // Récupération des messages de la conversation
    const messages = await prisma.message.findMany({
      // Filtre des messages par ID de conversation et par utilisateur dans la conversation
      where: {
        conversationId: Number(conversationId),
        conversation: {
          participants: {
            some: {
              id: decodedToken.userId
            }
          }
        }
      },
      // Ordre les messages par date de création
      orderBy: {
        createdAt: 'asc'
      },
      // Sélectionne les champs à récupérer
      select: {
        id: true,
        senderId: true,
        encryptedContent: true,
        createdAt: true
      }
    });

    // Retour des messages sous forme de JSON
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recuperation des messages: ' + error });
  }
}
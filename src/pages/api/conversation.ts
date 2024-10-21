import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '../../services/authService';

const prisma = new PrismaClient();

/**
 * Handler pour la route API /conversation
 * @param req Requête HTTP
 * @param res Réponse HTTP
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Non autorisée' });
    }

    const decodedToken = authService.verifyToken(token);
    if (!decodedToken) {
      return res.status(401).json({ message: 'Token invalide' });
    }

    const conversations = await prisma.conversation.findMany({
      // Filtre les conversations où l'utilisateur est participant
      where: {
        participants: {
          some: {
            id: decodedToken.userId
          }
        }
      },
      // Inclut les informations des participants dans la réponse
      include: {
        participants: {
          where: {
            id: {
              not: decodedToken.userId
            }
          },
          select: {
            id: true,
            username: true,
            publicKey: true
          }
        }
      }
    });

    const formattedConversations = conversations
      .filter(conv => conv.participants.length > 0)
      .map(conv => {
        const otherParticipant = conv.participants[0];
        return {
          id: conv.id,
          recipientId: otherParticipant?.id,
          recipientUsername: otherParticipant?.username,
          recipientPublicKey: otherParticipant?.publicKey
        };
      });

    res.status(200).json({ conversations: formattedConversations });
  } catch (error: unknown) {
    console.error('Error in conversation handler:', error);
    
    let errorMessage = 'Une erreur inconnue est survenue';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations', error: errorMessage });
  } finally {
    await prisma.$disconnect();
  }
}
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '../../services/authService';

const prisma = new PrismaClient();

// Exportation de la fonction handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Non autorisée' });
  }

  const decodedToken = authService.verifyToken(token);
  if (!decodedToken) {
    return res.status(401).json({ message: 'Token invalide' });
  }

  // Traitement du corps de la requête
  const { recipientUsername } = req.body;

  if (!recipientUsername) {
    return res.status(400).json({ message: 'Nom d\'utilisateur du destinataire requis' });
  }

  try {
    const recipient = await prisma.user.findUnique({
      where: { username: recipientUsername }
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Destinataire introuvable' });
    }

    // Recherche d'une conversation existante entre l'utilisateur et le destinataire
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: decodedToken.userId } } },
          { participants: { some: { id: recipient.id } } }
        ]
      }
    });

    if (existingConversation) {
      return res.status(400).json({ message: 'La conversation existe déjà' });
    }

    // Création d'une nouvelle conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: decodedToken.userId }, { id: recipient.id }]
        }
      },
      include: {
        participants: {
          where: {
            id: recipient.id
          },
          select: {
            id: true,
            username: true,
            publicKey: true
          }
        }
      }
    });

    // Formatage des données de la conversation
    const formattedConversation = {
      id: newConversation.id,
      recipientId: newConversation.participants[0].id,
      recipientUsername: newConversation.participants[0].username,
      recipientPublicKey: newConversation.participants[0].publicKey
    };

    res.status(201).json({ conversation: formattedConversation });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la creation de la conversation: ' + error });
  }
}
// send-message.ts
import { NextApiRequest } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { NextApiResponseServerIO } from '@/types/socket'; // On va créer ce type

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO // Utilisation du type personnalisé
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Non autorisé' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  try {
    const { receiverId, encryptedContent, encryptedContentCU, conversationId } = req.body;

    if (!receiverId || !encryptedContent || !encryptedContentCU || !conversationId) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: Number(conversationId),
        participants: {
          some: {
            id: Number(session.user.id)
          }
        }
      }
    });

    if (!conversation) {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        senderId: Number(session.user.id),
        receiverId: Number(receiverId),
        encryptedContent,
        encryptedContentCU,
        content: '', // Champ requis selon le schéma
        conversationId: Number(conversationId)
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    // Émettre via Socket.IO si disponible
    if (res.socket?.server?.io) {
      res.socket.server.io.to(`conversation-${conversationId}`).emit('new-message', message);
    }

    return res.status(201).json({ message: 'Message envoyé avec succès', data: message });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
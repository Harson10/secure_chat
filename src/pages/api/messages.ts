// messages.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Non autorisé' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  const { conversationId } = req.query;

  if (!conversationId) {
    return res.status(400).json({ message: 'ID de conversation requis' });
  }

  try {
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

    // Récupérer les messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId: Number(conversationId)
      },
      orderBy: {
        createdAt: 'asc'
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

    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
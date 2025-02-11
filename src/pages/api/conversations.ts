import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export const config = {
  api: {
    responseLimit: false
  }
}

const MESSAGES_PER_PAGE = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Non authentifié' });
  }

  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const userId = parseInt(session.user.id);

      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              id: userId
            }
          }
        },
        include: {
          participants: {
            select: {
              id: true,
              username: true,
              publicKey: true
            }
          },
          messages: {
            orderBy: {
              createdAt: 'desc'
            },
            take: MESSAGES_PER_PAGE,
            skip: (page - 1) * MESSAGES_PER_PAGE,
            select: {
              id: true,
              senderId: true,
              receiverId: true,
              encryptedContent: true,
              encryptedContentCU: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      const formattedConversations = conversations.map(conv => {
        const recipient = conv.participants.find(p => p.id !== userId);
        return {
          id: conv.id,
          recipientId: recipient?.id,
          recipientUsername: recipient?.username,
          recipientPublicKey: recipient?.publicKey,
          messages: conv.messages.reverse(), // Remettre dans l'ordre chronologique
          totalMessages: conv._count.messages,
          hasMoreMessages: conv._count.messages > page * MESSAGES_PER_PAGE
        };
      });

      return res.status(200).json({
        conversations: formattedConversations,
        currentPage: page
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ message: 'Erreur lors de la récupération des conversations' });
    }
  }

  if (req.method === 'POST') {
    const { recipientUsername } = req.body;

    if (!recipientUsername) {
      return res.status(400).json({ message: 'Username du destinataire requis' });
    }

    try {
      // Transaction pour la création de conversation
      const result = await prisma.$transaction(async (tx) => {
        const recipient = await tx.user.findUnique({
          where: { username: recipientUsername },
          select: {
            id: true,
            username: true,
            publicKey: true
          }
        });

        if (!recipient) {
          throw new Error('Destinataire non trouvé');
        }

        // Vérification optimisée de l'existence
        const existingCount = await tx.conversation.count({
          where: {
            AND: [
              { participants: { some: { id: parseInt(session.user.id) } } },
              { participants: { some: { id: recipient.id } } }
            ]
          }
        });

        if (existingCount > 0) {
          throw new Error('Une conversation existe déjà avec cet utilisateur');
        }

        // Création optimisée
        const conversation = await tx.conversation.create({
          data: {
            participants: {
              connect: [
                { id: parseInt(session.user.id) },
                { id: recipient.id }
              ]
            }
          },
          select: {
            id: true
          }
        });

        return {
          id: conversation.id,
          recipientId: recipient.id,
          recipientUsername: recipient.username,
          recipientPublicKey: recipient.publicKey,
          messages: []
        };
      });

      return res.status(201).json({ conversation: result });
    } catch (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Erreur lors de la création de la conversation'
      });
    }
  }

  return res.status(405).json({ message: 'Méthode non autorisée' });
}
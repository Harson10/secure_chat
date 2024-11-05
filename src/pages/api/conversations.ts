// pages/api/conversations.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Non authentifié' });
  }

  if (req.method === 'GET') {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              id: parseInt(session.user.id)
            }
          }
        },
        include: {
          participants: true,
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });

      const formattedConversations = conversations.map(conv => {
        const recipient = conv.participants.find(p => p.id !== parseInt(session.user.id));
        return {
          id: conv.id,
          recipientId: recipient?.id,
          recipientUsername: recipient?.username,
          recipientPublicKey: recipient?.publicKey,
          messages: conv.messages
        };
      });

      return res.status(200).json({ conversations: formattedConversations });
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
      const recipient = await prisma.user.findUnique({
        where: { username: recipientUsername }
      });

      if (!recipient) {
        return res.status(404).json({ message: 'Destinataire non trouvé' });
      }

      // Vérifier si une conversation existe déjà
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { id: parseInt(session.user.id) } } },
            { participants: { some: { id: recipient.id } } }
          ]
        }
      });

      if (existingConversation) {
        return res.status(400).json({ message: 'Une conversation existe déjà avec cet utilisateur' });
      }

      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            connect: [
              { id: parseInt(session.user.id) },
              { id: recipient.id }
            ]
          }
        },
        include: {
          participants: true
        }
      });

      const formattedConversation = {
        id: conversation.id,
        recipientId: recipient.id,
        recipientUsername: recipient.username,
        recipientPublicKey: recipient.publicKey,
        messages: []
      };

      return res.status(201).json({ conversation: formattedConversation });
    } catch (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({ message: 'Erreur lors de la création de la conversation' });
    }
  }

  return res.status(405).json({ message: 'Méthode non autorisée' });
}
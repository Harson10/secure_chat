import { NextApiRequest } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { NextApiResponseServerIO } from '@/types/socket';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb'
    }
  }
}

const prismaMessageSelect = {
  id: true,
  senderId: true,
  receiverId: true,
  encryptedContent: true,
  encryptedContentCU: true,
  createdAt: true,
  conversationId: true,
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
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Méthode non supportée' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Non autorisé' });
  }

  try {
    const { receiverId, encryptedContent, encryptedContentCU, conversationId } = req.body;

    if (!receiverId || !encryptedContent || !encryptedContentCU || !conversationId) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    // Transaction pour garantir la cohérence
    const result = await prisma.$transaction(async (tx) => {
      // Vérification optimisée de la conversation
      const conversationExists = await tx.conversation.count({
        where: {
          id: Number(conversationId),
          participants: {
            some: {
              id: Number(session.user.id)
            }
          }
        }
      });

      if (!conversationExists) {
        throw new Error('Accès non autorisé à cette conversation');
      }

      // Création du message avec select optimisé
      const message = await tx.message.create({
        data: {
          senderId: Number(session.user.id),
          receiverId: Number(receiverId),
          encryptedContent,
          encryptedContentCU,
          content: '',
          conversationId: Number(conversationId)
        },
        select: prismaMessageSelect
      });

      return message;
    });

    // Dans votre send-message.ts
    if (res.socket?.server?.io) {
      const io = res.socket.server.io;
      // Émission au destinataire spécifique
      io.to(`user-${receiverId}`).emit('new-message', result);
      // Émission à la conversation
      io.to(`conversation-${conversationId}`).emit('new-message', result);
    }

    return res.status(201).json({ message: 'Message envoyé avec succès', data: result });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Erreur serveur'
    });
  }
}


// import { NextApiRequest } from 'next';
// import { PrismaClient } from '@prisma/client';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/pages/api/auth/[...nextauth]';
// import { NextApiResponseServerIO } from '@/types/socket';

// const prisma = new PrismaClient();

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponseServerIO // Utilisation du type personnalisé
// ) {
//   const session = await getServerSession(req, res, authOptions);

//   if (!session?.user?.id) {
//     return res.status(401).json({ message: 'Non autorisé' });
//   }

//   if (req.method !== 'POST') {
//     return res.status(405).json({ message: 'Méthode non supportée' });
//   }

//   try {
//     const { receiverId, encryptedContent, encryptedContentCU, conversationId } = req.body;

//     if (!receiverId || !encryptedContent || !encryptedContentCU || !conversationId) {
//       return res.status(400).json({ message: 'Données manquantes' });
//     }

//     // Vérifier que l'utilisateur fait partie de la conversation
//     const conversation = await prisma.conversation.findFirst({
//       where: {
//         id: Number(conversationId),
//         participants: {
//           some: {
//             id: Number(session.user.id)
//           }
//         }
//       }
//     });

//     if (!conversation) {
//       return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
//     }

//     // Créer le message
//     const message = await prisma.message.create({
//       data: {
//         senderId: Number(session.user.id),
//         receiverId: Number(receiverId),
//         encryptedContent,
//         encryptedContentCU,
//         content: '', // Champ requis selon le schéma
//         conversationId: Number(conversationId)
//       },
//       include: {
//         sender: {
//           select: {
//             id: true,
//             username: true
//           }
//         },
//         receiver: {
//           select: {
//             id: true,
//             username: true
//           }
//         }
//       }
//     });

//     // Émettre via Socket.IO si disponible
//     if (res.socket?.server?.io) {
//       res.socket.server.io.to(`conversation-${conversationId}`).emit('new-message', message);
//     }

//     return res.status(201).json({ message: 'Message envoyé avec succès', data: message });
//   } catch (error) {
//     console.error('Erreur lors de l\'envoi du message:', error);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// }
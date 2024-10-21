

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/authService';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    const { receiverId, encryptedContent, encryptedContentCU, conversationId } = req.body;

    console.log('Données du message reçues:', {
      senderId: decodedToken.userId,
      conversationId,
      hasEncryptedContent: !!encryptedContent,
      hasEncryptedContentCU: !!encryptedContentCU,
    });

    if (!receiverId || !encryptedContent || !encryptedContentCU || !conversationId) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: decodedToken.userId,
        receiverId,
        encryptedContent,
        encryptedContentCU,
        conversationId,
        content: ""
      },
    });

    console.log('Message créé:', {
      messageId: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
    });

    res.status(201).json({ message: 'Message envoyé avec succès', data: message });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message', error });
  }
}
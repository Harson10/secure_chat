import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/authService';
import { encryptionService } from '@/services/encryptionService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Vérifie si l'utilisateur n'est pas déjà authentifié
  const session = await getServerSession(req, res, authOptions);
  if (session) {
    return res.status(400).json({ message: 'Vous êtes déjà connecté' });
  }

  try {
    const { username, email, password } = req.body;

    // Validation des données
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Cet email ou nom d\'utilisateur est déjà utilisé'
      });
    }

    const hashedPassword = await authService.hashPassword(password);
    const { publicKey, privateKey } = encryptionService.generateKeyPair();

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

    return res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
      privateKey,
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors de l\'inscription'
    });
  }
}

// import { NextApiRequest, NextApiResponse } from 'next';
// import { PrismaClient } from '@prisma/client';
// import { authService } from '../../services/authService';
// import { encryptionService } from '../../services/encryptionService';

// const prisma = new PrismaClient();

// /**
//  * Fonction de gestion de la requête d'inscription
//  * @param req Requête HTTP
//  * @param res Réponse HTTP
//  */
// export default async function handler(req: NextApiRequest, res: NextApiResponse) {

//   if (req.method !== 'POST') {
//     return res.status(405).json({ message: 'Méthode non supportée' });
//   }

//   const { username, email, password } = req.body;

//   try {
//     const hashedPassword = await authService.hashPassword(password);
//     const { publicKey, privateKey } = encryptionService.generateKeyPair();

//     // Création d'un nouvel utilisateur dans la base de données
//     const user = await prisma.user.create({
//       data: {
//         username,
//         email,
//         hashedPassword,
//         publicKey,
//         privateKey
//       },
//     });

//     const token = authService.generateToken(user.id);

//     res.status(201).json({
//       user: {
//         id: user.id,
//         username: user.username,
//         email: user.email,
//       },
//       token,
//       privateKey,
//     });
//   } catch (error) {
//     res.status(400).json({ message: 'Erreur lors de l\'inscription:', error });
//   }
// }
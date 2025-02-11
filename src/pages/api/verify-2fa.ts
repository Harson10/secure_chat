import { NextApiRequest, NextApiResponse } from 'next';
import { authenticator } from 'otplib';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { secret, token } = req.body;

    if (!secret || !token) {
      return res.status(400).json({ message: 'Données manquantes' });
    }

    // Vérification du code
    const isValid = authenticator.verify({
      token,
      secret
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Code de vérification incorrect' });
    }

    // Si le code est valide, on peut retourner les données nécessaires
    return res.status(200).json({
      message: 'Vérification réussie',
      success: true
    });

  } catch (error) {
    console.error('Erreur lors de la vérification 2FA:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors de la vérification'
    });
  }
}

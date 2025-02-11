import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// Extend the NextApiRequest interface to include userId
interface AuthenticatedRequest extends NextApiRequest {
    userId: string;
}

export default async function socketMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => void
) {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // Type assertion using our custom interface
    (req as AuthenticatedRequest).userId = session.user.id;
    next();
}

// Export the extended request type for use in route handlers
export type { AuthenticatedRequest };
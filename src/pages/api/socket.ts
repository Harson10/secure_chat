/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server as ServerIO } from 'socket.io';
import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '@/types/socket';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseServerIO
) {
    if (!res.socket.server.io) {
        console.log('Socket is initializing');
        const httpServer: NetServer = res.socket.server as any;
        const io = new ServerIO(httpServer, {
            path: '/api/socket',
        });
        res.socket.server.io = io;

        io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            socket.on('join-conversation', (conversationId: string) => {
                socket.join(`conversation-${conversationId}`);
            });

            socket.on('leave-conversation', (conversationId: string) => {
                socket.leave(`conversation-${conversationId}`);
            });
        });
    }
    res.end();
}
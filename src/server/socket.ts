// server/socket.ts

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getSession } from 'next-auth/react';

export function initializeSocket(server: HTTPServer) {
    const io = new SocketIOServer(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        },
        path: "/api/socketio",
    });

    // Middleware d'authentification
    io.use(async (socket, next) => {
        try {
            const session = await getSession({ req: socket.request });

            if (!session?.user?.id) {
                return next(new Error("Non authentifié"));
            }

            socket.data.userId = session.user.id;
            next();
        } catch (error) {
            next(new Error("Erreur d'authentification"));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.data.userId}`);

        socket.on('send-message', async (data) => {
            try {
                // Traitement du message ici
                const { conversationId, content, receiverId } = data;

                // Émission du message aux utilisateurs concernés
                socket.to(receiverId.toString()).emit('new-message', {
                    conversationId,
                    content,
                    senderId: socket.data.userId,
                    createdAt: new Date()
                });
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.data.userId}`);
        });
    });

    return io;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
// server.ts
import { createServer } from 'http';
import { Server } from 'socket.io';
import { parse } from 'url';
import next from 'next';
import { getToken } from 'next-auth/jwt';
import { PrismaClient } from '@prisma/client';
import { encryptionService } from '@/services/encryptionService';

const prisma = new PrismaClient();
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (error) {
            console.error('Server error:', error);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });

    const io = new Server(server, {
        cors: {
            origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
            methods: ['GET', 'POST'],
            credentials: true,
            allowedHeaders: ['authorization']
        },
        path: '/api/socketio', // Ajout du path spécifique
    });

    // Dans server.ts, après la création de l'instance io
    (server as any).io = io;

    // Middleware d'authentification
    io.use(async (socket, next) => {
        try {
            console.log('Authenticating socket connection...');

            const token = await getToken({
                req: socket.request as any,
                secret: process.env.NEXTAUTH_SECRET
            });

            if (token) {
                console.log('Socket authenticated for user:', token.email);
                socket.data.user = { id: token.id, email: token.email };
                next();
            } else {
                console.log('Socket authentication failed: No token');
                next(new Error('Non autorisé'));
            }
        } catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Erreur d\'authentification'));
        }
    });

    // Gestion des connexions
    io.on('connection', (socket) => {
        console.log('Client connecté:', socket.data.user?.email);

        // Rejoindre une conversation
        socket.on('join-conversation', (conversationId: number) => {
            console.log(`User ${socket.data.user?.email} joining conversation ${conversationId}`);
            const room = `conversation-${conversationId}`;
            socket.join(room);
            console.log(`Joined room: ${room}`);
        });

        // Envoi de message
        socket.on('send-message', async (data: {
            content: string;
            conversationId: number;
            privateKey: string;
            receiverId: number;
        }) => {
            try {
                console.log(`Processing message for conversation ${data.conversationId}`);

                const message = await prisma.message.create({
                    data: {
                        senderId: parseInt(socket.data.user.id),
                        receiverId: data.receiverId,
                        conversationId: data.conversationId,
                        encryptedContent: await encryptionService.encryptSymmetric(data.content, data.privateKey),
                        encryptedContentCU: await encryptionService.encryptSymmetric(data.content, data.privateKey),
                        content: data.content
                    },
                });

                const room = `conversation-${data.conversationId}`;
                console.log(`Emitting message to room: ${room}`);
                io.to(room).emit('new-message', message);

            } catch (error) {
                console.error('Erreur lors de l\'envoi du message:', error);
                socket.emit('error', {
                    message: 'Erreur lors de l\'envoi du message',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Gestion des erreurs socket
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        // Déconnexion
        socket.on('disconnect', (reason) => {
            console.log(`Client déconnecté (${reason}):`, socket.data.user?.email);
        });
    });

    // Démarrage du serveur
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`> Server ready on http://localhost:${PORT}`);
        console.log('> Socket.IO path:', io.path());
        console.log('> CORS origin:', process.env.NEXTAUTH_URL || "http://localhost:3000");
    });
});
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

interface DecodedToken {
    email: string;
    sub: string;
}

async function verifyToken(token: string) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
        const user = await prisma.user.findUnique({
            where: { email: decoded.email },
        });
        return user;
    } catch (error) {
        throw new Error('Invalid token');
    }
}

export function initializeSocket(server: HTTPServer) {
    const io = new SocketIOServer(server, {
        cors: {
            origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const user = await verifyToken(token);
            socket.data.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.data.user?.email);

        socket.on('message', (message) => {
            io.emit('message', message);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.data.user?.email);
        });
    });

    return io;
}
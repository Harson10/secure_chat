// chatSocketHandler.ts
import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface Message {
    id: number;
    senderId: number;
    receiverId: number;
    encryptedContent: string;
    encryptedContentCU: string;
    createdAt: string;
    conversationId: number;
}

interface ChatSocketHandlerProps {
    onNewMessage: (message: Message) => void;
    onError: (error: string) => void;
}

export const useChatSocket = ({ onNewMessage, onError }: ChatSocketHandlerProps) => {
    const { data: session } = useSession();
    const [socket, setSocket] = useState<typeof Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [activeConversation, setActiveConversation] = useState<number | null>(null);

    const initializeSocket = useCallback(() => {
        if (!session?.user?.id) return;

        const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
            path: '/api/socketio',
            auth: {
                token: session.user.id
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        });

        socketInstance.on('connect', () => {
            console.log('Socket connected:', socketInstance.id);
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socketInstance.on('new-message', (message: Message) => {
            console.log('New message received:', message);
            onNewMessage(message);
        });

        socketInstance.on('error', (error: Error) => {
            console.error('Socket error:', error);
            onError(error.message);
        });

        socketInstance.on('reconnect', (attemptNumber: number) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            if (activeConversation) {
                joinConversation(activeConversation);
            }
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [session?.user?.id, onNewMessage, onError, activeConversation]);

    const joinConversation = useCallback((conversationId: number) => {
        if (!socket?.connected) {
            console.warn('Socket not connected, attempting to reconnect...');
            socket?.connect();
            return;
        }

        // Leave previous conversation if any
        if (activeConversation) {
            socket.emit('leave-conversation', activeConversation);
        }

        console.log('Joining conversation:', conversationId);
        socket.emit('join-conversation', conversationId);
        setActiveConversation(conversationId);
    }, [socket, activeConversation]);

    const sendMessage = useCallback(async (message: {
        content: string;
        conversationId: number;
        receiverId: number;
        encryptedContent: string;
        encryptedContentCU: string;
    }) => {
        if (!socket?.connected) {
            throw new Error('Socket not connected');
        }

        return new Promise((resolve, reject) => {
            socket.emit('send-message', message, (response: { error?: string; success?: boolean }) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }, [socket]);

    useEffect(() => {
        const cleanup = initializeSocket();
        return () => {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        };
    }, [initializeSocket]);

    return {
        isConnected,
        activeConversation,
        joinConversation,
        sendMessage
    };
};
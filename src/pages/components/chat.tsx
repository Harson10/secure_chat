/* eslint-disable react-hooks/exhaustive-deps */
// Chat.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import io, { Socket } from 'socket.io-client';
import { encryptionService } from '@/services/encryptionService';

interface Conversation {
  id: number;
  recipientId: number;
  recipientUsername: string;
  recipientPublicKey: string;
  messages?: Message[];
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  encryptedContent: string;
  encryptedContentCU: string;
  createdAt: string;
  conversationId: number;
}

export default function Chat() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/components/login');
      return;
    }

    if (status === "authenticated" && session) {
      // Initialize Socket.IO connection
      const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        auth: {
          token: session.user?.id
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        console.log('Connected to Socket.IO server');
      });

      socketInstance.on('new-message', async (newMessage: Message) => {
        if (selectedConversation?.id === newMessage.conversationId) {
          setSelectedConversation(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: [...(prev.messages || []), newMessage]
            };
          });
        }
      });

      setSocket(socketInstance);
      fetchConversations();

      return () => {
        socketInstance.disconnect();
      };
    }
  }, [session, status]);


  // useEffect(() => {
  //   if (error) {
  //     const timer = setTimeout(() => {
  //       setError(''); // Clear the error after 3 seconds
  //     }, 3000);
  //     return () => clearTimeout(timer); // Cleanup timeout on component unmount or error change
  //   }
  // }, [error]);


  const fetchConversations = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch('/api/conversations', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Important pour inclure les cookies de session
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load conversations');
      console.error(error);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      const privateKey = sessionStorage.getItem(`privateKey_${session.user.id}`);
      if (!privateKey) {
        // Si la clé n'est pas dans le sessionStorage, redirigez vers la page de configuration
        router.push('/components/setup-keys');
        return;
      }
    }
  }, [session, status]);

  const decryptMessage = (message: Message) => {
    try {
      const privateKey = sessionStorage.getItem(`privateKey_${session?.user?.id}`);
      if (!privateKey) return "Clé manquante";

      if (message.senderId === parseInt(session?.user?.id || '0')) {
        return encryptionService.decryptSymmetric(message.encryptedContentCU, privateKey);
      } else {
        return encryptionService.decryptAsymmetric(message.encryptedContent, privateKey);
      }
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      return `Erreur de déchiffrement: ${(error as Error).message}`;
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !message || !session?.user?.id) return;

    try {
      const privateKey = sessionStorage.getItem(`privateKey_${session.user.id}`);
      if (!privateKey) {
        throw new Error('Clé privée non trouvée. Veuillez vous reconnecter.');
      }

      // 1. Chiffrer pour le destinataire
      const encryptedContent = encryptionService.encryptAsymmetric(
        message,
        selectedConversation.recipientPublicKey
      );

      // 2. Chiffrer pour le stockage cloud
      const encryptedContentCU = encryptionService.encryptSymmetric(
        message,
        privateKey
      );

      // Log pour debug
      console.log('Message original:', message);
      console.log('Message chiffré destinataire:', encryptedContent);
      console.log('Message chiffré cloud:', encryptedContentCU);

      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          receiverId: selectedConversation.recipientId,
          encryptedContent,
          encryptedContentCU
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }

      const data = await response.json();

      // Mise à jour de l'interface
      setSelectedConversation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), data.data]
        };
      });

      if (socket) {
        socket.emit('new-message', {
          conversationId: selectedConversation.id,
          message: data.data
        });
      }

      setMessage('');
    } catch (error) {
      console.error('Erreur détaillée:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const createNewConversation = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ recipientUsername: newRecipient })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create conversation');
      }

      const data = await response.json();
      setConversations([...conversations, data.conversation]);
      setNewRecipient('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create conversation');
      console.error(error);
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar - Conversations List */}
      <div className="w-1/4 overflow-y-auto border-r bg-white">
        <div className="p-4">
          <h2 className="mb-4 text-xl font-bold">Conversations</h2>
          <div className="mb-4">
            <input
              type="text"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              placeholder="New recipient username"
              className="w-full rounded border p-2"
            />
            <button
              onClick={createNewConversation}
              className="mt-2 w-full rounded bg-blue-500 p-2 text-white"
            >
              New Conversation
            </button>
          </div>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="cursor-pointer rounded p-3 hover:bg-gray-100"
              >
                {conv.recipientUsername}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex flex-1 flex-col">
        {selectedConversation ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedConversation.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-4 ${msg.senderId === parseInt(session?.user?.id || '0') ? 'text-right' : 'text-left'}`}
                >
                  <div className={`inline-block rounded-lg p-3 ${msg.senderId === parseInt(session?.user?.id || '0')
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300'
                    }`}>
                    {decryptMessage(msg)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t bg-white p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded border p-2"
                />
                <button
                  onClick={sendMessage}
                  className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>


      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white p-3 rounded flex items-center space-x-2">
          <span>{error}</span>
          <button
            onClick={() => setError('')} // Manually clear the error
            className="ml-2 text-white bg-red-700 px-2 rounded hover:bg-red-800"
          >
            Close
          </button>
        </div>
      )}

    </div>
  );
}
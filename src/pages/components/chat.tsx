/* eslint-disable react/no-unescaped-entities */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import io from 'socket.io-client';
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
  const socketRef = useRef<SocketIOClient.Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [error, setError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateKeyRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const messageCache = useRef<Map<number, string>>(new Map());

  // Optimisation du scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Optimisation du decrypt avec mise en cache
  const decryptMessage = useCallback((message: Message) => {
    const messageId = message.id;
    if (messageCache.current.has(messageId)) {
      return messageCache.current.get(messageId);
    }

    try {
      if (!privateKeyRef.current) return "Clé manquante";

      let decrypted;
      if (message.senderId === parseInt(session?.user?.id || '0')) {
        decrypted = encryptionService.decryptSymmetric(message.encryptedContentCU, privateKeyRef.current);
      } else {
        decrypted = encryptionService.decryptAsymmetric(message.encryptedContent, privateKeyRef.current);
      }

      messageCache.current.set(messageId, decrypted);
      return decrypted;
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      return `Erreur de déchiffrement: ${(error as Error).message}`;
    }
  }, [session?.user?.id]);

  // Optimisation de la gestion du typing
  const handleTyping = useCallback(() => {
    if (!socketRef.current || !session?.user?.id) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socketRef.current.emit('typing', parseInt(session.user.id));
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop-typing', parseInt(session.user.id));
    }, 1000);
  }, [session?.user?.id]);

  // Optimisation de l'envoi de messages
  const sendMessage = useCallback(async () => {
    if (!selectedConversation || !message.trim() || !session?.user?.id) return;

    try {
      if (!privateKeyRef.current) {
        throw new Error('Clé privée non trouvée. Veuillez vous reconnecter.');
      }

      // Mise à jour optimiste de l'UI
      const tempMessage = {
        id: Date.now(),
        senderId: parseInt(session.user.id),
        receiverId: selectedConversation.recipientId,
        encryptedContent: '',
        encryptedContentCU: encryptionService.encryptSymmetric(message, privateKeyRef.current),
        createdAt: new Date().toISOString(),
        conversationId: selectedConversation.id
      };

      setSelectedConversation(prev => ({
        ...prev!,
        messages: [...(prev?.messages || []), tempMessage]
      }));
      setMessage('');
      scrollToBottom();

      const encryptedContent = encryptionService.encryptAsymmetric(
        message,
        selectedConversation.recipientPublicKey
      );

      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          receiverId: selectedConversation.recipientId,
          encryptedContent,
          encryptedContentCU: tempMessage.encryptedContentCU
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      socketRef.current?.emit('new-message', {
        conversationId: selectedConversation.id,
        message: data.data
      });

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message');
      // Rollback en cas d'erreur
      setSelectedConversation(prev => ({
        ...prev!,
        messages: prev?.messages?.slice(0, -1)
      }));
      setMessage(message);
    }
  }, [selectedConversation, message, session?.user?.id, scrollToBottom]);

  // Initialisation optimisée
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/components/login');
      return;
    }

    if (status === "authenticated" && session) {
      privateKeyRef.current = sessionStorage.getItem(`privateKey_${session.user.id}`);

      if (!privateKeyRef.current) {
        router.push('/components/setup-keys');
        return;
      }

      const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        auth: { token: session.user?.id },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket']
      });

      socketRef.current = socketInstance;

      socketInstance.on('new-message', (newMessage: Message) => {
        if (selectedConversation?.id === newMessage.conversationId) {
          setSelectedConversation(prev => ({
            ...prev!,
            messages: [...(prev?.messages || []), newMessage]
          }));
          scrollToBottom();
        }
      });

      socketInstance.on('typing', (userId: number) => {
        if (selectedConversation?.recipientId === userId) {
          setIsTyping(true);
        }
      });

      socketInstance.on('stop-typing', (userId: number) => {
        if (selectedConversation?.recipientId === userId) {
          setIsTyping(false);
        }
      });

      // Récupération initiale des conversations
      fetch('/api/conversations', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => setConversations(data.conversations))
        .catch(console.error);

      return () => {
        socketInstance.disconnect();
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }
  }, [session, status, router, selectedConversation?.id, scrollToBottom]);

  // Rendu optimisé avec React.memo pour les composants de message
  const MessageItem = useCallback(({ message: msg }: { message: Message }) => (
    <div
      className={`mb-4 ${msg.senderId === parseInt(session?.user?.id || '0') ? 'text-right' : 'text-left'}`}
    >
      <div
        className={`inline-block rounded-lg p-3 ${msg.senderId === parseInt(session?.user?.id || '0')
          ? 'bg-blue-500 text-white'
          : 'bg-gray-300'
          }`}
      >
        {decryptMessage(msg)}
      </div>
    </div>
  ), [decryptMessage, session?.user?.id]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar - Liste des conversations */}
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
              onClick={() => {
                fetch('/api/conversations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ recipientUsername: newRecipient })
                })
                  .then(res => res.json())
                  .then(data => {
                    setConversations(prev => [...prev, data.conversation]);
                    setNewRecipient('');
                  })
                  .catch(err => setError(err.message));
              }}
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
                className={`cursor-pointer rounded p-3 hover:bg-gray-100 ${selectedConversation?.id === conv.id ? 'bg-gray-100' : ''
                  }`}
              >
                {conv.recipientUsername}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fenêtre de chat */}
      <div className="flex flex-1 flex-col">
        {selectedConversation ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedConversation.messages?.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
              {isTyping && (
                <div className="mb-4 text-left">
                  <div className="inline-block rounded-lg bg-gray-100 p-3">
                    Typing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t bg-white p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleTyping}
                  placeholder="Type a message..."
                  className="flex-1 rounded border p-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
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
        <div className="fixed bottom-4 right-4 flex items-center space-x-2 rounded bg-red-500 p-3 text-white">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-2 rounded bg-red-700 px-2 text-white hover:bg-red-800"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// import { useState, useEffect, useRef } from 'react';
// import { useRouter } from 'next/navigation';
// import { useSession } from 'next-auth/react';
// import io from 'socket.io-client';
// import { encryptionService } from '@/services/encryptionService';

// interface Conversation {
//   id: number;
//   recipientId: number;
//   recipientUsername: string;
//   recipientPublicKey: string;
//   messages?: Message[];
// }

// interface Message {
//   id: number;
//   senderId: number;
//   receiverId: number;
//   encryptedContent: string;
//   encryptedContentCU: string;
//   createdAt: string;
//   conversationId: number;
// }

// export default function Chat() {
//   const { data: session, status } = useSession();
//   const router = useRouter();
//   const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
//   const [conversations, setConversations] = useState<Conversation[]>([]);
//   const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
//   const [message, setMessage] = useState('');
//   const [newRecipient, setNewRecipient] = useState('');
//   const [error, setError] = useState('');
//   const [isTyping, setIsTyping] = useState(false);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push('/components/login');
//       return;
//     }

//     if (status === "authenticated" && session) {
//       const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
//         auth: {
//           token: session.user?.id
//         },
//         reconnection: true,
//         reconnectionAttempts: 5,
//         reconnectionDelay: 1000,
//         transports: ['websocket', 'polling']
//       });

//       socketInstance.on('connect', () => {
//         console.log('Connected to Socket.IO server');
//       });

//       socketInstance.on('new-message', async (newMessage: Message) => {
//         if (selectedConversation?.id === newMessage.conversationId) {
//           setSelectedConversation(prev => {
//             if (!prev) return prev;
//             return {
//               ...prev,
//               messages: [...(prev.messages || []), newMessage]
//             };
//           });
//           scrollToBottom();
//         }
//       });

//       socketInstance.on('typing', (userId: number) => {
//         if (selectedConversation?.recipientId === userId) {
//           setIsTyping(true);
//           setTimeout(() => setIsTyping(false), 3000);
//         }
//       });

//       setSocket(socketInstance);
//       fetchConversations();

//       return () => {
//         socketInstance.disconnect();
//       };
//     }
//   }, [session, status]);

//   useEffect(() => {
//     if (status === "authenticated" && session?.user?.id) {
//       const privateKey = sessionStorage.getItem(`privateKey_${session.user.id}`);
//       if (!privateKey) {
//         router.push('/components/setup-keys');
//         return;
//       }
//     }
//   }, [session, status]);

//   const fetchConversations = async () => {
//     if (!session?.user?.id) return;

//     try {
//       const response = await fetch('/api/conversations', {
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         credentials: 'include'
//       });

//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.message || 'Failed to fetch conversations');
//       }

//       const data = await response.json();
//       setConversations(data.conversations);
//     } catch (error) {
//       setError(error instanceof Error ? error.message : 'Failed to load conversations');
//       console.error(error);
//     }
//   };

//   const decryptMessage = (message: Message) => {
//     try {
//       const privateKey = sessionStorage.getItem(`privateKey_${session?.user?.id}`);
//       if (!privateKey) return "Clé manquante";

//       if (message.senderId === parseInt(session?.user?.id || '0')) {
//         return encryptionService.decryptSymmetric(message.encryptedContentCU, privateKey);
//       } else {
//         return encryptionService.decryptAsymmetric(message.encryptedContent, privateKey);
//       }
//     } catch (error) {
//       console.error('Erreur de déchiffrement:', error);
//       return `Erreur de déchiffrement: ${(error as Error).message}`;
//     }
//   };

//   const handleTyping = () => {
//     if (socket && session?.user?.id) {
//       socket.emit('typing', parseInt(session.user.id));
//     }
//   };

//   const sendMessage = async () => {
//     if (!selectedConversation || !message || !session?.user?.id) return;

//     try {
//       const privateKey = sessionStorage.getItem(`privateKey_${session.user.id}`);
//       if (!privateKey) {
//         throw new Error('Clé privée non trouvée. Veuillez vous reconnecter.');
//       }

//       const encryptedContent = encryptionService.encryptAsymmetric(
//         message,
//         selectedConversation.recipientPublicKey
//       );

//       const encryptedContentCU = encryptionService.encryptSymmetric(
//         message,
//         privateKey
//       );

//       const response = await fetch('/api/send-message', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           conversationId: selectedConversation.id,
//           receiverId: selectedConversation.recipientId,
//           encryptedContent,
//           encryptedContentCU
//         })
//       });

//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.message || 'Failed to send message');
//       }

//       const data = await response.json();

//       setSelectedConversation(prev => {
//         if (!prev) return prev;
//         return {
//           ...prev,
//           messages: [...(prev.messages || []), data.data]
//         };
//       });

//       if (socket) {
//         socket.emit('new-message', {
//           conversationId: selectedConversation.id,
//           message: data.data
//         });
//       }

//       setMessage('');
//       scrollToBottom();
//     } catch (error) {
//       console.error('Erreur détaillée:', error);
//       setError(error instanceof Error ? error.message : 'Failed to send message');
//     }
//   };

//   const createNewConversation = async () => {
//     if (!session?.user?.id) return;

//     try {
//       const response = await fetch('/api/conversations', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         credentials: 'include',
//         body: JSON.stringify({ recipientUsername: newRecipient })
//       });

//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.message || 'Failed to create conversation');
//       }

//       const data = await response.json();
//       setConversations([...conversations, data.conversation]);
//       setNewRecipient('');
//     } catch (error) {
//       setError(error instanceof Error ? error.message : 'Failed to create conversation');
//       console.error(error);
//     }
//   };

//   if (status === "loading") {
//     return <div>Loading...</div>;
//   }

//   return (
//     <div className="flex min-h-screen bg-gray-100">
//       {/* Sidebar - Conversations List */}
//       <div className="w-1/4 overflow-y-auto border-r bg-white">
//         <div className="p-4">
//           <h2 className="mb-4 text-xl font-bold">Conversations</h2>
//           <div className="mb-4">
//             <input
//               type="text"
//               value={newRecipient}
//               onChange={(e) => setNewRecipient(e.target.value)}
//               placeholder="New recipient username"
//               className="w-full rounded border p-2"
//             />
//             <button
//               onClick={createNewConversation}
//               className="mt-2 w-full rounded bg-blue-500 p-2 text-white"
//             >
//               New Conversation
//             </button>
//           </div>
//           <div className="space-y-2">
//             {conversations.map((conv) => (
//               <div
//                 key={conv.id}
//                 onClick={() => setSelectedConversation(conv)}
//                 className={`cursor-pointer rounded p-3 hover:bg-gray-100 ${selectedConversation?.id === conv.id ? 'bg-gray-100' : ''
//                   }`}
//               >
//                 {conv.recipientUsername}
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Chat Window */}
//       <div className="flex flex-1 flex-col">
//         {selectedConversation ? (
//           <>
//             <div className="flex-1 overflow-y-auto p-4">
//               {selectedConversation.messages?.map((msg) => (
//                 <div
//                   key={msg.id}
//                   className={`mb-4 ${msg.senderId === parseInt(session?.user?.id || '0') ? 'text-right' : 'text-left'}`}
//                 >
//                   <div className={`inline-block rounded-lg p-3 ${msg.senderId === parseInt(session?.user?.id || '0')
//                     ? 'bg-blue-500 text-white'
//                     : 'bg-gray-300'
//                     }`}>
//                     {decryptMessage(msg)}
//                   </div>
//                 </div>
//               ))}
//               {isTyping && (
//                 <div className="mb-4 text-left">
//                   <div className="inline-block rounded-lg bg-gray-100 p-3">
//                     Typing...
//                   </div>
//                 </div>
//               )}
//               <div ref={messagesEndRef} />
//             </div>
//             <div className="border-t bg-white p-4">
//               <div className="flex space-x-2">
//                 <input
//                   type="text"
//                   value={message}
//                   onChange={(e) => setMessage(e.target.value)}
//                   onKeyPress={handleTyping}
//                   placeholder="Type a message..."
//                   className="flex-1 rounded border p-2"
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter' && !e.shiftKey) {
//                       e.preventDefault();
//                       sendMessage();
//                     }
//                   }}
//                 />
//                 <button
//                   onClick={sendMessage}
//                   className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
//                 >
//                   Send
//                 </button>
//               </div>
//             </div>
//           </>
//         ) : (
//           <div className="flex flex-1 items-center justify-center text-gray-500">
//             Select a conversation to start chatting
//           </div>
//         )}
//       </div>

//       {error && (
//         <div className="fixed bottom-4 right-4 flex items-center space-x-2 rounded bg-red-500 p-3 text-white">
//           <span>{error}</span>
//           <button
//             onClick={() => setError('')}
//             className="ml-2 rounded bg-red-700 px-2 text-white hover:bg-red-800"
//           >
//             Close
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

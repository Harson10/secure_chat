/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
}

// Fonction principale du composant Chat
export default function Chat() {

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchCurrentUser();
    fetchConversations();
    const fetchKeys = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch('/api/get-keys', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('privateKey', data.privateKey);
          console.log('Private key retrieved and stored');
        } else {
          setError(data.message);
        }
      } catch (error) {
        console.error('Error fetching keys:', error);
        setError('Une erreur est survenue lors de la récupération des clés');
      }
    };

    fetchKeys();
    // if (selectedConversation) {
    //   fetchMessages(selectedConversation.id);
    // }
  }, []);
  // }, [selectedConversation]);

  // Récupération de l'utilisateur courant
  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/current-user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUserId(data.userId);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Une erreur est survenue lors de la récupération des informations utilisateur: ' + error);
    }
  };

  // Récupération des conversations
  const fetchConversations = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/conversation', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Une erreur est survenue lors de la récuperation des conversations: ' + error);
    }
  };

  // Fonction pour envoyer un message
  const sendMessage = async () => {
    if (!selectedConversation || !message) return;

    const token = localStorage.getItem('token');
    const privateKey = localStorage.getItem('privateKey');

    if (!token || !privateKey) {
      router.push('/login');
      return;
    }

    try {

      const encryptedForSender = encryptionService.encryptSymmetric(message, privateKey);
      const encryptedForReceiver = encryptionService.encryptAsymmetric(message, selectedConversation.recipientPublicKey);

      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          receiverId: selectedConversation.recipientId,
          encryptedContent: encryptedForReceiver,
          encryptedContentCU: encryptedForSender,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('');
        fetchMessages(selectedConversation.id);
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setError('Une erreur est survenue lors de l\'envoi du message: ' + error);
    }
  };


  // decryptage
  const decryptMessage = (message: Message) => {
    const privateKey = localStorage.getItem('privateKey');
    if (!privateKey) {
      router.push('/login');
      return 'Erreur: Clé privée non disponible';
    }

    try {
      // Assurer que la clé privée est au bon format pour le déchiffrement
      const formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;

      if (message.senderId === currentUserId) {
        return encryptionService.decryptSymmetric(message.encryptedContentCU, formattedPrivateKey);
      }
      else {
        return encryptionService.decryptAsymmetric(message.encryptedContent, formattedPrivateKey);
      }
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      return 'Message chiffré';
    }
  };



  // Fonction pour récupérer les messages d'une conversation
  const fetchMessages = async (conversationId: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && selectedConversation) {
        // Mise à jour de l'état avec les messages récupérés
        setSelectedConversation({ ...selectedConversation, messages: data.messages });
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Une erreur est survenue lors de la récuperation des messages: ' + error);
    }
  };

  // Fonction pour créer une nouvelle conversation
  const createNewConversation = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientUsername: newRecipient }),
      });
      const data = await res.json();
      if (res.ok) {
        // Mise à jour de l'état avec la nouvelle conversation créée
        setConversations([...conversations, data.conversation]);
        setNewRecipient('');
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Une erreur est survenue lors de la création de la nouvelle conversation:' + error);
    }
  };

  // Affichage du composant
  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="h-screen w-1/4 overflow-y-hidden border-r bg-white">
        <h2 className="p-4 text-xl font-bold">Conversations</h2>
        <ul>
          {conversations.map((conv) => (
            <li
              key={conv.id}
              className="cursor-pointer p-4 hover:bg-gray-100"
              onClick={() => setSelectedConversation(conv)}
            >
              {conv.recipientUsername}
            </li>
          ))}
        </ul>
        <div className="p-4">
          <input
            type="text"
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            className="w-full rounded border p-2 px-4"
            placeholder="Nouveau déstinataire (Nom d'utilisateur)"
          />
          <button
            onClick={createNewConversation}
            className="mt-2 w-full rounded bg-green-500 px-4 py-2 text-white"
          >
            Nouvelle conversation
          </button>
        </div>
      </div>
      <div className="flex h-screen w-3/4 flex-col overflow-y-hidden">
        {selectedConversation ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedConversation.messages && selectedConversation.messages.map((msg) => (
                <div key={msg.id} className={`mb-4 ${msg.senderId === selectedConversation.recipientId ? 'text-left' : 'text-right'}`}>
                  <p className="inline-block rounded-lg bg-blue-500 p-2 text-white">
                    {decryptMessage(msg)}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-white p-4">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded border p-2"
                placeholder="Taper un message..."
              />
              <button
                onClick={sendMessage}
                className="mt-2 rounded bg-blue-500 px-4 py-2 text-white"
              >
                Envoyer
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-gray-500">Choisir une conversation</p>
          </div>
        )}
      </div>
      {error && (
        <div className="absolute inset-x-0 bottom-0 bg-red-500 p-2 text-center text-white">
          {error}
        </div>
      )}
    </div>
  );
}
/* eslint-disable react/no-unescaped-entities */
'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <h1 className="mb-8 text-4xl font-bold">Welcome to Secure Chat</h1>

      {session ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="text-center mb-4">
            Bonjour, {session.user?.name || session.user?.email}
          </div>
          <button
            className="w-full rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600"
            onClick={() => router.push('/components/chat')}
          >
            Aller au Chat
          </button>
          <button
            className="w-full rounded bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-600"
            onClick={() => signOut({ redirect: true, callbackUrl: '/' })}
          >
            Se déconnecter
          </button>
        </div>
      ) : (
        <div className="flex space-x-4">
          <button
            className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600"
            onClick={() => router.push('/components/login')}
          >
            Se connecter
          </button>
          <button
            className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-600"
            onClick={() => router.push('/components/register')}
          >
            S'inscrire
          </button>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Home() {
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <h1 className="text-4xl font-bold mb-8">Welcome to Secure Chat</h1>
      {isLoggedIn ? (
        // Si l'utilisateur est connecté, affichage des boutons Go to Chat et Logout
        <div className="space-y-4">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 mx-4 rounded"
            onClick={() => router.push('/components/chat')}
          >
            Aller au Chat
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
            onClick={handleLogout}
          >
            Se déconnecter
          </button>
        </div>
      ) : (
        // Si l'utilisateur n'est pas connecté, affichage des boutons Login et Register
        <div className="space-x-4">
          <Link href="/components/login">
            <div className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Login</div>
          </Link>
          <Link href="/components/register">
            <div className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">Register</div>
          </Link>
        </div>
      )}
    </div>
  );
}
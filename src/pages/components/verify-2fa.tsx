
/* eslint-disable tailwindcss/no-custom-classname */
/* eslint-disable react/no-unescaped-entities */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Verify2FA() {

    const [token, setToken] = useState('');
    const [error, setError] = useState('');

    const router = useRouter();

    const { userId } = router.query;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token }),
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                router.push('/chat');
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError('Une erreur est survenue, veuillez réessayer: ' + error);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
            <h1 className="mb-6 text-3xl font-bold">Vérifier l'authentication à deux facteur</h1>
            <form onSubmit={handleSubmit} className="mb-4 rounded bg-white px-8 pb-8 pt-6 shadow-md">
                <div className="mb-4">
                    <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="token">
                        Entrer le token 2FA
                    </label>
                    <input
                        className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
                        id="token"
                        type="text"
                        placeholder="123456"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        required
                    />
                </div>
                {error && <p className="mb-4 text-xs italic text-red-500">{error}</p>}
                <div className="flex items-center justify-between">
                    <button
                        className="focus:shadow-outline rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 focus:outline-none"
                        type="submit"
                    >
                        Vérifier
                    </button>
                </div>
            </form>
        </div>
    );
}
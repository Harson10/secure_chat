import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
// import { encryptionService } from '@/services/encryptionService';

export default function SetupKeys() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push('/login');
            return;
        }

        const setupKeys = async () => {
            if (!session?.user?.id) return;

            try {
                // Vérifier si les clés existent déjà
                const existingPrivateKey = sessionStorage.getItem(`privateKey_${session.user.id}`);
                if (existingPrivateKey) {
                    router.push('/components/chat');
                    return;
                }

                // Récupérer les clés depuis le serveur
                const response = await fetch('/api/users/get-keys', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch keys');
                }

                const { privateKey } = await response.json();

                // Stocker la clé privée dans le sessionStorage
                sessionStorage.setItem(`privateKey_${session.user.id}`, privateKey);

                // Rediriger vers le chat
                router.push('/components/chat');
            } catch (error) {
                console.error('Error setting up keys:', error);
                setError('Failed to set up encryption keys. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        setupKeys();
    }, [session, status, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-4 text-2xl font-bold">Setting up encryption...</h1>
                    <div className="animate-spin rounded-full border-b-2 border-t-2 border-blue-500 h-12 w-12 mx-auto"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-4 text-2xl font-bold text-red-500">Error</h1>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
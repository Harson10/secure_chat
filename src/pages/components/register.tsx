/* eslint-disable @next/next/no-img-element */
/* eslint-disable react/no-unescaped-entities */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enable2FA, setEnable2FA] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret2FA, setSecret2FA] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: formulaire initial, 2: configuration 2FA

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Première étape : inscription de base
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          enable2FA
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message);
      }

      if (enable2FA) {
        // Si 2FA activé, on stocke les données nécessaires et on passe à l'étape 2
        setQrCode(data.qrCode);
        setSecret2FA(data.secret2FA);
        setStep(2);
      } else {
        // Si pas de 2FA, on termine l'inscription
        sessionStorage.setItem('privateKey', data.privateKey);
        router.push('/components/login');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secret2FA,
          token: verificationCode
        }),
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem('privateKey', data.privateKey);
        router.push('/components/login');
      } else {
        setError(data.message || 'Code de vérification incorrect');
      }
    } catch (error) {
      setError('Une erreur est survenue lors de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 1 ? 'Inscription' : 'Configuration de la 2FA'}
          </h2>
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="-space-y-px rounded-md shadow-sm">
              <div>
                <label htmlFor="username" className="sr-only">
                  Nom d'utilisateur
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Nom d'utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="relative block w-full appearance-none rounded-none border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="enable2FA"
                name="enable2FA"
                type="checkbox"
                className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={enable2FA}
                onChange={(e) => setEnable2FA(e.target.checked)}
                disabled={isLoading}
              />
              <label htmlFor="enable2FA" className="ml-2 block text-sm text-gray-900">
                Activer l'authentification à deux facteurs (2FA)
              </label>
            </div>

            {error && (
              <div className="text-center text-sm text-red-500">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                disabled={isLoading}
              >
                {isLoading ? 'Inscription en cours...' : 'S\'inscrire'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerify2FA}>
            <div className="space-y-4">
              {qrCode && (
                <div className="flex justify-center">
                  <img src={qrCode} alt="QR Code 2FA" className="size-48" />
                </div>
              )}
              <p className="text-center text-sm text-gray-600">
                Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
              </p>
              <div>
                <label htmlFor="verificationCode" className="sr-only">
                  Code de vérification
                </label>
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  required
                  className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Code de vérification"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="text-center text-sm text-red-500">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                disabled={isLoading}
              >
                {isLoading ? 'Vérification...' : 'Vérifier et terminer l\'inscription'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import '@/styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';

export default function App({
  Component,
  pageProps: { session, ...pageProps }
}: AppProps) {

  useEffect(() => {
    fetch('/api/socket');
  }, []);

  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
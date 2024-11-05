import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/authService';

const prisma = new PrismaClient();

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email et mot de passe requis');
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                });

                if (!user) {
                    throw new Error('Utilisateur non trouvé');
                }

                const isPasswordValid = await authService.verifyPassword(
                    credentials.password,
                    user.hashedPassword
                );

                if (!isPasswordValid) {
                    throw new Error('Mot de passe incorrect');
                }

                if (user.isTwoFactorEnabled) {
                    return {
                        id: user.id.toString(),
                        email: user.email,
                        requires2FA: true,
                        username: user.username
                    };
                }

                return {
                    id: user.id.toString(),
                    email: user.email,
                    name: user.username,
                    username: user.username
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.requires2FA = user.requires2FA;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.requires2FA = token.requires2FA;
            }
            return session;
        }
    },
    pages: {
        signIn: '/components/login',
    },
    session: {
        strategy: 'jwt',
    },
};

export default NextAuth(authOptions);
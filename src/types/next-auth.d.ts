import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            requires2FA?: boolean;
        } & DefaultSession['user'];
    }

    interface User {
        id: string;
        requires2FA?: boolean;
        username?: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        requires2FA?: boolean;
    }
}
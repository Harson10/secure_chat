/* eslint-disable @typescript-eslint/no-unused-vars */
// pages/api/_middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const response = NextResponse.next();
    response.headers.set('Content-Type', 'application/json');
    return response;
}
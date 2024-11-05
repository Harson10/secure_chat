// middleware.ts
export { default } from "next-auth/middleware"

export const config = {
    matcher: [
        "/",
        "/components/chat",
        "/api/conversation",
        "/api/messages",
        "/api/current-user",
        "/api/get-keys"
    ]
}
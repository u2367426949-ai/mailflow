// ============================================================
// MailFlow — Utilitaire d'authentification partagé
// Extraire l'userId depuis le JWT cookie de session
// ============================================================

import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

/**
 * Extraire l'userId depuis le cookie JWT `mailflow_session`.
 * Retourne `null` si le cookie est absent ou le JWT invalide/expiré.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('mailflow_session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.sub ?? null
  } catch {
    return null
  }
}

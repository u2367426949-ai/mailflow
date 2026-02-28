// ============================================================
// MailFlow — Route API : OAuth2 Gmail callback
// GET /api/auth/gmail?code=...&state=...
// POST /api/auth/gmail → génère l'URL d'autorisation
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getGoogleProfile,
  encryptToken,
} from '@/lib/gmail'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// ----------------------------------------------------------
// POST — Générer l'URL d'autorisation Google
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Générer un state anti-CSRF
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36)

    // Stocker le state dans un cookie httpOnly (expire dans 10 min)
    const authUrl = getAuthorizationUrl(state)

    const response = NextResponse.json({ url: authUrl })
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[Auth] Failed to generate auth URL:', err)
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 })
  }
}

// ----------------------------------------------------------
// GET — Callback OAuth2 Google
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Gestion des erreurs Google (ex: accès refusé)
  if (error) {
    console.error('[Auth] Google OAuth error:', error)
    return NextResponse.redirect(`${APP_URL}/onboarding?error=access_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/onboarding?error=invalid_callback`)
  }

  try {
    // Échanger le code contre les tokens
    let tokens
    try {
      tokens = await exchangeCodeForTokens(code)
    } catch (tokenErr) {
      console.error('[Auth] Token exchange failed:', tokenErr)
      return NextResponse.redirect(`${APP_URL}/onboarding?error=token_exchange_failed`)
    }

    if (!tokens.access_token) {
      console.error('[Auth] No access token received', tokens)
      return NextResponse.redirect(`${APP_URL}/onboarding?error=no_access_token`)
    }

    // Récupérer le profil Google
    let profile
    try {
      profile = await getGoogleProfile(tokens.access_token)
    } catch (profileErr) {
      console.error('[Auth] Profile fetch failed:', profileErr)
      return NextResponse.redirect(`${APP_URL}/onboarding?error=profile_fetch_failed`)
    }

    // Créer ou mettre à jour l'utilisateur en DB
    const user = await db.user.upsert({
      where: { googleId: profile.googleId },
      update: {
        name: profile.name,
        avatar: profile.avatar,
        googleAccessToken: tokens.access_token ? encryptToken(tokens.access_token) : undefined,
        googleRefreshToken: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : undefined,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
      create: {
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        googleId: profile.googleId,
        googleAccessToken: tokens.access_token ? encryptToken(tokens.access_token) : null,
        googleRefreshToken: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        plan: 'free',
        isOnboarded: false,
      },
    })

    // Créer les catégories par défaut si premier login
    const existingCategories = await db.category.count({ where: { userId: user.id } })
    if (existingCategories === 0) {
      await db.category.createMany({
        data: [
          {
            userId: user.id,
            name: 'urgent',
            displayName: '🔴 Urgent',
            description: 'Emails nécessitant une action rapide (délai < 24h)',
            emoji: '🔴',
            color: '#dc2626',
            isDefault: true,
            sortOrder: 1,
          },
          {
            userId: user.id,
            name: 'personal',
            displayName: '👤 Personnel',
            description: 'Emails personnels (amis, famille)',
            emoji: '👤',
            color: '#8b5cf6',
            isDefault: true,
            sortOrder: 2,
          },
          {
            userId: user.id,
            name: 'business',
            displayName: '💼 Business',
            description: 'Communication professionnelle (clients, partenaires)',
            emoji: '💼',
            color: '#3b82f6',
            isDefault: true,
            sortOrder: 3,
          },
          {
            userId: user.id,
            name: 'invoices',
            displayName: '📄 Factures',
            description: 'Factures, reçus, documents financiers',
            emoji: '📄',
            color: '#f59e0b',
            isDefault: true,
            sortOrder: 4,
          },
          {
            userId: user.id,
            name: 'newsletters',
            displayName: '📰 Newsletters',
            description: 'Newsletters, promotions, notifications',
            emoji: '📰',
            color: '#10b981',
            isDefault: true,
            sortOrder: 5,
          },
          {
            userId: user.id,
            name: 'spam',
            displayName: '🗑️ Spam',
            description: 'Spam, publicité, emails indésirables',
            emoji: '🗑️',
            color: '#6a6a6a',
            isDefault: true,
            sortOrder: 6,
          },
        ],
        skipDuplicates: true,
      })
    }

    // Émettre un JWT de session
    const jwt = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      isOnboarded: user.isOnboarded,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(JWT_SECRET)

    // Rediriger vers l'onboarding ou le dashboard
    const redirectTo = user.isOnboarded
      ? `${APP_URL}/dashboard`
      : `${APP_URL}/onboarding`

    const response = NextResponse.redirect(redirectTo)

    // Stocker le JWT dans un cookie httpOnly
    response.cookies.set('mailflow_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 jours
      path: '/',
    })

    // Nettoyer le cookie de state
    response.cookies.delete('oauth_state')

    return response
  } catch (err) {
    console.error('[Auth] OAuth callback failed:', err)
    return NextResponse.redirect(`${APP_URL}/onboarding?error=auth_failed`)
  }
}

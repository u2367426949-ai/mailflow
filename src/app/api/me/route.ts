// ============================================================
// MailFlow — Route API : Profil utilisateur
// GET  /api/me — récupérer le profil
// PUT  /api/me — mettre à jour les settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ----------------------------------------------------------
// Schéma Zod pour la validation du body PUT /api/me
// ----------------------------------------------------------
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  digestEnabled: z.boolean().optional(),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu').optional(),
  timezone: z.string().max(50).optional(),
  isOnboarded: z.boolean().optional(),
  enabledCategories: z.array(z.string().min(1).max(50)).max(20).optional(),
  settings: z.record(z.unknown()).optional(),
}).strict()

// ----------------------------------------------------------
// GET — Profil utilisateur connecté
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      plan: true,
      trialEndsAt: true,
      digestEnabled: true,
      digestTime: true,
      timezone: true,
      isOnboarded: true,
      lastSyncAt: true,
      createdAt: true,
      settings: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user })
}

// ----------------------------------------------------------
// PUT — Mettre à jour les settings utilisateur
// ----------------------------------------------------------
export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof updateProfileSchema>

  try {
    const raw = await request.json()
    const result = updateProfileSchema.safeParse(raw)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    body = result.data
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // Mettre à jour les catégories activées si fourni
    if (body.enabledCategories) {
      await db.category.updateMany({
        where: { userId },
        data: { isActive: false },
      })
      if (body.enabledCategories.length > 0) {
        await db.category.updateMany({
          where: { userId, name: { in: body.enabledCategories } },
          data: { isActive: true },
        })
      }
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.digestEnabled !== undefined && { digestEnabled: body.digestEnabled }),
        ...(body.digestTime !== undefined && { digestTime: body.digestTime }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
        ...(body.isOnboarded !== undefined && { isOnboarded: body.isOnboarded }),
        ...(body.settings !== undefined && { settings: body.settings as Prisma.InputJsonValue }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        isOnboarded: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error('[Me] Update error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

// ----------------------------------------------------------
// DELETE — Supprimer le compte
// ----------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db.user.delete({ where: { id: userId } })

    const response = NextResponse.json({ success: true })
    response.cookies.delete('mailflow_session')
    return response
  } catch (err) {
    console.error('[Me] Delete error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

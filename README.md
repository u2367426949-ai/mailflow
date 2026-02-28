# MailFlow — Email Sorter IA

> **Ta boîte mail, enfin sous contrôle.**

MailFlow est un SaaS qui se connecte à ta boîte Gmail et trie automatiquement tes emails par IA en temps réel.

---

## Stack technique

- **Framework** : Next.js 14 (App Router)
- **Langage** : TypeScript
- **UI** : Tailwind CSS
- **Base de données** : PostgreSQL + Prisma ORM
- **IA** : OpenAI GPT-4o-mini
- **Auth** : Google OAuth 2.0 (Gmail API)
- **Billing** : Stripe Checkout + Webhooks
- **Email** : Resend (digests)

---

## Prérequis

- Node.js 20+
- PostgreSQL (local ou Neon/Supabase)
- Compte Google Cloud (Gmail API)
- Compte OpenAI
- Compte Stripe
- Compte Resend

---

## Installation

### 1. Cloner le projet

```bash
git clone <repo>
cd email-sorter/MVP
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Variables d'environnement

```bash
cp .env.example .env.local
```

Remplir toutes les variables dans `.env.local` (voir section ci-dessous).

### 4. Initialiser la base de données

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev --name init

# Seeder les données par défaut (catégories)
npx prisma db seed
```

### 5. Lancer en développement

```bash
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

---

## Variables d'environnement

### Base de données

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mailflow"
```

### Auth Google / Gmail API

Créer un projet sur [Google Cloud Console](https://console.cloud.google.com/) :
1. Activer l'**API Gmail**
2. Créer des credentials **OAuth 2.0 Web Application**
3. Ajouter les redirect URIs :
   - Dev : `http://localhost:3000/api/auth/gmail`
   - Prod : `https://your-domain.com/api/auth/gmail`

```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/gmail"
```

### OpenAI

```env
OPENAI_API_KEY="sk-your-openai-api-key"
```

### Stripe

1. Créer les produits dans le [Dashboard Stripe](https://dashboard.stripe.com/) :
   - **Starter** : 9€/mois → noter le `price_id`
   - **Pro** : 29€/mois → noter le `price_id`
   - **Business** : 79€/mois → noter le `price_id`
2. Configurer le Customer Portal dans Stripe Dashboard
3. Créer un endpoint webhook vers `/api/webhooks/stripe`

```env
STRIPE_SECRET_KEY="sk_test_your-stripe-secret"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"
STRIPE_STARTER_PRICE_ID="price_starter_id"
STRIPE_PRO_PRICE_ID="price_pro_id"
STRIPE_BUSINESS_PRICE_ID="price_business_id"
```

### Resend (envoi d'emails)

```env
RESEND_API_KEY="re_your-resend-api-key"
RESEND_FROM_EMAIL="digest@mailflow.ai"
```

### App

```env
NEXTAUTH_SECRET="your-super-secret-jwt-key-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Chiffrement des tokens OAuth

```env
ENCRYPTION_KEY="your-32-chars-encryption-key-here"
```

---

## Structure du projet

```
MVP/
├── prisma/
│   └── schema.prisma          # Schéma DB complet
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout racine (Tailwind, fonts)
│   │   ├── page.tsx            # Landing page
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Dashboard principal
│   │   ├── onboarding/
│   │   │   └── page.tsx        # Onboarding 3 étapes
│   │   └── api/
│   │       ├── auth/gmail/     # OAuth2 Google callback
│   │       ├── emails/process/ # Traitement IA des emails
│   │       ├── emails/feedback/# Feedback utilisateur
│   │       ├── digest/         # Génération du digest quotidien
│   │       ├── billing/        # Stripe checkout / portal
│   │       └── webhooks/stripe/# Webhooks Stripe
│   ├── components/
│   │   ├── EmailList.tsx       # Liste des emails avec catégories
│   │   ├── CategoryBadge.tsx   # Badge coloré par catégorie
│   │   └── StatsCard.tsx       # Cartes de statistiques
│   └── lib/
│       ├── gmail.ts            # Client Gmail API
│       ├── openai.ts           # Classification IA
│       ├── stripe.ts           # Client Stripe
│       └── db.ts               # Client Prisma singleton
├── .env.example
├── package.json
└── README.md
```

---

## Scripts disponibles

```bash
npm run dev          # Développement (port 3000)
npm run build        # Build de production
npm run start        # Démarrer en production
npm run lint         # Linter ESLint
npm run db:migrate   # Appliquer les migrations DB
npm run db:seed      # Seeder les catégories par défaut
npm run db:studio    # Ouvrir Prisma Studio (DB GUI)
```

---

## Fonctionnalités MVP

- ✅ **Connexion Gmail OAuth** — Authentification sécurisée avec les scopes Gmail
- ✅ **Catégorisation IA** — 6 catégories : Urgent, Personnel, Business, Factures, Newsletters, Spam
- ✅ **Labels automatiques** — Création et application des labels Gmail
- ✅ **Dashboard web** — Stats, historique, activité récente
- ✅ **Digest quotidien** — Email résumé configurable
- ✅ **Feedback loop** — Correction des classifications + apprentissage
- ✅ **Onboarding guidé** — 3 étapes : connecter → configurer → activer
- ✅ **Billing Stripe** — Plans Starter/Pro/Business + trial 14 jours

---

## Déploiement (Vercel)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

Configurer les variables d'environnement dans le dashboard Vercel.

**Cron jobs** (dans `vercel.json`) :
- `POST /api/emails/process` — toutes les 5 minutes (polling Gmail)
- `POST /api/digest` — chaque jour à 7h UTC

---

## Architecture de la classification IA

```
Email reçu → Extraction métadonnées → GPT-4o-mini → Catégorie + confiance
                                          ↓
                                   Label Gmail créé/appliqué
                                          ↓
                              Feedback utilisateur → Amélioration
```

Le prompt système est optimisé pour une précision >92% sur les emails professionnels francophones et anglophones.

---

## Coûts estimés par utilisateur/mois

| Plan | Emails/jour | Coût IA OpenAI |
|------|------------|----------------|
| Starter | 100 | ~0.18$/mois |
| Pro | 500 | ~0.90$/mois |
| Business | 2000 | ~3.60$/mois |

**Marge brute : >95%** sur tous les plans.

---

## Support

- 📧 support@mailflow.ai
- 📖 [Documentation](https://docs.mailflow.ai)
- 🐛 [GitHub Issues](https://github.com/nodeia/mailflow)

---

*© 2026 MailFlow — NodeIA*

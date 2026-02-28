// ============================================================
// MailFlow — Landing Page
// ============================================================

import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import {
  Mail,
  Zap,
  BarChart3,
  Shield,
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
  Sparkles,
  Bot,
} from 'lucide-react'
import { PricingSection } from '@/components/PricingSection'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

// ----------------------------------------------------------
// Lire la session depuis le cookie JWT (Server Component)
// ----------------------------------------------------------
async function getSession(): Promise<{ name?: string; avatar?: string; email?: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('mailflow_session')?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      name: payload['name'] as string | undefined,
      avatar: payload['avatar'] as string | undefined,
      email: payload['email'] as string | undefined,
    }
  } catch {
    return null
  }
}

// ----------------------------------------------------------
// Composants locaux
// ----------------------------------------------------------
function NavBar({ session }: { session: { name?: string; avatar?: string; email?: string } | null }) {
  const firstName = session?.name?.split(' ')[0]

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[#f0f0f5]">MailFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-[#94949e] hover:text-[#f0f0f5] transition-colors duration-200">
              Fonctionnalités
            </Link>
            <Link href="#pricing" className="text-sm text-[#94949e] hover:text-[#f0f0f5] transition-colors duration-200">
              Tarifs
            </Link>
            <Link href="#faq" className="text-sm text-[#94949e] hover:text-[#f0f0f5] transition-colors duration-200">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl glass glass-hover transition-all duration-200"
              >
                {session.avatar ? (
                  <Image
                    src={session.avatar}
                    alt={session.name ?? 'Avatar'}
                    width={24}
                    height={24}
                    className="rounded-full ring-2 ring-indigo-500/30"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                    {firstName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <span className="text-sm text-[#f0f0f5] font-medium hidden sm:block">
                  {firstName ?? 'Dashboard'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5a5a66] hidden sm:block" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-[#94949e] hover:text-[#f0f0f5] transition-colors hidden sm:block"
                >
                  Connexion
                </Link>
                <Link
                  href="/onboarding"
                  className="btn-primary btn-shine text-sm !px-5 !py-2"
                >
                  Essai gratuit
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="relative pt-24 pb-28 overflow-hidden bg-mesh-1">
      {/* Dot grid overlay */}
      <div className="absolute inset-0 bg-dot-grid pointer-events-none" />

      {/* Accent glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-600/[0.07] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8 animate-fade-in-up">
          <Sparkles className="w-3.5 h-3.5" />
          Propulsé par GPT-4o-mini · 14 jours d&apos;essai gratuit
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <span className="text-[#f0f0f5]">Ta boîte mail,</span>
          <br />
          <span className="text-gradient">enfin sous contrôle</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-[#94949e] max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          MailFlow trie, priorise et résume tes emails automatiquement.
          Connecte ta boîte Gmail en 1 clic — l&apos;IA s&apos;occupe du reste.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <Link
            href="/onboarding"
            className="btn-primary btn-shine w-full sm:w-auto !px-8 !py-4 !text-lg !font-bold !rounded-2xl shadow-xl shadow-indigo-600/25"
          >
            Commencer gratuitement
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#features"
            className="btn-secondary w-full sm:w-auto !px-8 !py-4 !text-lg !rounded-2xl"
          >
            Voir comment ça marche
          </Link>
        </div>

        <p className="mt-6 text-sm text-[#5a5a66] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          Aucune carte bancaire requise · Annulation à tout moment
        </p>

        {/* Dashboard mockup */}
        <div className="mt-20 relative animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <div className="absolute -inset-4 bg-gradient-to-b from-indigo-600/10 via-transparent to-transparent rounded-3xl blur-2xl pointer-events-none" />
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-5 shadow-2xl shadow-black/60 glow-border">
            {/* Window dots */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]/80" />
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]/80" />
              <div className="w-3 h-3 rounded-full bg-[#10b981]/80" />
              <div className="flex-1" />
              <div className="text-[11px] text-[#5a5a66] font-mono">mailflow.ai/dashboard</div>
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Emails traités', value: '1,247', color: 'from-blue-500 to-indigo-600' },
                { label: 'Précision IA', value: '94%', color: 'from-emerald-500 to-teal-600' },
                { label: 'Urgents', value: '3', color: 'from-red-500 to-rose-600' },
                { label: 'Temps gagné', value: '12h', color: 'from-violet-500 to-purple-600' },
              ].map((stat) => (
                <div key={stat.label} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</div>
                  <div className="text-[10px] text-[#5a5a66] mt-1 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
            {/* Email rows */}
            <div className="space-y-1">
              {[
                { from: 'Client ABC', subject: 'Contrat Q1 2026 — signature urgente', cat: '🔴 Urgent', catColor: 'text-red-400 bg-red-500/10 border border-red-500/20' },
                { from: 'GitHub', subject: 'Security alert for mailflow/api', cat: '💼 Business', catColor: 'text-blue-400 bg-blue-500/10 border border-blue-500/20' },
                { from: 'Stripe', subject: 'Your invoice for February 2026', cat: '📄 Factures', catColor: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' },
                { from: 'Indie Hackers', subject: 'How we got to $10k MRR in 6 months', cat: '📰 Newsletter', catColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' },
              ].map((email, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors duration-200">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.02] flex items-center justify-center text-xs text-[#94949e] font-medium flex-shrink-0 border border-white/[0.06]">
                    {email.from[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#f0f0f5] truncate">{email.subject}</div>
                    <div className="text-[10px] text-[#5a5a66]">{email.from}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium flex-shrink-0 ${email.catColor}`}>
                    {email.cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#050507] to-transparent rounded-b-2xl pointer-events-none" />
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      gradient: 'from-blue-500 to-indigo-600',
      glow: 'group-hover:shadow-blue-500/20',
      title: 'Tri IA en temps réel',
      description:
        'GPT-4o-mini classe chaque email dans l\'une des 6 catégories avec une précision >92%. Labels automatiques dans Gmail.',
    },
    {
      icon: BarChart3,
      gradient: 'from-violet-500 to-purple-600',
      glow: 'group-hover:shadow-violet-500/20',
      title: 'Dashboard de stats',
      description:
        'Visualise ton activité email en un coup d\'œil : volume, catégories, précision, temps gagné estimé.',
    },
    {
      icon: Bot,
      gradient: 'from-indigo-500 to-violet-600',
      glow: 'group-hover:shadow-indigo-500/20',
      title: 'Agent IA personnel',
      description:
        'Converse avec ton agent pour créer des règles de tri sur mesure. Il analyse tes emails et s\'adapte.',
    },
    {
      icon: Shield,
      gradient: 'from-emerald-500 to-teal-600',
      glow: 'group-hover:shadow-emerald-500/20',
      title: 'Sécurité & RGPD',
      description:
        'OAuth Google. Tokens chiffrés AES-256. Hébergement UE. Conforme RGPD. Aucun corps d\'email stocké.',
    },
  ]

  return (
    <section id="features" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-indigo-300 mb-4">
            <Sparkles className="w-3 h-3" /> Fonctionnalités
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f0f5] mb-4">
            Tout ce dont tu as besoin
          </h2>
          <p className="text-[#94949e] text-lg max-w-2xl mx-auto">
            MailFlow s&apos;intègre parfaitement à Gmail et travaille en arrière-plan
            pour que tu n&apos;aies plus à trier manuellement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative p-6 rounded-2xl bg-[#0c0c10] border border-white/[0.06] card-hover transition-all duration-300"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg ${feature.glow} transition-shadow duration-300`}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-[#f0f0f5] font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-[#94949e] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Feature checklist */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {[
            'Connexion Gmail OAuth2 sécurisée',
            '6 catégories intelligentes (Urgent, Business, Personnel...)',
            'Labels Gmail automatiques et colorés',
            'Feedback loop — l\'IA apprend de tes corrections',
            'Agent IA conversationnel pour règles sur mesure',
            'Tri complet de ta boîte avec suivi en temps réel',
            'Essai gratuit 14 jours sans CB',
            'Plans Starter, Pro et Business',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[#94949e] text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Marc D.',
      role: 'CEO @ TechStartup',
      text: 'MailFlow m\'a fait économiser 2h par jour. Ma boîte Gmail était un désastre, maintenant tout est organisé automatiquement.',
      stars: 5,
      gradient: 'from-blue-500/10 to-indigo-500/5',
    },
    {
      name: 'Sophie L.',
      role: 'Freelance consultant',
      text: 'La précision de l\'IA est bluffante. 94% de mes emails sont classifiés correctement dès le premier jour.',
      stars: 5,
      gradient: 'from-violet-500/10 to-purple-500/5',
    },
    {
      name: 'Thomas B.',
      role: 'Product Manager',
      text: 'Le digest quotidien change tout. Je lis 5 emails importants le matin au lieu de scroller dans 80 messages.',
      stars: 5,
      gradient: 'from-emerald-500/10 to-teal-500/5',
    },
  ]

  return (
    <section className="relative py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f0f5] mb-4">Ce qu&apos;ils en disent</h2>
          <p className="text-[#94949e]">Des centaines d&apos;utilisateurs font confiance à MailFlow</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div key={t.name} className={`relative p-6 rounded-2xl bg-gradient-to-br ${t.gradient} border border-white/[0.06] card-hover`}>
              <div className="flex mb-4">
                {[...Array(t.stars)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-[#c0c0c8] text-sm leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-[#f0f0f5] text-sm font-semibold">{t.name}</div>
                  <div className="text-[#5a5a66] text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqSection() {
  const faqs = [
    {
      q: 'MailFlow lit-il le contenu de mes emails ?',
      a: 'MailFlow accède uniquement aux métadonnées (expéditeur, sujet, extrait) pour la classification. Nous ne stockons jamais le corps complet de vos emails.',
    },
    {
      q: 'Que se passe-t-il à la fin de l\'essai gratuit ?',
      a: 'Vous pouvez choisir un plan payant pour continuer. Si vous ne faites rien, votre compte passe en plan gratuit (lecture seule du dashboard).',
    },
    {
      q: 'Est-ce que MailFlow fonctionne avec Outlook ?',
      a: 'Pour l\'instant, MailFlow supporte uniquement Gmail. Le support Outlook est prévu pour la prochaine version.',
    },
    {
      q: 'Comment améliorer la précision du tri ?',
      a: 'Utilisez le feedback "Mal classé" ou l\'agent IA conversationnel pour créer des règles de tri personnalisées.',
    },
  ]

  return (
    <section id="faq" className="relative py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f0f5] mb-4">Questions fréquentes</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="p-5 rounded-2xl bg-[#0c0c10] border border-white/[0.06] card-hover">
              <h3 className="text-[#f0f0f5] font-semibold mb-2">{faq.q}</h3>
              <p className="text-[#94949e] text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="relative py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="relative p-14 rounded-3xl overflow-hidden glow-border">
          {/* Background mesh */}
          <div className="absolute inset-0 bg-mesh-1 opacity-60" />
          <div className="absolute inset-0 bg-[#0c0c10]" style={{ opacity: 0.85 }} />
          <div className="absolute inset-0 bg-dot-grid opacity-30" />

          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/25 animate-float">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f0f5] mb-4">
              Prêt à reprendre le contrôle ?
            </h2>
            <p className="text-[#94949e] text-lg mb-8 max-w-lg mx-auto">
              Rejoins des centaines d&apos;utilisateurs qui ont déjà libéré leur boîte mail.
            </p>
            <Link
              href="/onboarding"
              className="btn-primary btn-shine !px-8 !py-4 !text-lg !font-bold !rounded-2xl shadow-xl shadow-indigo-600/25"
            >
              Commencer gratuitement
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-5 text-sm text-[#5a5a66]">
              14 jours d&apos;essai · Sans carte bancaire
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#f0f0f5]">MailFlow</span>
            <span className="text-[#5a5a66] text-sm">by NodeIA</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#5a5a66]">
            <Link href="/privacy" className="hover:text-[#94949e] transition-colors">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-[#94949e] transition-colors">
              CGV
            </Link>
            <a href="mailto:support@mailflow.ai" className="hover:text-[#94949e] transition-colors">
              Support
            </a>
          </div>
          <p className="text-[#5a5a66] text-sm">© 2026 MailFlow — NodeIA</p>
        </div>
      </div>
    </footer>
  )
}

// ----------------------------------------------------------
// Page principale
// ----------------------------------------------------------
export default async function LandingPage() {
  const session = await getSession()

  return (
    <>
      <NavBar session={session} />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}

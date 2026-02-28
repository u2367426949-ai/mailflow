// ============================================================
// MailFlow — Landing Page
// ============================================================

import Link from 'next/link'
import {
  Mail,
  Zap,
  BarChart3,
  Shield,
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
} from 'lucide-react'
import { PricingSection } from '@/components/PricingSection'

// ----------------------------------------------------------
// Composants locaux
// ----------------------------------------------------------
function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-400" />
            <span className="text-lg font-bold text-[#f5f5f5]">MailFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors">
              Fonctionnalités
            </Link>
            <Link href="#pricing" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors">
              Tarifs
            </Link>
            <Link href="#faq" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors hidden sm:block"
            >
              Connexion
            </Link>
            <Link
              href="/onboarding"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Essai gratuit →
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="relative pt-20 pb-24 overflow-hidden">
      {/* Glow d'arrière-plan */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-800/50 bg-blue-950/30 text-blue-400 text-xs font-medium mb-6">
          <Zap className="w-3 h-3" />
          Propulsé par GPT-4o-mini · 14 jours d'essai gratuit
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#f5f5f5] leading-tight mb-6">
          Ta boîte mail,
          <br />
          <span className="text-blue-400">enfin sous contrôle</span>
        </h1>

        <p className="text-lg sm:text-xl text-[#a0a0a0] max-w-2xl mx-auto mb-10 leading-relaxed">
          MailFlow trie, priorise et résume tes emails automatiquement.
          Connecte ta boîte Gmail en 1 clic — l'IA s'occupe du reste.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/25"
          >
            Commencer gratuitement
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#features"
            className="w-full sm:w-auto px-8 py-4 border border-[#3a3a3a] hover:border-[#4a4a4a] text-[#a0a0a0] hover:text-[#f5f5f5] font-medium rounded-xl text-lg transition-colors"
          >
            Voir comment ça marche
          </Link>
        </div>

        <p className="mt-6 text-sm text-[#6a6a6a]">
          Aucune carte bancaire requise · Annulation à tout moment
        </p>

        {/* Dashboard mockup */}
        <div className="mt-16 relative">
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <div className="w-3 h-3 rounded-full bg-[#10b981]" />
              <div className="flex-1" />
              <div className="text-xs text-[#6a6a6a]">mailflow.ai/dashboard</div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Emails traités', value: '247', color: 'text-blue-400' },
                { label: 'Précision IA', value: '94%', color: 'text-emerald-400' },
                { label: 'Urgents', value: '3', color: 'text-red-400' },
                { label: 'Temps gagné', value: '2h', color: 'text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a]">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-[#6a6a6a] mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {[
                { from: 'Client ABC', subject: 'Contrat Q1 2026 — signature urgente', cat: '🔴 Urgent', catColor: 'text-red-400 bg-red-900/20' },
                { from: 'GitHub', subject: 'Security alert for mailflow/api', cat: '💼 Business', catColor: 'text-blue-400 bg-blue-900/20' },
                { from: 'Stripe', subject: 'Your invoice for February 2026', cat: '📄 Factures', catColor: 'text-amber-400 bg-amber-900/20' },
                { from: 'Indie Hackers', subject: 'How we got to $10k MRR in 6 months', cat: '📰 Newsletter', catColor: 'text-emerald-400 bg-emerald-900/20' },
              ].map((email, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1e1e1e] transition-colors">
                  <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs flex-shrink-0">
                    {email.from[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#f5f5f5] truncate">{email.subject}</div>
                    <div className="text-[10px] text-[#6a6a6a]">{email.from}</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${email.catColor}`}>
                    {email.cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-30 rounded-2xl" />
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-950/50',
      title: 'Tri IA en temps réel',
      description:
        'GPT-4o-mini classe chaque email dans l\'une des 6 catégories avec une précision >92%. Labels automatiques dans Gmail.',
    },
    {
      icon: BarChart3,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-950/50',
      title: 'Dashboard de stats',
      description:
        'Visualise ton activité email en un coup d\'œil : volume, catégories, précision, temps gagné estimé.',
    },
    {
      icon: Clock,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-950/50',
      title: 'Digest quotidien',
      description:
        'Reçois chaque matin un résumé des emails importants. Ne rate plus jamais un message urgent.',
    },
    {
      icon: Shield,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-950/50',
      title: 'Sécurité & confidentialité',
      description:
        'Authentification OAuth Google. Tokens chiffrés AES-256. Hébergement UE. Conforme RGPD.',
    },
  ]

  return (
    <section id="features" className="py-24 border-t border-[#2a2a2a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f5] mb-4">
            Tout ce dont tu as besoin
          </h2>
          <p className="text-[#a0a0a0] text-lg max-w-2xl mx-auto">
            MailFlow s'intègre parfaitement à Gmail et travaille en arrière-plan
            pour que tu n'aies plus à trier manuellement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-[#2a2a2a] bg-[#141414] hover:border-[#3a3a3a] transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
              </div>
              <h3 className="text-[#f5f5f5] font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-[#a0a0a0] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Feature list */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            'Connexion Gmail OAuth2 sécurisée',
            '6 catégories intelligentes (Urgent, Business, Personnel...)',
            'Labels Gmail automatiques et colorés',
            'Feedback loop — l\'IA apprend de tes corrections',
            'Digest quotidien personnalisable',
            'Plans Starter, Pro et Business',
            'Essai gratuit 14 jours sans CB',
            'API disponible (plan Business)',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-[#a0a0a0] text-sm">{item}</span>
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
    },
    {
      name: 'Sophie L.',
      role: 'Freelance consultant',
      text: 'La précision de l\'IA est bluffante. 94% de mes emails sont classifiés correctement dès le premier jour.',
      stars: 5,
    },
    {
      name: 'Thomas B.',
      role: 'Product Manager',
      text: 'Le digest quotidien change tout. Je lis 5 emails importants le matin au lieu de scroller dans 80 messages.',
      stars: 5,
    },
  ]

  return (
    <section className="py-24 border-t border-[#2a2a2a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[#f5f5f5] mb-4">Ce qu'ils en disent</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="p-6 rounded-xl border border-[#2a2a2a] bg-[#141414]">
              <div className="flex mb-3">
                {[...Array(t.stars)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-[#a0a0a0] text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div>
                <div className="text-[#f5f5f5] text-sm font-semibold">{t.name}</div>
                <div className="text-[#6a6a6a] text-xs">{t.role}</div>
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
      a: 'Utilisez le bouton "Mal classé" dans le dashboard. Chaque correction améliore les futures classifications pour votre compte.',
    },
  ]

  return (
    <section id="faq" className="py-24 border-t border-[#2a2a2a]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[#f5f5f5] mb-4">Questions fréquentes</h2>
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="p-5 rounded-xl border border-[#2a2a2a] bg-[#141414]">
              <h3 className="text-[#f5f5f5] font-semibold mb-2">{faq.q}</h3>
              <p className="text-[#a0a0a0] text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="py-24 border-t border-[#2a2a2a]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="relative p-12 rounded-2xl border border-blue-800/30 bg-blue-950/20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f5] mb-4">
              Prêt à reprendre le contrôle ?
            </h2>
            <p className="text-[#a0a0a0] text-lg mb-8">
              Rejoins des centaines d'utilisateurs qui ont déjà libéré leur boîte mail.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/25"
            >
              Commencer gratuitement
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-sm text-[#6a6a6a]">
              14 jours d'essai · Sans carte bancaire
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 border-t border-[#2a2a2a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-[#f5f5f5]">MailFlow</span>
            <span className="text-[#6a6a6a] text-sm">by NodeIA</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#6a6a6a]">
            <Link href="/privacy" className="hover:text-[#a0a0a0] transition-colors">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-[#a0a0a0] transition-colors">
              CGV
            </Link>
            <a href="mailto:support@mailflow.ai" className="hover:text-[#a0a0a0] transition-colors">
              Support
            </a>
          </div>
          <p className="text-[#6a6a6a] text-sm">© 2026 MailFlow — NodeIA</p>
        </div>
      </div>
    </footer>
  )
}

// ----------------------------------------------------------
// Page principale
// ----------------------------------------------------------
export default function LandingPage() {
  return (
    <>
      <NavBar />
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

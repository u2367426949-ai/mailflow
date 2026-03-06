'use client'

// ============================================================
// MailFlow — Agent IA flottant (coin bas-droite)
// Disponible uniquement sur le plan Pro / Business
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot,
  X,
  Send,
  Zap,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Minimize2,
  Maximize2,
  Crown,
  Sparkles,
  ChevronRight,
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ApplyJob {
  status: 'idle' | 'running' | 'completed' | 'error'
  totalEmails: number
  processed: number
  reclassified: number
  relabeled: number
  errors: number
  lastError: string | null
}

interface MailAgentProps {
  isPro: boolean
  onUpgrade?: () => void
}

export function MailAgent({ isPro, onUpgrade }: MailAgentProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [extractedRules, setExtractedRules] = useState<string | null>(null)
  const [rulesApplied, setRulesApplied] = useState(false)
  const [applyJob, setApplyJob] = useState<ApplyJob | null>(null)
  const [applyPolling, setApplyPolling] = useState(false)
  const [unreadDot, setUnreadDot] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input quand ouvert
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setUnreadDot(false)
    }
  }, [open])

  // Message de bienvenue + analyse auto dès l'ouverture (1 fois)
  useEffect(() => {
    if (!open || !isPro || initialized.current || messages.length > 0) return
    initialized.current = true
    sendMessage('Analyse ma boîte mail et donne-moi un bilan complet : volume d\'emails, newsletters indésirables, expéditeurs récurrents, et propose-moi des actions concrètes.')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPro])

  // Polling apply-rules
  useEffect(() => {
    if (!applyPolling) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/emails/apply-rules')
        const data = await res.json()
        if (data.job) {
          setApplyJob(data.job)
          if (['completed', 'error', 'idle'].includes(data.job.status)) {
            setApplyPolling(false)
            if (data.job.status === 'completed') {
              setRulesApplied(true)
              setTimeout(() => setRulesApplied(false), 8000)
            }
          }
        }
      } catch { /* silencieux */ }
    }, 1500)
    return () => clearInterval(interval)
  }, [applyPolling])

  const sendMessage = useCallback(async (overrideMsg?: string) => {
    const msg = overrideMsg ?? input.trim()
    if (!msg || loading) return
    if (!overrideMsg) setInput('')

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }])
        if (!open) setUnreadDot(true)
      }
      if (data.extractedRules) {
        setExtractedRules(data.extractedRules)
        setRulesApplied(false)
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Une erreur est survenue, réessaie !' }])
    } finally {
      setLoading(false)
    }
  }, [messages, input, loading, open])

  const handleApplyRules = async () => {
    if (!extractedRules) return
    try {
      const saveRes = await fetch('/api/agent/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: extractedRules }),
      })
      if (!saveRes.ok) return
      const applyRes = await fetch('/api/emails/apply-rules', { method: 'POST' })
      if (applyRes.ok) {
        setApplyPolling(true)
        setApplyJob({ status: 'running', totalEmails: 0, processed: 0, reclassified: 0, relabeled: 0, errors: 0, lastError: null })
      }
    } catch { /* silencieux */ }
  }

  // Suggestions rapides
  const quickActions = [
    { label: '🔴 Urgents ?', msg: 'Quels sont mes emails les plus urgents en ce moment ?' },
    { label: '📰 Désabonnements', msg: 'Je reçois trop de newsletters. Quelles listes devrais-je quitter ? Donne-moi les expéditeurs principaux.' },
    { label: '🗂️ Règles auto', msg: 'Propose-moi des règles de tri automatiques adaptées à mes habitudes.' },
    { label: '📊 Bilan boîte', msg: 'Donne-moi un bilan de ma boîte mail : volume, tendances, problèmes détectés.' },
    { label: '🧹 Nettoyage', msg: 'Qu\'est-ce que je pourrais supprimer ou archiver pour nettoyer ma boîte mail ?' },
  ]

  const chatHeight = expanded ? 'h-[520px]' : 'h-[380px]'
  const chatWidth = expanded ? 'w-[480px]' : 'w-[380px]'

  // ── Bouton flottant ──────────────────────────────────────
  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Bulle teaser si non Pro */}
        {!isPro && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-2xl shadow-indigo-500/30 hover:scale-105 transition-transform animate-pulse-once"
          >
            <Crown className="w-4 h-4" />
            Agent IA — Plan Pro
          </button>
        )}

        <button
          onClick={() => isPro ? setOpen(true) : onUpgrade?.()}
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: isPro
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
            boxShadow: isPro ? '0 8px 32px rgba(99,102,241,0.5)' : '0 8px 24px rgba(0,0,0,0.4)',
          }}
          title={isPro ? 'Mon Agent IA' : 'Disponible sur Plan Pro'}
        >
          <Bot className="w-6 h-6 text-white" />
          {unreadDot && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#050507]" />
          )}
          {!isPro && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-[#050507] flex items-center justify-center">
              <Crown className="w-2.5 h-2.5 text-white" />
            </span>
          )}
        </button>
      </div>
    )
  }

  // ── Fenêtre de chat ──────────────────────────────────────
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${chatWidth} flex flex-col rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden transition-all duration-300`}
      style={{ background: '#0c0c10', boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.2)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)' }}
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0c0c10]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#f0f0f5]">Agent IA</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Pro
            </span>
          </div>
          <p className="text-[11px] text-[#5a5a66] truncate">Manager de boîte mail intelligent</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-[#5a5a66] hover:text-[#94949e] hover:bg-white/[0.05] transition-colors"
            title={expanded ? 'Réduire' : 'Agrandir'}
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-[#5a5a66] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className={`${chatHeight} overflow-y-auto p-3 space-y-3 transition-all duration-300`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a32 transparent' }}
      >
        {/* État vide : suggestions rapides */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#f0f0f5]">Votre manager de boîte mail</p>
              <p className="text-xs text-[#5a5a66] mt-1">J&apos;analyse vos emails et prends les décisions à votre place.</p>
            </div>
            <div className="w-full space-y-1.5">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.msg)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/30 hover:bg-violet-500/5 text-xs text-[#94949e] hover:text-[#f0f0f5] transition-all text-left"
                >
                  <span className="flex-1">{qa.label}</span>
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white/[0.04] border border-white/[0.06] text-[#d0d0d8] rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap text-[13px]">{m.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Règles extraites ── */}
      {extractedRules && (
        <div className="mx-3 mb-2 rounded-xl bg-violet-500/5 border border-violet-500/20 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-violet-300 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Règles détectées
            </span>
            {applyJob?.status === 'running' ? (
              <span className="text-[10px] text-blue-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {applyJob.processed}/{applyJob.totalEmails}
              </span>
            ) : rulesApplied ? (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Appliquées !
              </span>
            ) : (
              <button
                onClick={handleApplyRules}
                className="text-[10px] px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors font-semibold"
              >
                Appliquer
              </button>
            )}
          </div>

          {/* Barre de progression */}
          {applyJob?.status === 'running' && applyJob.totalEmails > 0 && (
            <div className="mb-1.5">
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((applyJob.processed / applyJob.totalEmails) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Résultat */}
          {applyJob?.status === 'completed' && (
            <div className="flex gap-2 text-center mt-1">
              <div className="flex-1 text-[10px]"><span className="font-bold text-violet-400">{applyJob.reclassified}</span> reclassifiés</div>
              <div className="flex-1 text-[10px]"><span className="font-bold text-emerald-400">{applyJob.relabeled}</span> déplacés</div>
            </div>
          )}

          {/* Erreur */}
          {applyJob?.status === 'error' && (
            <div className="flex items-center gap-1 text-[10px] text-red-400">
              <AlertCircle className="w-3 h-3" />
              {applyJob.lastError ?? 'Erreur'}
            </div>
          )}

          <details className="mt-1">
            <summary className="text-[10px] text-[#5a5a66] cursor-pointer hover:text-[#94949e]">Voir les règles</summary>
            <pre className="text-[10px] text-[#b0b0b8] bg-[#050507] rounded-lg p-2 mt-1 whitespace-pre-wrap font-mono border border-white/[0.06]">
              {extractedRules}
            </pre>
          </details>
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-3 pb-3">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage() }}
          className="flex items-center gap-2 bg-[#050507] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-violet-500/40 transition-colors"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ex : trop de newsletters, aide-moi…"
            className="flex-1 bg-transparent text-sm text-[#f0f0f5] placeholder-[#3d3d44] outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white transition-colors flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Quick actions (après premier message) */}
        {messages.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {quickActions.slice(0, 3).map((qa) => (
              <button
                key={qa.label}
                onClick={() => sendMessage(qa.msg)}
                disabled={loading}
                className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[#5a5a66] hover:text-violet-300 hover:border-violet-500/30 transition-colors disabled:opacity-30"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

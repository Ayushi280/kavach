import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radar, AlertTriangle, ShieldCheck, Languages as LangIcon,
  Loader2, Phone, RefreshCw, Landmark, UserX, Flame, Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { checkMessage, LANGUAGE_NAMES, requestLocation, TACTIC_META } from '@/lib/api'
import { cn } from '@/lib/utils'

const TACTIC_ICONS = {
  authority: Landmark,
  isolation: UserX,
  fear: Flame,
  money_demand: Banknote,
}

const EXAMPLES = [
  {
    label: 'Digital Arrest (Hindi)',
    tone: 'red',
    text: 'नमस्ते, मैं मुंबई सीबीआई से बोल रहा हूं। आपके आधार कार्ड से एक पार्सल पकड़ा गया है। आप पर वारंट है, तुरंत गिरफ्तार किया जाएगा। किसी को मत बताना, अभी पैसे transfer करो।',
  },
  {
    label: 'Fake Police (Tamil)',
    tone: 'red',
    text: 'நான் சிபிஐ காவல் அதிகாரி. உங்கள் கணக்கில் சட்டவிரோத பரிமாற்றம். உடனே பணம் அனுப்புங்கள், இல்லையேல் கைது. யாரிடமும் கூறாதீர்கள்.',
  },
  {
    label: 'KYC Freeze (Hinglish)',
    tone: 'red',
    text: 'Sir aapka account 24 hours mein suspended ho jayega. RBI rule ke according abhi OTP aur payment bhejo warna block. Kisi ko mat batana, urgent hai.',
  },
  {
    label: 'Genuine bank SMS',
    tone: 'green',
    text: 'Dear Customer, INR 2,450.00 debited from A/c XX3421 on 04-Jul at Big Basket via UPI. Available bal INR 18,220.55. — HDFC Bank',
  },
  {
    label: 'Family message',
    tone: 'green',
    text: 'Beta, aaj shaam ko ghar jaldi aana. Papa ki tabiyat theek nahi hai, doctor ke paas jaana hai.',
  },
]

const ADVICE_SCAM = [
  'Do not pay. Do not share OTP or Aadhaar.',
  'Hang up. Real police never arrest over video call.',
  'Report immediately at 1930 or cybercrime.gov.in.',
  'Warn one family member before doing anything else.',
]
const ADVICE_SAFE = [
  'No scam markers detected in this message.',
  'If something still feels off, verify by calling the sender on a known number.',
  'Never share OTPs, even with people who sound official.',
]

export default function Detector() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { requestLocation() }, [])

  async function handleAnalyze() {
    if (!text.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await checkMessage(text.trim())
      setTimeout(() => {
        setResult(r)
        setLoading(false)
      }, 350)
    } catch (e) {
      setError('Detector unreachable. Is the backend running?')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <Radar size={12} /> Live Scam Detector
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Paste a message. Get a verdict.
        </h1>
        <p className="mt-2 text-ink-muted max-w-2xl">
          The model decomposes the message into manipulation tactics — authority,
          isolation, fear, money demand — and scores how far the scam has progressed.
        </p>
      </div>

      {/* Input */}
      <div className="card p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <label htmlFor="msg" className="eyebrow">Suspicious message</label>
          {text && (
            <button
              onClick={() => { setText(''); setResult(null); setError(null) }}
              className="text-xs text-ink-muted hover:text-ink flex items-center gap-1"
            >
              <RefreshCw size={12} /> Clear
            </button>
          )}
        </div>
        <textarea
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a suspicious message or call transcript…"
          rows={6}
          className={cn(
            'w-full bg-bg-deep/60 border border-border rounded-xl p-4',
            'text-ink placeholder:text-ink-dim resize-y text-[15px]',
            'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/40',
          )}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAnalyze() }}
        />
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-ink-muted">
            <span className="font-mono">{text.length}</span> chars · ⌘ + Enter to analyze
          </div>
          <Button variant="cyan" onClick={handleAnalyze} disabled={!text.trim() || loading}>
            {loading
              ? (<><Loader2 size={16} className="animate-spin" /> Analyzing…</>)
              : (<><Radar size={16} /> Analyze</>)}
          </Button>
        </div>
      </div>

      {/* Examples */}
      <div className="mt-6">
        <div className="eyebrow mb-3">Try an example</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => { setText(ex.text); setResult(null); setError(null) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs border transition-all hover:-translate-y-px',
                ex.tone === 'red'
                  ? 'border-threat/30 bg-threat/5 text-threat hover:bg-threat/10'
                  : 'border-safe/30 bg-safe/5 text-safe hover:bg-safe/10',
              )}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="mt-8">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card p-6 flex items-center gap-3 text-ink-muted"
            >
              <Loader2 size={16} className="animate-spin text-accent-cyan" />
              <span className="text-sm">Classifying · decomposing tactics · scoring progression</span>
            </motion.div>
          )}

          {error && !loading && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card p-5 border-warn/30 text-warn">
              {error}
            </motion.div>
          )}

          {result && !loading && <ResultCard key={result.verdict + result.confidence} result={result} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ResultCard({ result }) {
  const isScam = result.verdict === 'scam'
  const pct = Math.round((result.confidence || 0) * 100)
  const progression = Math.round(result.progression || 0)
  const advice = isScam ? ADVICE_SCAM : ADVICE_SAFE
  const langName = result.language ? (LANGUAGE_NAMES[result.language] || result.language.toUpperCase()) : null
  const tactics = result.tactics || {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'card p-6 md:p-7 relative overflow-hidden',
        isScam ? 'shadow-glow-threat border-threat/40' : 'shadow-glow-safe border-safe/40',
      )}
    >
      <div className={cn(
        'absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl',
        isScam ? 'bg-threat/20' : 'bg-safe/20',
      )} />

      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-4 flex-1 min-w-[240px]">
          <div className={cn(
            'h-14 w-14 rounded-xl flex items-center justify-center border',
            isScam ? 'bg-threat/15 border-threat/40 text-threat' : 'bg-safe/15 border-safe/40 text-safe',
          )}>
            {isScam ? <AlertTriangle size={26} /> : <ShieldCheck size={26} />}
          </div>
          <div>
            <div className="eyebrow mb-1">Verdict</div>
            <div className={cn('text-4xl md:text-5xl font-bold tracking-tight', isScam ? 'text-threat' : 'text-safe')}>
              {isScam ? 'SCAM' : 'SAFE'}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge tone={isScam ? 'red' : 'green'}>
                <span className="font-mono tabular">{pct}%</span> confidence
              </Badge>
              {langName && (
                <Badge tone="cyan"><LangIcon size={11} /> Detected: {langName}</Badge>
              )}
              {result.risk_window_opened && (
                <Badge tone="amber">⚡ Payment breaker armed</Badge>
              )}
              {isScam && <Badge tone="amber"><Phone size={11} /> Report to 1930</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tactic Decomposition — the signature visual ── */}
      <div className="relative mt-6 pt-6 border-t border-border">
        <div className="eyebrow mb-3">Tactic decomposition</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TACTIC_META.map((t, idx) => {
            const active = !!tactics[t.key]
            const Icon = TACTIC_ICONS[t.key]
            return (
              <motion.div
                key={t.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.08 }}
                className={cn(
                  'p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all',
                  active
                    ? 'bg-threat/10 border-threat/50 shadow-glow-threat'
                    : 'bg-surface/30 border-border opacity-50',
                )}
              >
                <Icon size={20} className={active ? 'text-threat' : 'text-ink-dim'} />
                <span className={cn('text-[11px] font-medium', active ? 'text-threat' : 'text-ink-muted')}>
                  {t.label}
                </span>
                <span className={cn(
                  'text-[9px] font-bold tracking-widest uppercase',
                  active ? 'text-threat' : 'text-ink-dim',
                )}>
                  {active ? 'ACTIVE' : 'off'}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Progression meter */}
        <div className="mt-5">
          <div className="flex justify-between items-baseline mb-2">
            <span className="eyebrow">Scam progression</span>
            <span className={cn(
              'font-mono tabular font-bold',
              progression >= 75 ? 'text-threat' : progression >= 50 ? 'text-warn' : 'text-ink-muted',
            )}>
              {progression}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progression}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                progression >= 75
                  ? 'bg-gradient-to-r from-warn to-threat'
                  : progression >= 50
                    ? 'bg-warn'
                    : 'bg-accent-cyan',
              )}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-mono text-ink-dim">
            <span>contact</span><span>trust-building</span><span>pressure</span><span>extraction</span>
          </div>
        </div>
      </div>

      {/* Advice */}
      <div className="relative mt-6 pt-6 border-t border-border">
        <div className="eyebrow mb-3">{isScam ? 'What to do right now' : 'Notes'}</div>
        <ul className="space-y-2">
          {advice.map((line, i) => (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className="flex gap-3 text-sm"
            >
              <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', isScam ? 'bg-threat' : 'bg-safe')} />
              <span className="text-ink">{line}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

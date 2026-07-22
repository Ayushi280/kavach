import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PhoneIncoming, Play, RotateCcw, AlertTriangle, PhoneCall,
  Loader2, CheckCircle2, Landmark, UserX, Flame, Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { checkMessage, familyAlert, guardianVoice, TACTIC_META } from '@/lib/api'
import { cn } from '@/lib/utils'

const TACTIC_ICONS = { authority: Landmark, isolation: UserX, fear: Flame, money_demand: Banknote }

// The scripted scam call — each line gets run through /check live
const CALL_SCRIPT = [
  { speaker: 'caller', text: 'Hello, main Mumbai CBI se Inspector Sharma bol raha hoon.' },
  { speaker: 'victim', text: 'CBI? Kya hua sir?' },
  { speaker: 'caller', text: 'Aapke Aadhaar se ek parcel pakda gaya hai jisme drugs hai. Aap par warrant hai, arrest hoga.' },
  { speaker: 'victim', text: 'Nahi sir, maine kuch nahi kiya!' },
  { speaker: 'caller', text: 'Chup raho. Video call par raho, kisi ko mat batana. Akele kamre me jao abhi.' },
  { speaker: 'caller', text: 'Case band karne ke liye turant ₹50,000 transfer karo is account me, warna jail.' },
]

export default function VictimFlow() {
  const [lines, setLines] = useState([])         // lines shown so far
  const [running, setRunning] = useState(false)
  const [tactics, setTactics] = useState({})     // accumulated tactic state
  const [progression, setProgression] = useState(0)
  const [scamConfirmed, setScamConfirmed] = useState(false)
  const [activeTactics, setActiveTactics] = useState([])
  const [confidence, setConfidence] = useState(0)
  const [familySent, setFamilySent] = useState(false)
  const [familySending, setFamilySending] = useState(false)
  const audioRef = useRef(null)
  const cancelRef = useRef(false)
  const scrollRef = useRef(null)
  const voicePlayedRef = useRef(false)

  // Auto-play Guardian Voice the moment scam is confirmed — no button needed
  useEffect(() => {
    if (!scamConfirmed || voicePlayedRef.current) return
    voicePlayedRef.current = true
    guardianVoice({ language: 'hi', tactics: { money_demand: true } }).then((url) => {
      if (url) {
        const audio = new Audio(url)
        audioRef.current = audio
        audio.play().catch(() => {})
      }
      // mock mode: guardianVoice already triggered browser speech synthesis
    }).catch(() => {})
  }, [scamConfirmed])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines])

  async function startCall() {
    // reset
    cancelRef.current = false
    setLines([])
    setTactics({})
    setProgression(0)
    setScamConfirmed(false)
    setActiveTactics([])
    setFamilySent(false)
    setRunning(true)

    let transcript = ''
    for (const line of CALL_SCRIPT) {
      if (cancelRef.current) return
      await new Promise((r) => setTimeout(r, 1400))
      if (cancelRef.current) return
      setLines((prev) => [...prev, line])

      // Only analyze what the CALLER says, accumulated
      if (line.speaker === 'caller') {
        transcript += ' ' + line.text
        try {
          const r = await checkMessage(transcript.trim())
          if (cancelRef.current) return
          setTactics((prev) => {
            // tactics only accumulate — once lit, stay lit
            const merged = { ...prev }
            Object.keys(r.tactics || {}).forEach((k) => { if (r.tactics[k]) merged[k] = true })
            return merged
          })
          setProgression((p) => Math.max(p, Math.round(r.progression || 0)))
          setActiveTactics(r.active_tactics || [])
          setConfidence(r.confidence || 0)
          if (r.is_scam || r.verdict === 'scam') {
            setScamConfirmed(true)
          }
        } catch { /* backend offline — script continues visually */ }
      }
    }
    setRunning(false)
  }

  function reset() {
    cancelRef.current = true
    setRunning(false)
    setLines([])
    setTactics({})
    setProgression(0)
    setScamConfirmed(false)
    setFamilySent(false)
    voicePlayedRef.current = false
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }

  async function handleCallFamily() {
    if (familySending || familySent) return
    setFamilySending(true)
    try {
      const r = await familyAlert({ activeTactics, confidence })
      if (r?.sent) setFamilySent(true)
    } catch { /* ignore */ }
    setFamilySending(false)
  }


  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <PhoneIncoming size={12} /> Victim Protection Flow
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Watch Kavach catch a scam — live.
        </h1>
        <p className="mt-2 text-ink-muted max-w-2xl">
          A simulated digital-arrest call plays out on the phone. Every caller line is
          run through the real detection model — watch the tactics light up and the
          progression climb until Kavach steps in.
        </p>
      </div>

      <div className="grid lg:grid-cols-[auto,1fr] gap-10 items-start">
        {/* Phone frame */}
        <div className="flex justify-center">
          <div className="relative w-[300px] h-[610px] rounded-[42px] bg-[#0B0F1A] border-[6px] border-[#1A2338] shadow-2xl overflow-hidden">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-24 rounded-full bg-black z-20" />
            <div className="absolute top-0 inset-x-0 h-10 flex items-center justify-between px-6 text-[10px] text-ink-muted font-mono z-10">
              <span>21:47</span><span>5G · 82%</span>
            </div>

            {/* Call screen */}
            <div className="absolute inset-0 pt-12 pb-4 px-4 flex flex-col">
              <div className="text-center mb-3">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted">
                  {running ? 'Call in progress' : 'Incoming call'}
                </div>
                <div className="text-lg font-semibold text-ink mt-1">Unknown number</div>
                <div className="text-[11px] text-ink-muted font-mono">+91-98432-XXX-21</div>
              </div>

              {/* Transcript */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
                <AnimatePresence initial={false}>
                  {lines.map((l, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'max-w-[90%] rounded-xl p-2.5 text-[12px] leading-snug',
                        l.speaker === 'caller'
                          ? 'mr-auto bg-threat/10 border border-threat/30 text-ink'
                          : 'ml-auto bg-surface border border-border text-ink-muted',
                      )}
                    >
                      {l.text}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {lines.length === 0 && !running && (
                  <div className="h-full flex items-center justify-center text-[11px] text-ink-dim text-center px-6">
                    Press "Play the call" to start the simulation
                  </div>
                )}
              </div>

              {/* Full-screen scam warning overlay */}
              <AnimatePresence>
                {scamConfirmed && !running && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-30 bg-bg-deep/95 backdrop-blur flex flex-col items-center justify-center p-6 text-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ repeat: Infinity, duration: 1.6 }}
                      className="h-16 w-16 rounded-2xl bg-threat/20 border border-threat/50 flex items-center justify-center mb-4 shadow-glow-threat"
                    >
                      <AlertTriangle size={30} className="text-threat" />
                    </motion.div>
                    <div className="text-lg font-bold text-threat mb-1">SCAM CALL DETECTED</div>
                    <div className="text-[11px] text-ink-muted mb-5 leading-relaxed">
                      Digital-arrest pattern · {Math.round(confidence * 100)}% confidence.
                      Do not pay. Do not stay alone on this call.
                    </div>
                    <div className="w-full space-y-2">
                      <button
                        onClick={handleCallFamily}
                        disabled={familySending || familySent}
                        className={cn(
                          'w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2',
                          familySent ? 'bg-safe/20 text-safe border border-safe/40' : 'bg-safe text-white',
                        )}
                      >
                        {familySending
                          ? <Loader2 size={15} className="animate-spin" />
                          : familySent
                            ? (<><CheckCircle2 size={15} /> Family alerted</>)
                            : (<><PhoneCall size={15} /> Call My Family</>)}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right: live analysis panel */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="cyan" onClick={startCall} disabled={running}>
              {running
                ? (<><Loader2 size={15} className="animate-spin" /> Call running…</>)
                : (<><Play size={15} /> Play the call</>)}
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={15} /> Reset
            </Button>
          </div>

          {/* Tactic chips */}
          <div className="card p-5">
            <div className="eyebrow mb-3">Tactics detected (live)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TACTIC_META.map((t) => {
                const active = !!tactics[t.key]
                const Icon = TACTIC_ICONS[t.key]
                return (
                  <div
                    key={t.key}
                    className={cn(
                      'p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all duration-500',
                      active
                        ? 'bg-threat/10 border-threat/50 shadow-glow-threat'
                        : 'bg-surface/30 border-border opacity-50',
                    )}
                  >
                    <Icon size={18} className={active ? 'text-threat' : 'text-ink-dim'} />
                    <span className={cn('text-[10px] font-medium', active ? 'text-threat' : 'text-ink-muted')}>
                      {t.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Progression */}
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
                  animate={{ width: `${progression}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={cn(
                    'h-full rounded-full',
                    progression >= 75 ? 'bg-gradient-to-r from-warn to-threat'
                      : progression >= 50 ? 'bg-warn' : 'bg-accent-cyan',
                  )}
                />
              </div>
            </div>
          </div>

          {/* Status card */}
          <div className={cn(
            'card p-5 transition-all',
            scamConfirmed && 'border-threat/40 shadow-glow-threat',
          )}>
            <div className="eyebrow mb-2">Kavach status</div>
            {scamConfirmed ? (
              <div className="flex items-center gap-2 text-threat font-semibold text-sm">
                <AlertTriangle size={16} /> Scam confirmed — victim warned, breaker armed
              </div>
            ) : running ? (
              <div className="flex items-center gap-2 text-warn text-sm">
                <Loader2 size={14} className="animate-spin" /> Monitoring the call…
              </div>
            ) : (
              <div className="text-ink-muted text-sm">Idle — start the call to begin.</div>
            )}
            {activeTactics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activeTactics.map((t) => <Badge key={t} tone="red">{t}</Badge>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

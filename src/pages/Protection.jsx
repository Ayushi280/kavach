import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, ShieldCheck, AlertTriangle, PhoneCall,
  Loader2, CheckCircle2, Volume2, Landmark, UserX, Flame, Banknote, CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { familyAlert, guardianVoice, detectLanguage, TACTIC_META } from '@/lib/api'
import { cn } from '@/lib/utils'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
const DEMO_USER = 'demo_victim'
const CHUNK_MS = 12000  // 12s chunks: long enough for a full UPI/account number
                        // to land inside ONE chunk (so passive capture works), and
                        // longer audio also transcribes + language-detects more
                        // accurately. Trade-off: the scam warning can be up to ~12s
                        // behind - acceptable for a demo, tune down for faster alerts.

const TACTIC_ICONS = { authority: Landmark, isolation: UserX, fear: Flame, money_demand: Banknote }

export default function Protection() {
  const [status, setStatus] = useState('idle')    // idle | listening | scam | safe
  const [result, setResult] = useState(null)
  const [tactics, setTactics] = useState({})
  const [progression, setProgression] = useState(0)
  const [activeTactics, setActiveTactics] = useState([])
  const [confidence, setConfidence] = useState(0)
  const [familySent, setFamilySent] = useState(false)
  const [familySending, setFamilySending] = useState(false)
  const [chunks, setChunks] = useState(0)
  const [captured, setCaptured] = useState({ upi_ids: [], account_numbers: [] })
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunkTimerRef = useRef(null)
  const lastPositionRef = useRef(null)
  const voiceFiredRef = useRef(false)

  // Watch GPS in background once page loads
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  function sendChunk(blob) {
    const form = new FormData()
    form.append('file', blob, 'chunk.webm')
    form.append('log_to_dashboard', 'true')
    const pos = lastPositionRef.current
    if (pos) {
      form.append('latitude', String(pos.lat))
      form.append('longitude', String(pos.lng))
    }

    fetch(`${API}/check-audio?user_id=${DEMO_USER}`, { method: 'POST', body: form })
      .then((r) => r.json())
      .then((r) => {
        setChunks((c) => c + 1)
        setResult(r)
        // Accumulate any mule-account details captured from the scammer's
        // own words this chunk - deduped, so they persist on screen as the
        // call goes on and feed the live Cyber Cell graph.
        if (r.extracted_payment_details) {
          setCaptured((prev) => ({
            upi_ids: [...new Set([...prev.upi_ids, ...(r.extracted_payment_details.upi_ids || [])])],
            account_numbers: [...new Set([...prev.account_numbers, ...(r.extracted_payment_details.account_numbers || [])])],
          }))
        }
        // Accumulate tactics — once lit, stay lit
        if (r.tactics) {
          setTactics((prev) => {
            const merged = { ...prev }
            Object.keys(r.tactics).forEach((k) => { if (r.tactics[k]) merged[k] = true })
            return merged
          })
        }
        if (r.progression) setProgression((p) => Math.max(p, Math.round(r.progression)))
        if (r.active_tactics) setActiveTactics(r.active_tactics)
        if (r.confidence) setConfidence(r.confidence)
        if (r.is_scam || r.verdict === 'scam') {
          setStatus('scam')
          // Auto-fire guardian voice once
          if (!voiceFiredRef.current) {
            voiceFiredRef.current = true
            // Derive the warning language from the transcript's SCRIPT (deterministic)
            // rather than Whisper's flaky per-chunk language guess. Devanagari
            // in the transcript => Hindi voice, etc. Falls back to backend value.
            const voiceLang = detectLanguage(r.transcript || '') || r.language || 'hi'
            guardianVoice({ language: voiceLang, tactics: r.tactics || { money_demand: true } })
              .then((url) => { if (url) new Audio(url).play().catch(() => {}) })
              .catch(() => {})
          }
        } else {
          setStatus('safe')
        }
      })
      .catch(() => { setChunks((c) => c + 1) })
  }

  async function startProtection() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      voiceFiredRef.current = false

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) sendChunk(e.data) }

      mr.start()
      setStatus('listening')
      setTactics({})
      setProgression(0)
      setActiveTactics([])
      setFamilySent(false)
      setChunks(0)
      setResult(null)
      setCaptured({ upi_ids: [], account_numbers: [] })

      chunkTimerRef.current = setInterval(() => {
        if (mr.state === 'recording') {
          mr.stop()
          mr.start()
        }
      }, CHUNK_MS)
    } catch (err) {
      alert('Microphone access denied. Please grant mic permission in your browser settings and try again.')
    }
  }

  function stopProtection() {
    clearInterval(chunkTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    setStatus('idle')
  }

  async function handleCallFamily() {
    if (familySending || familySent) return
    setFamilySending(true)
    try {
      const r = await familyAlert({ activeTactics, confidence })
      if (r?.sent) setFamilySent(true)
    } catch {}
    setFamilySending(false)
  }

  const isListening = status === 'listening' || status === 'scam' || status === 'safe'

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 lg:py-14">
      <div className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <Mic size={12} /> Live Protection
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Put the call on speaker.
        </h1>
        <p className="mt-2 text-ink-muted max-w-xl">
          Kavach listens through your mic in 5-second chunks, sends each to the AI,
          and fires an alert the moment it detects a scam — automatically.
          Works in Chrome on any Android or desktop with a mic.
        </p>
      </div>

      {/* Big central button */}
      <div className="flex flex-col items-center gap-6 py-10">
        <motion.button
          onClick={isListening ? stopProtection : startProtection}
          className={cn(
            'relative h-40 w-40 rounded-full flex flex-col items-center justify-center gap-3',
            'border-4 transition-all duration-300 font-semibold text-sm',
            status === 'scam'
              ? 'bg-threat/20 border-threat text-threat shadow-glow-threat'
              : status === 'listening' || status === 'safe'
                ? 'bg-safe/10 border-safe text-safe shadow-glow-safe'
                : 'bg-surface border-border-bright text-ink hover:border-accent-cyan',
          )}
          whileTap={{ scale: 0.96 }}
        >
          {/* Pulse ring when listening */}
          {isListening && (
            <span className={cn(
              'absolute inset-0 rounded-full border-4 animate-ping opacity-30',
              status === 'scam' ? 'border-threat' : 'border-safe',
            )} />
          )}
          {status === 'scam'
            ? <AlertTriangle size={40} />
            : isListening
              ? <Mic size={40} />
              : <MicOff size={40} />}
          <span className="text-xs font-bold tracking-widest uppercase">
            {status === 'scam'
              ? 'SCAM!'
              : status === 'listening' || status === 'safe'
                ? 'Stop'
                : 'Start Protection'}
          </span>
        </motion.button>

        {isListening && (
          <div className="text-xs text-ink-muted flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse-dot" />
            Listening · chunk {chunks} analyzed
          </div>
        )}
      </div>

      {/* Tactic chips */}
      {isListening && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 mb-4"
        >
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
                'font-mono tabular font-bold text-sm',
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
        </motion.div>
      )}

      {/* Evidence captured live from the scammer's own words */}
      {isListening && (captured.upi_ids.length > 0 || captured.account_numbers.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 mb-4 border-accent-cyan/30"
        >
          <div className="eyebrow mb-3 flex items-center gap-2">
            <CreditCard size={12} className="text-accent-cyan" /> Evidence captured (sent to Cyber Cell)
          </div>
          {captured.upi_ids.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] text-ink-muted mb-1.5">UPI IDs the caller demanded</div>
              <div className="flex flex-wrap gap-2">
                {captured.upi_ids.map((u) => (
                  <span key={u} className="px-2.5 py-1 rounded-md bg-threat/10 border border-threat/30 text-threat font-mono text-[11px]">
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {captured.account_numbers.length > 0 && (
            <div>
              <div className="text-[11px] text-ink-muted mb-1.5">Account numbers the caller demanded</div>
              <div className="flex flex-wrap gap-2">
                {captured.account_numbers.map((a) => (
                  <span key={a} className="px-2.5 py-1 rounded-md bg-warn/10 border border-warn/30 text-warn font-mono text-[11px]">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Full-screen scam overlay */}
      <AnimatePresence>
        {status === 'scam' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="card p-8 max-w-sm w-full border-threat/50 shadow-glow-threat text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="h-20 w-20 rounded-2xl bg-threat/20 border border-threat/50 flex items-center justify-center mx-auto mb-5 shadow-glow-threat"
              >
                <AlertTriangle size={38} className="text-threat" />
              </motion.div>

              <div className="text-2xl font-bold text-threat mb-2">SCAM CALL DETECTED</div>
              <div className="text-sm text-ink-muted mb-1">
                {Math.round(confidence * 100)}% confidence
              </div>
              <div className="text-xs text-ink-muted mb-5 leading-relaxed">
                Digital-arrest pattern detected. Do not pay. Do not stay alone on this call.
              </div>

              {activeTactics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center mb-5">
                  {activeTactics.map((t) => <Badge key={t} tone="red">{t}</Badge>)}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  variant="cyan"
                  size="lg"
                  className="w-full"
                  onClick={handleCallFamily}
                  disabled={familySending || familySent}
                >
                  {familySending
                    ? <><Loader2 size={16} className="animate-spin" /> Sending alert…</>
                    : familySent
                      ? <><CheckCircle2 size={16} /> Family alerted ✓</>
                      : <><PhoneCall size={16} /> Alert My Family</>}
                </Button>
                <Button variant="danger" size="lg" className="w-full" onClick={stopProtection}>
                  Stop & Dismiss
                </Button>
              </div>

              <div className="mt-4 text-[11px] text-ink-muted">
                🔊 Guardian Voice warning has been played automatically
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info box */}
      <div className="card p-5 mt-6">
        <div className="eyebrow mb-3">How it works</div>
        <div className="space-y-2 text-sm text-ink-muted">
          <p>1. Put your scam call on <span className="text-ink">speakerphone</span>.</p>
          <p>2. Tap <span className="text-ink">Start Protection</span> and grant mic access.</p>
          <p>3. Kavach records in 5-second chunks and sends each to the AI model.</p>
          <p>4. The moment a scam is detected, a warning fires automatically — no tap needed.</p>
        </div>
        <div className="mt-4 pt-4 border-t border-border text-[11px] text-ink-muted">
          Requires HTTPS (Vercel deploy) or localhost for mic access. Audio is never stored.
        </div>
      </div>
    </div>
  )
}

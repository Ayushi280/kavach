import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IndianRupee, ShieldAlert, AlertTriangle, Loader2,
  CheckCircle2, XCircle, Clock, User, UserPlus, PhoneCall, ShieldOff,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { paymentIntent, riskStatus, clearRisk, familyAlert } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Payment() {
  const [amount, setAmount] = useState('')
  const [payee, setPayee] = useState('unknown@upi')
  const [newPayee, setNewPayee] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [phase, setPhase] = useState('form') // form | warn | hold | success | cancelled
  const [risk, setRisk] = useState({ at_risk: false })

  // Poll the real risk window — armed by running a scam through the Detector
  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const r = await riskStatus()
        if (!cancelled) setRisk(r || { at_risk: false })
      } catch { /* backend offline — ignore */ }
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => { cancelled = true; clearInterval(t) }
  }, [phase])

  async function handlePay() {
    const amt = Number(amount)
    if (!amt || amt <= 0 || loading) return
    setLoading(true)
    try {
      const r = await paymentIntent({ amount: amt, payee, newPayee })
      setResult(r)
      if (r.decision === 'ALLOW') setPhase('success')
      else if (r.decision === 'WARN') setPhase('warn')
      else if (r.decision === 'HOLD') setPhase('hold')
    } catch {
      setResult({ decision: 'ALLOW', reason: 'Backend unreachable — payment simulated.', amount: amt })
      setPhase('success')
    }
    setLoading(false)
  }

  async function handleClearRisk() {
    await clearRisk()
    setRisk({ at_risk: false })
  }

  function reset() {
    setPhase('form')
    setResult(null)
    setAmount('')
  }

  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <IndianRupee size={12} /> Payment Circuit Breaker
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Protected payments.</h1>
        <p className="mt-2 text-ink-muted max-w-xl">
          Detecting a scam in the Live Detector arms this circuit breaker — risky
          payments during the window are held automatically. No toggles, all real.
        </p>
        <p className="mt-2 text-xs text-ink-muted/80 max-w-xl italic">
          Concept: a bank / NPCI-level fraud hook. In production this decision engine
          plugs in where UPI already shows fraud warnings — Kavach can't reach inside
          GPay/PhonePe itself, and we don't claim to.
        </p>
      </div>

      {/* Live risk-window banner */}
      <AnimatePresence>
        {risk.at_risk && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card p-4 mb-6 border-threat/40 shadow-glow-threat flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="relative h-2 w-2 flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-threat animate-pulse-dot" />
                <span className="absolute inset-0 rounded-full bg-threat" />
              </span>
              <div>
                <div className="text-sm font-semibold text-threat">Scam-risk window ACTIVE</div>
                <div className="text-[11px] text-ink-muted">
                  {risk.active_tactics?.join(' · ')}
                  {risk.seconds_left ? ` · ${Math.floor(risk.seconds_left / 60)}m left` : ''}
                </div>
              </div>
            </div>
            <button
              onClick={handleClearRisk}
              className="text-xs text-ink-muted hover:text-ink flex items-center gap-1 border border-border rounded-lg px-2.5 py-1.5"
            >
              <ShieldOff size={12} /> Clear (demo reset)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment form */}
      {phase === 'form' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="eyebrow mb-4">New UPI payment</div>

          <label className="block text-sm text-ink-muted mb-2" htmlFor="amt">Amount (₹)</label>
          <input
            id="amt" type="number" min="1" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50000"
            className={cn(
              'w-full bg-bg-deep/60 border border-border rounded-xl p-4 mb-4',
              'text-ink placeholder:text-ink-dim text-lg font-mono',
              'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/40',
            )}
          />

          <label className="block text-sm text-ink-muted mb-2" htmlFor="payee">Payee UPI ID</label>
          <input
            id="payee" type="text" value={payee}
            onChange={(e) => setPayee(e.target.value)}
            className={cn(
              'w-full bg-bg-deep/60 border border-border rounded-xl p-4 mb-4',
              'text-ink placeholder:text-ink-dim font-mono',
              'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/40',
            )}
          />

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setNewPayee(false)}
              className={cn(
                'flex-1 p-3 rounded-xl border text-sm flex items-center justify-center gap-2 transition-colors',
                !newPayee ? 'bg-accent-blue/10 border-accent-blue/40 text-ink' : 'bg-surface/30 border-border text-ink-muted',
              )}
            >
              <User size={15} /> Saved payee
            </button>
            <button
              onClick={() => setNewPayee(true)}
              className={cn(
                'flex-1 p-3 rounded-xl border text-sm flex items-center justify-center gap-2 transition-colors',
                newPayee ? 'bg-warn/10 border-warn/40 text-ink' : 'bg-surface/30 border-border text-ink-muted',
              )}
            >
              <UserPlus size={15} /> New payee
            </button>
          </div>

          <Button variant="cyan" size="lg" className="w-full" onClick={handlePay} disabled={!amount || loading}>
            {loading
              ? (<><Loader2 size={18} className="animate-spin" /> Checking with Kavach…</>)
              : (<>Pay ₹{amount || '0'}</>)}
          </Button>

          <div className="mt-4 text-[11px] text-ink-muted text-center">
            Demo flow: run a scam message through the <span className="text-accent-cyan">Live Detector</span> first,
            then try paying ₹50,000 here — the breaker will hold it.
          </div>
        </motion.div>
      )}

      {/* ALLOW */}
      {phase === 'success' && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="card p-8 border-safe/40 shadow-glow-safe text-center">
          <CheckCircle2 size={48} className="text-safe mx-auto mb-4" />
          <div className="text-2xl font-bold text-safe mb-1">Payment sent</div>
          <div className="text-ink-muted text-sm mb-6">
            ₹{Number(result?.amount || amount).toLocaleString('en-IN')} — {result?.reason || 'no risk detected.'}
          </div>
          <Button variant="ghost" onClick={reset}>Make another payment</Button>
        </motion.div>
      )}

      {/* CANCELLED */}
      {phase === 'cancelled' && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="card p-8 text-center">
          <XCircle size={48} className="text-ink-muted mx-auto mb-4" />
          <div className="text-2xl font-bold mb-1">Payment cancelled</div>
          <div className="text-ink-muted text-sm mb-6">
            Good call. If someone pressured you into this payment, report it at 1930.
          </div>
          <Button variant="ghost" onClick={reset}>Back to payments</Button>
        </motion.div>
      )}

      {/* WARN dialog */}
      <AnimatePresence>
        {phase === 'warn' && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="card p-6 max-w-md w-full border-warn/40"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-warn/15 border border-warn/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-warn" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Are you sure?</div>
                  <div className="text-xs text-ink-muted">₹{Number(result.amount).toLocaleString('en-IN')} · Kavach check</div>
                </div>
              </div>
              <p className="text-sm text-ink leading-relaxed mb-3">{result.reason}</p>
              {result.active_tactics?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.active_tactics.map((t) => <Badge key={t} tone="amber">{t}</Badge>)}
                </div>
              )}
              <p className="text-xs text-ink-muted leading-relaxed mb-6 p-3 rounded-lg bg-surface/50 border border-border">
                {result.advice}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={() => setPhase('cancelled')}>Cancel</Button>
                <Button variant="cyan" onClick={() => setPhase('success')}>Yes, proceed</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HOLD overlay */}
      <AnimatePresence>
        {phase === 'hold' && result && (
          <HoldOverlay
            result={result}
            onCancel={() => setPhase('cancelled')}
            onProceed={() => setPhase('success')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function HoldOverlay({ result, onCancel, onProceed }) {
  const total = result.cooldown_sec ?? result.cooldown_seconds ?? 30
  const [left, setLeft] = useState(total)
  const [familySent, setFamilySent] = useState(false)
  const [familySending, setFamilySending] = useState(false)

  useEffect(() => {
    if (left <= 0) return undefined
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  async function handleCallFamily() {
    if (familySending || familySent) return
    setFamilySending(true)
    try {
      const r = await familyAlert({
        activeTactics: result.active_tactics || [],
        confidence: 0.98,
      })
      if (r?.sent) setFamilySent(true)
    } catch { /* ignore */ }
    setFamilySending(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="card p-8 max-w-md w-full border-threat/50 shadow-glow-threat text-center">
        <ShieldAlert size={48} className="text-threat mx-auto mb-4" />
        <div className="text-2xl font-bold text-threat mb-2">Payment paused</div>
        <p className="text-sm text-ink leading-relaxed mb-4">{result.reason}</p>

        {result.active_tactics?.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {result.active_tactics.map((t) => <Badge key={t} tone="red">{t}</Badge>)}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mb-4">
          <Clock size={16} className="text-ink-muted" />
          <span className="font-mono text-3xl font-bold tabular">{left}s</span>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed mb-6 p-3 rounded-lg bg-surface/50 border border-border">
          {result.advice}
        </p>

        <div className="grid grid-cols-1 gap-3 mb-3">
          <Button variant="cyan" size="lg" onClick={onCancel}>
            Cancel Payment
          </Button>
          <Button variant="ghost" onClick={handleCallFamily} disabled={familySending || familySent}>
            {familySending
              ? (<><Loader2 size={15} className="animate-spin" /> Sending…</>)
              : familySent
                ? (<><CheckCircle2 size={15} className="text-safe" /> Family alerted ✓</>)
                : (<><PhoneCall size={15} /> Call Family</>)}
          </Button>
        </div>

        <button
          onClick={left <= 0 ? onProceed : undefined}
          disabled={left > 0}
          className={cn(
            'text-[11px] underline transition-colors',
            left > 0 ? 'text-ink-dim cursor-not-allowed' : 'text-ink-muted hover:text-threat',
          )}
        >
          {left > 0 ? `proceed anyway (unlocks in ${left}s)` : 'proceed anyway'}
        </button>
      </motion.div>
    </motion.div>
  )
}

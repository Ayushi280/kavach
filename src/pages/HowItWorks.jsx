import React from 'react'
import { motion } from 'framer-motion'
import {
  PhoneIncoming, Cpu, Bell, Users, FileWarning, ChevronRight,
  Lock, EyeOff, Server, ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { RealVsSimulated } from '@/components/RealVsSimulated'

const STEPS = [
  {
    icon: PhoneIncoming,
    title: 'Call or message arrives',
    body: 'An unknown number rings, or a message lands in WhatsApp / SMS. Kavach observes the transcript in real time.',
  },
  {
    icon: Cpu,
    title: 'On-device AI classifies',
    body: 'A quantized MuRIL classifier runs on the phone itself. It scores scam intent across 8 Indian languages and code-mixed Hinglish in under a second.',
  },
  {
    icon: Bell,
    title: 'User is warned instantly',
    body: 'If the score crosses the threshold, a red overlay warns the user before they can share OTP, Aadhaar, or transfer money.',
  },
  {
    icon: Users,
    title: 'Family is alerted',
    body: 'For high-risk cases (digital arrest patterns), one trusted family contact gets a push — breaking the isolation scammers rely on.',
  },
  {
    icon: FileWarning,
    title: 'Cyber cell gets intel',
    body: 'Anonymized metadata — masked number, city, scam type, language — feeds the live fraud-network graph investigators use.',
  },
]

const PRIVACY = [
  { icon: Cpu, title: 'On-device processing', body: 'The classifier runs locally. Call audio and message text never leave your phone.' },
  { icon: EyeOff, title: 'No audio storage', body: 'Only the transient transcript is scored. Nothing is written to disk or uploaded.' },
  { icon: Server, title: 'Anonymized telemetry only', body: 'What reaches the cyber cell is masked (last 4 digits redacted) and aggregated — never linked back to the user.' },
  { icon: Lock, title: 'DPDP-compliant', body: 'Aligned with India\'s Digital Personal Data Protection Act, 2023. Full user consent, revocable at any time.' },
]

export default function HowItWorks() {
  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="mb-10">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <ShieldCheck size={12} /> How it works
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          The path from a suspicious call to a caught fraud ring.
        </h1>
        <p className="mt-3 text-ink-muted max-w-2xl">
          Five steps. Each one happens in under a second. All of them respect the user's
          privacy by design.
        </p>
      </div>

      {/* Flow steps */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-accent-cyan via-border to-transparent hidden md:block" />

        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.05 }}
              className="relative flex gap-5 items-start card p-5"
            >
              {/* Numbered marker */}
              <div className="relative flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center">
                  <s.icon size={20} className="text-accent-cyan" />
                </div>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-bg-deep border border-border flex items-center justify-center">
                  <span className="text-[10px] font-bold text-accent-cyan font-mono">
                    {i + 1}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-muted leading-relaxed">{s.body}</p>
              </div>

              {i < STEPS.length - 1 && (
                <ChevronRight size={16} className="text-ink-dim mt-4 hidden md:block" />
              )}
            </motion.li>
          ))}
        </ol>
      </div>

      {/* Privacy section */}
      <div className="mt-16">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="eyebrow mb-2">Privacy by design</div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              What Kavach does — and doesn't — do with your data.
            </h2>
          </div>
          <div className="flex gap-2">
            <Badge tone="cyan">On-device</Badge>
            <Badge tone="green">No audio stored</Badge>
            <Badge tone="blue">DPDP · 2023</Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {PRIVACY.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card p-5"
            >
              <p.icon size={18} className="text-accent-cyan mb-3" />
              <h4 className="text-sm font-semibold text-ink mb-1">{p.title}</h4>
              <p className="text-sm text-ink-muted leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* What Kavach does not do */}
      <div className="mt-8 card p-6">
        <div className="eyebrow mb-3">What Kavach does not do</div>
        <ul className="space-y-2 text-sm text-ink-muted">
          {[
            'Record or upload call audio.',
            'Read personal messages beyond the moment of classification.',
            'Sell data to advertisers — Kavach has no advertiser model.',
            'Share your identity with police. Only anonymized metadata flows to the cyber cell.',
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-safe flex-shrink-0" />
              <span className="text-ink">{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <RealVsSimulated />
    </div>
  )
}

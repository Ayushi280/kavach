import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, ArrowRight, Radar, Network, Languages, LockKeyhole, PhoneOff, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/StatCard'

export default function Landing() {
  return (
    <div className="relative">
      {/* --- HERO --- */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Grid backdrop */}
        <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] opacity-70" />
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-accent-cyan/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[300px] w-[500px] rounded-full bg-accent-blue/10 blur-[100px]" />
        </div>
        {/* Scanline */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-cyan/50 to-transparent animate-scan pointer-events-none" />

        <div className="relative w-full max-w-6xl mx-auto px-6 lg:px-10 py-24">
          {/* Status pill */}
          

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mt-8 text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[0.95]"
          >
            AI Shield Against
            <br />
            <span className="bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-cyan bg-clip-text text-transparent">
              Digital Fraud.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 text-lg md:text-xl text-ink-muted max-w-2xl leading-relaxed"
          >
            Kavach detects scam calls &amp; messages — including{' '}
            <span className="text-ink">"digital arrest"</span> fraud — in real time,
            across <span className="text-ink">8+ Indian languages</span>. Warns the victim.
            Alerts the family. Feeds intel to the cyber cell.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link to="/detector">
              <Button size="lg" variant="cyan" className="shadow-glow-cyan">
                Try the Live Detector
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="ghost">
                Open Cyber Cell
              </Button>
            </Link>
          </motion.div>

          {/* Highlight stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <StatCard
              label="Lost to digital-arrest scams"
              value={1776}
              prefix="₹"
              suffix="Cr"
              tone="red"
              icon={PhoneOff}
              hint="reported to I4C · 2024"
            />
            <StatCard
              label="Indian languages covered"
              value={8}
              tone="cyan"
              icon={Languages}
              hint="+ code-mixed Hinglish"
            />
            <StatCard
              label="Scams blocked today"
              value={348}
              tone="green"
              icon={Shield}
              live
            />
            <StatCard
              label="Fraud rings tracked"
              value={27}
              tone="blue"
              icon={Network}
              hint="across 6 states"
            />
          </motion.div>
        </div>
      </section>

      {/* --- WHAT IT DOES --- */}
      <section className="relative py-24 px-6 lg:px-10 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="eyebrow mb-2">Capabilities</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-xl">
              A full stack for stopping fraud —
              <span className="text-ink-muted"> from the phone to the police station.</span>
            </h2>
          </div>
          <Badge tone="cyan">On-device · No audio stored</Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <CapabilityCard
            icon={Radar}
            title="Real-time detection"
            body="MuRIL-based classifier flags scam intent in seconds — across Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi and code-mixed Hinglish."
            step="01"
          />
          <CapabilityCard
            icon={Users}
            title="Family alerting"
            body="If Kavach detects an elderly relative on a suspected digital-arrest call, it pings trusted contacts within seconds — before the money moves."
            step="02"
          />
          <CapabilityCard
            icon={Network}
            title="Cyber-cell intel"
            body="Every flagged call feeds a live fraud-network graph — numbers, mule accounts, victims — giving investigators the ring, not just the caller."
            step="03"
          />
        </div>
      </section>

      {/* --- CTA STRIP --- */}
      <section className="relative py-20 px-6 lg:px-10 max-w-6xl mx-auto">
        <div className="card p-10 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent-cyan/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent-blue/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="eyebrow mb-3">Live demo</div>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Paste a suspicious message. See a verdict in under a second.
              </h3>
              <p className="mt-3 text-ink-muted">
                Try one of the pre-loaded Hindi, Tamil, or English scripts — or paste your own.
              </p>
            </div>
            <Link to="/detector">
              <Button variant="cyan" size="lg">
                Analyze a message
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

function CapabilityCard({ icon: Icon, title, body, step }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      className="card p-6 relative overflow-hidden group hover:border-border-bright transition-colors"
    >
      <div className="font-mono text-[11px] text-ink-dim mb-4">{step}</div>
      <Icon size={22} className="text-accent-cyan mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
    </motion.div>
  )
}

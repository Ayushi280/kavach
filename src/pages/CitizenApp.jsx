import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Smartphone, Phone, MessageCircle, Users, ShieldCheck,
  AlertTriangle, PhoneOff, Cpu, Lock, ToggleRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const SCENES = [
  { id: 'call', label: 'Incoming call', icon: Phone },
  { id: 'chat', label: 'Fraud Shield bot', icon: MessageCircle },
  { id: 'family', label: 'Family alert', icon: Users },
  { id: 'privacy', label: 'Privacy toggle', icon: ShieldCheck },
]

export default function CitizenApp() {
  const [scene, setScene] = useState('call')

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <div className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <Smartphone size={12} /> Citizen App Preview
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          What it looks like on the phone.
        </h1>
        <p className="mt-2 text-ink-muted max-w-2xl">
          Kavach runs quietly in the background. When something suspicious happens,
          the user sees a warning — and the people who love them get a heads-up.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr,auto] gap-10 items-start">
        {/* Left: scene selector + explainer */}
        <div className="space-y-4 order-2 lg:order-1">
          <div className="eyebrow">Preview</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SCENES.map((s) => {
              const Icon = s.icon
              const active = scene === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setScene(s.id)}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all',
                    active
                      ? 'bg-accent-blue/10 border-accent-blue/40 text-ink'
                      : 'bg-surface/30 border-border text-ink-muted hover:border-border-bright hover:text-ink',
                  )}
                >
                  <Icon size={16} className={cn(active ? 'text-accent-cyan' : 'text-ink-muted', 'mb-2')} />
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {DESCRIPTIONS[s.id]}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="card p-5 mt-6">
            <div className="eyebrow mb-3">The pitch</div>
            <div className="space-y-3 text-sm text-ink-muted">
              <p>
                <span className="text-ink">Every second matters.</span> Digital-arrest
                scams work by keeping the victim on a call for hours, isolated from
                anyone who could talk them out of it.
              </p>
              <p>
                Kavach breaks that isolation. Detection happens on-device — no audio
                ever leaves the phone — and a soft nudge goes to one trusted family
                contact within seconds of a suspected scam call.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge tone="cyan"><Cpu size={11} /> On-device</Badge>
              <Badge tone="green"><Lock size={11} /> No audio stored</Badge>
              <Badge tone="blue">DPDP-compliant</Badge>
            </div>
          </div>
        </div>

        {/* Right: phone frame */}
        <div className="order-1 lg:order-2 flex justify-center">
          <PhoneFrame>
            {scene === 'call' && <CallScene />}
            {scene === 'chat' && <ChatScene />}
            {scene === 'family' && <FamilyScene />}
            {scene === 'privacy' && <PrivacyScene />}
          </PhoneFrame>
        </div>
      </div>
    </div>
  )
}

const DESCRIPTIONS = {
  call: 'Incoming call from an unknown number flagged as likely scam',
  chat: 'Forward a message to the WhatsApp bot for a verdict',
  family: 'Notification sent to a trusted contact',
  privacy: 'How on-device processing is presented to the user',
}

function PhoneFrame({ children }) {
  return (
    <div className="relative">
      {/* Phone body */}
      <div className="relative w-[300px] h-[610px] rounded-[42px] bg-[#0B0F1A] border-[6px] border-[#1A2338] shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-24 rounded-full bg-[#000] z-20" />
        {/* Status bar */}
        <div className="absolute top-0 inset-x-0 h-10 flex items-center justify-between px-6 text-[10px] text-ink-muted font-mono z-10">
          <span>21:47</span>
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <span>·</span>
            <span>82%</span>
          </div>
        </div>

        {/* Screen content */}
        <div className="absolute inset-0 pt-10 pb-4 px-4 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Reflection */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 h-6 w-56 bg-accent-cyan/15 blur-2xl rounded-full" />
    </div>
  )
}

function CallScene() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      <div className="text-center pt-6">
        <div className="text-[10px] uppercase tracking-widest text-ink-muted">Incoming call</div>
        <div className="mt-4 text-xl font-semibold text-ink">Unknown number</div>
        <div className="text-xs text-ink-muted font-mono mt-1">+91-98432-XXX-21</div>
      </div>

      {/* Kavach warning card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 mx-1 p-4 rounded-2xl border border-threat/40 bg-threat/10 shadow-glow-threat"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-threat" />
          <span className="text-xs font-bold text-threat tracking-wide">KAVACH · POSSIBLE SCAM</span>
        </div>
        <div className="text-sm text-ink font-medium leading-snug">
          This number matches a digital-arrest pattern reported in Delhi today.
        </div>
        <div className="mt-3 text-[11px] text-ink-muted">
          Similar to <span className="text-threat">3 alerts</span> in the last 24 hours.
        </div>
      </motion.div>

      {/* Ring animation */}
      <div className="flex-1 flex items-center justify-center relative">
        <div className="absolute h-32 w-32 rounded-full border border-accent-cyan/20 animate-ping" />
        <div className="absolute h-24 w-24 rounded-full border border-accent-cyan/30 animate-ping" style={{ animationDelay: '0.4s' }} />
        <div className="relative h-20 w-20 rounded-full bg-surface border border-border flex items-center justify-center">
          <Phone size={28} className="text-ink" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-around px-4 pb-4">
        <button className="h-14 w-14 rounded-full bg-threat flex items-center justify-center shadow-lg">
          <PhoneOff size={22} className="text-white" />
        </button>
        <button className="h-14 w-14 rounded-full bg-safe flex items-center justify-center shadow-lg opacity-70">
          <Phone size={22} className="text-white" />
        </button>
      </div>
    </motion.div>
  )
}

function ChatScene() {
  return (
    <div className="h-full flex flex-col">
      <div className="pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-accent-cyan/20 flex items-center justify-center">
            <ShieldCheck size={16} className="text-accent-cyan" />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">Kavach Bot</div>
            <div className="text-[10px] text-safe">● online · WhatsApp</div>
          </div>
        </div>
      </div>

      <div className="flex-1 py-3 space-y-3 overflow-hidden text-[13px]">
        <ChatBubble side="right">
          <div className="text-ink">
            "This is CBI. Your Aadhaar is linked to a drug parcel. Join video call now or you will be arrested."
          </div>
        </ChatBubble>

        <ChatBubble side="right" small>
          Kya ye scam hai?
        </ChatBubble>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mr-auto max-w-[85%]"
        >
          <div className="rounded-2xl rounded-tl-sm bg-threat/10 border border-threat/40 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle size={11} className="text-threat" />
              <span className="text-[10px] font-bold text-threat tracking-wider">SCAM · 99.7%</span>
            </div>
            <div className="text-ink text-[13px] leading-snug">
              Haan, ye <b>digital arrest scam</b> hai. CBI kabhi bhi video call par arrest nahi karti.
            </div>
            <div className="mt-2 text-[11px] text-ink-muted">
              → Turant call kaatein. 1930 par report karein.
            </div>
          </div>
        </motion.div>
      </div>

      <div className="border-t border-border pt-2 flex items-center gap-2">
        <div className="flex-1 h-8 rounded-full bg-surface border border-border px-3 flex items-center text-[11px] text-ink-dim">
          Forward a suspicious message…
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ children, side, small }) {
  const isRight = side === 'right'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(isRight ? 'ml-auto' : 'mr-auto', 'max-w-[85%]')}
    >
      <div
        className={cn(
          'rounded-2xl p-3 text-[13px]',
          isRight
            ? 'bg-surface border border-border rounded-tr-sm'
            : 'bg-accent-blue/10 border border-accent-blue/30 rounded-tl-sm',
          small && 'py-2 text-[12px] text-ink-muted',
        )}
      >
        {children}
      </div>
    </motion.div>
  )
}

function FamilyScene() {
  return (
    <div className="h-full flex flex-col">
      <div className="pt-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-muted">Now</div>
          <div className="text-xl font-semibold text-ink">21:47</div>
        </div>
        <div className="text-[10px] text-ink-muted font-mono">Family Circle</div>
      </div>

      {/* Alert notification */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-5 rounded-2xl border border-threat/40 bg-threat/10 p-4 shadow-glow-threat"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg bg-threat/20 flex items-center justify-center">
            <ShieldCheck size={16} className="text-threat" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-threat tracking-wider">KAVACH FAMILY ALERT</div>
            <div className="text-[10px] text-ink-muted">2 seconds ago</div>
          </div>
        </div>
        <div className="text-sm font-medium text-ink leading-snug">
          Your mother <span className="text-accent-cyan">Radha</span> may be on a scam call right now.
        </div>
        <div className="mt-2 text-[11px] text-ink-muted leading-relaxed">
          Kavach detected digital-arrest keywords on an active call. She has been on the
          line for <span className="text-ink">14 minutes</span>.
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="h-9 rounded-lg bg-safe text-white text-xs font-semibold">
            Call her now
          </button>
          <button className="h-9 rounded-lg bg-surface border border-border text-ink text-xs">
            I'm on it
          </button>
        </div>
      </motion.div>

      {/* Older notif */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 0.35 }}
        className="mt-3 rounded-xl border border-border bg-surface/40 p-3"
      >
        <div className="text-[10px] text-ink-dim tracking-wider mb-1">YESTERDAY · 19:02</div>
        <div className="text-xs text-ink-muted">
          Suspicious SMS blocked on Papa's phone — reward/lottery pattern.
        </div>
      </motion.div>
    </div>
  )
}

function PrivacyScene() {
  return (
    <div className="h-full flex flex-col">
      <div className="pt-4">
        <div className="text-[10px] uppercase tracking-widest text-ink-muted">Settings</div>
        <div className="text-xl font-semibold text-ink mt-1">Protection</div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 rounded-2xl border border-safe/40 bg-safe/10 p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-safe/20 flex items-center justify-center">
              <ShieldCheck size={20} className="text-safe" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">Kavach protection</div>
              <div className="text-[11px] text-safe">Active</div>
            </div>
          </div>
          <ToggleRight size={36} className="text-safe" />
        </div>
      </motion.div>

      <div className="mt-4 space-y-2 text-[12px]">
        <Row icon={<Cpu size={13} />} label="Processed on your phone" ok />
        <Row icon={<Lock size={13} />} label="No audio ever stored" ok />
        <Row icon={<Users size={13} />} label="1 trusted family contact" />
        <Row icon={<MessageCircle size={13} />} label="WhatsApp Fraud Shield" ok />
      </div>

      <div className="mt-auto pt-4 text-[10px] text-ink-muted leading-relaxed">
        Kavach analyzes call transcripts locally on your device. Nothing is uploaded
        unless you explicitly report a call.
      </div>
    </div>
  )
}

function Row({ icon, label, ok }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/70 last:border-0">
      <div className="flex items-center gap-2 text-ink-muted">
        <span className="text-accent-cyan">{icon}</span>
        {label}
      </div>
      {ok && <span className="text-[10px] font-semibold text-safe">ON</span>}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Shield, Radar, LayoutDashboard, Smartphone, Lock, Menu, X, IndianRupee, PhoneIncoming, Mic,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Overview', icon: Shield, end: true },
  { to: '/protection', label: 'Live Protection', icon: Mic },
  { to: '/detector', label: 'Scam Detector', icon: Radar },
  { to: '/dashboard', label: 'Cyber Cell', icon: LayoutDashboard, badge: 'LIVE' },
  { to: '/payment', label: 'Payment Guard', icon: IndianRupee },
  { to: '/how-it-works', label: 'How & Privacy', icon: Lock },
]

// "Kavach" in every language the platform supports
const LOGO_WORDS = [
  'Kavach',   // English
  'कवच',      // Hindi
  'கவசம்',    // Tamil
  'కవచం',     // Telugu
  'কবচ',      // Bengali
  'કવચ',      // Gujarati
  'ಕವಚ',      // Kannada
  'കവചം',     // Malayalam
  'ਕਵਚ',      // Punjabi
]

const LOGO_INTERVAL = 2400 // ms between language changes

export function Sidebar({ mobileOpen, setMobileOpen }) {
  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-bg-deep/90 backdrop-blur border-b border-border">
        <Logo />
        <button
          className="p-2 rounded-lg hover:bg-surface"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 border-r border-border bg-bg-deep/95 backdrop-blur',
          'flex flex-col transition-transform duration-200',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="h-24 px-5 flex items-center border-b border-border">
          <Logo />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="eyebrow px-3 pb-2">Navigate</div>
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    'hover:bg-surface hover:text-ink',
                    isActive
                      ? 'bg-accent-blue/10 text-accent-cyan border border-accent-blue/25'
                      : 'text-ink-muted border border-transparent',
                  )
                }
              >
                <Icon size={16} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-semibold text-threat flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-threat animate-pulse-dot" />
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

function Logo() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return undefined
    const t = setInterval(() => {
      setI((v) => (v + 1) % LOGO_WORDS.length)
    }, LOGO_INTERVAL)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative flex-shrink-0">
        <Shield size={36} className="text-accent-cyan" strokeWidth={2.2} />
        <div className="absolute inset-0 blur-lg bg-accent-cyan/40 -z-10 rounded-full" />
      </div>
      <div className="relative flex-1 h-[52px] flex items-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={LOGO_WORDS[i]}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="text-ink font-bold tracking-tight text-[38px] absolute inset-x-0 whitespace-nowrap"
          >
            {LOGO_WORDS[i]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

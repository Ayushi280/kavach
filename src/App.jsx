import React, { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/Sidebar'
import { NetworkBackground } from '@/components/NetworkBackground'
import Landing from '@/pages/Landing'
import Detector from '@/pages/Detector'
import Dashboard from '@/pages/Dashboard'
import CitizenApp from '@/pages/CitizenApp'
import HowItWorks from '@/pages/HowItWorks'
import Payment from '@/pages/Payment'
import VictimFlow from '@/pages/VictimFlow'
import Protection from '@/pages/Protection'

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      {/* Darktrace-style animated network lines — sits behind everything */}
      <NetworkBackground />

      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="flex-1 lg:pl-64 pt-14 lg:pt-0 min-w-0 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Landing />} />
              <Route path="/detector" element={<Detector />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/citizen" element={<CitizenApp />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/victim" element={<VictimFlow />} />
              <Route path="/protection" element={<Protection />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

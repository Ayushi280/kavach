import React from 'react'
import { CheckCircle2, FlaskConical } from 'lucide-react'

const ROWS = [
  { feature: 'Scam detection model (MuRIL)', real: true, note: 'Live classification on every /check call' },
  { feature: 'Tactic decomposition + progression score', real: true, note: 'Computed per message by the backend' },
  { feature: 'Payment circuit breaker logic', real: true, note: 'Risk window armed by real detections' },
  { feature: 'Family alert (Telegram)', real: true, note: 'Actually sends a Telegram message' },
  { feature: 'Guardian Voice (TTS warning)', real: true, note: 'Real generated MP3 in the victim\'s language' },
  { feature: 'The UPI payment app itself', real: false, note: 'Mock screen — no money moves' },
  { feature: 'Dashboard stats & alerts feed', real: false, note: 'Representative data' },
  { feature: 'Honeypot conversation', real: false, note: 'Scripted demonstration of the technique' },
]

export function RealVsSimulated() {
  return (
    <div className="mt-16">
      <div className="mb-6">
        <div className="eyebrow mb-2">Honesty table</div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
          What's real vs simulated.
        </h2>
        <p className="mt-2 text-ink-muted max-w-2xl text-sm">
          We think demos should be honest. Here's exactly which parts of Kavach run
          live and which are staged for demonstration.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4 eyebrow font-medium">Feature</th>
              <th className="p-4 eyebrow font-medium w-32">Status</th>
              <th className="p-4 eyebrow font-medium hidden md:table-cell">Detail</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.feature} className="border-b border-border/60 last:border-0">
                <td className="p-4 text-ink">{r.feature}</td>
                <td className="p-4">
                  {r.real ? (
                    <span className="inline-flex items-center gap-1.5 text-safe text-xs font-semibold">
                      <CheckCircle2 size={13} /> REAL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warn text-xs font-semibold">
                      <FlaskConical size={13} /> SIMULATED
                    </span>
                  )}
                </td>
                <td className="p-4 text-ink-muted text-xs hidden md:table-cell">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

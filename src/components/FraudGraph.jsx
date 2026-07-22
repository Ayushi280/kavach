import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Network, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getFraudGraph } from '@/lib/api'
import { cn } from '@/lib/utils'

const COLORS = {
  scammer: '#EF4444', // threat red — kept for semantic clarity
  mule: '#F59E0B',    // warn amber — kept for semantic clarity
  victim: '#34D399',  // accent green
}

const RADIUS = {
  scammer: 10,
  mule: 7,
  victim: 5.5,
}

// ── Physics tuning ──
const REPEL = 900          // node-node repulsion strength
const SPRING = 0.02        // link spring strength
const LINK_DIST = 90       // ideal link length
const CENTER_PULL = 0.006  // gentle pull toward canvas center
const DAMPING = 0.86       // velocity damping per frame
const SETTLE_FRAMES = 220  // frames of active simulation before freezing layout

export function FraudGraph() {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const [raw, setRaw] = useState({ nodes: [], links: [] })
  const simNodesRef = useRef([])   // mutable simulation state (not in React state — perf)
  const linksRef = useRef([])      // resolved link objects with node refs
  const frameCountRef = useRef(0)
  const settledRef = useRef(false)
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState(null)
  const [dims, setDims] = useState({ w: 600, h: 480 })
  const tRef = useRef(0)

  // ── Fetch graph data ──
  useEffect(() => {
    let cancelled = false
    getFraudGraph().then((d) => {
      if (cancelled) return
      setRaw(d)
    })
    return () => { cancelled = true }
  }, [])

  // ── Seed simulation nodes once data + dims are known ──
  useEffect(() => {
    if (raw.nodes.length === 0) return
    const { w, h } = dims
    const cx = w / 2
    const cy = h / 2

    // Group by ring for a nicer initial layout (clusters spread around center)
    const rings = [...new Set(raw.nodes.map((n) => n.ring))]
    const ringAngle = {}
    rings.forEach((r, i) => { ringAngle[r] = (i / rings.length) * Math.PI * 2 })

    simNodesRef.current = raw.nodes.map((n) => {
      const angle = (ringAngle[n.ring] || 0) + (Math.random() - 0.5) * 0.8
      const dist = 60 + Math.random() * 90
      return {
        ...n,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
      }
    })

    const nodeById = Object.fromEntries(simNodesRef.current.map((n) => [n.id, n]))
    linksRef.current = raw.links
      .map((l) => ({ source: nodeById[l.source], target: nodeById[l.target] }))
      .filter((l) => l.source && l.target)

    frameCountRef.current = 0
    settledRef.current = false
  }, [raw, dims.w, dims.h])

  // ── Resize observer ──
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setDims({ w: Math.max(300, Math.floor(cr.width)), h: Math.max(360, Math.floor(cr.height)) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Simulation + render loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    canvas.width = dims.w * dpr
    canvas.height = dims.h * dpr
    canvas.style.width = dims.w + 'px'
    canvas.style.height = dims.h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    function step() {
      const nodes = simNodesRef.current
      const links = linksRef.current
      const { w, h } = dims

      // ---- physics ----
      if (!settledRef.current && nodes.length > 0) {
        // repulsion (all pairs — fine at this node count, ~30-40 nodes)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j]
            let dx = a.x - b.x, dy = a.y - b.y
            let distSq = dx * dx + dy * dy
            if (distSq < 1) distSq = 1
            const dist = Math.sqrt(distSq)
            const force = REPEL / distSq
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            a.vx += fx; a.vy += fy
            b.vx -= fx; b.vy -= fy
          }
        }
        // springs (links)
        for (let i = 0; i < links.length; i++) {
          const { source: a, target: b } = links[i]
          const dx = b.x - a.x, dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const diff = dist - LINK_DIST
          const fx = (dx / dist) * diff * SPRING
          const fy = (dy / dist) * diff * SPRING
          a.vx += fx; a.vy += fy
          b.vx -= fx; b.vy -= fy
        }
        // center pull + integrate
        const cx = w / 2, cy = h / 2
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]
          n.vx += (cx - n.x) * CENTER_PULL
          n.vy += (cy - n.y) * CENTER_PULL
          n.vx *= DAMPING
          n.vy *= DAMPING
          n.x += n.vx
          n.y += n.vy
          // keep within bounds
          n.x = Math.max(20, Math.min(w - 20, n.x))
          n.y = Math.max(20, Math.min(h - 20, n.y))
        }
        frameCountRef.current++
        if (frameCountRef.current > SETTLE_FRAMES) settledRef.current = true
      }

      // ---- render ----
      tRef.current += 0.03
      const t = tRef.current
      ctx.clearRect(0, 0, w, h)

      const activeId = selected || hover
      const highlightNodes = new Set()
      const highlightLinks = new Set()
      if (activeId) {
        highlightNodes.add(activeId)
        links.forEach((l, i) => {
          if (l.source.id === activeId || l.target.id === activeId) {
            highlightNodes.add(l.source.id)
            highlightNodes.add(l.target.id)
            highlightLinks.add(i)
          }
        })
      }

      // links
      for (let i = 0; i < links.length; i++) {
        const { source: a, target: b } = links[i]
        const hi = highlightLinks.has(i)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        if (hi) {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)'
          ctx.lineWidth = 1.6
        } else if (activeId) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
          ctx.lineWidth = 0.6
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
          ctx.lineWidth = 0.6
        }
        ctx.stroke()
      }

      // nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const isHi = highlightNodes.has(n.id)
        const isDim = activeId && !isHi
        const baseR = RADIUS[n.type] || 6
        const pulse = 1 + Math.sin(t + n.x * 0.02) * 0.06
        const r = baseR * pulse * (isHi ? 1.15 : 1)
        const color = COLORS[n.type] || '#94A3B8'

        if (isHi || n.type === 'scammer') {
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 2.2, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 2.2)
          grad.addColorStop(0, hexA(color, isHi ? 0.5 : 0.3))
          grad.addColorStop(1, hexA(color, 0))
          ctx.fillStyle = grad
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isDim ? hexA(color, 0.35) : color
        ctx.fill()
        ctx.lineWidth = 1.2
        ctx.strokeStyle = isDim ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)'
        ctx.stroke()

        if (isHi) {
          ctx.font = '11px Inter, system-ui'
          ctx.fillStyle = '#F8FAFC'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(n.label, n.x, n.y + r + 4)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, selected, hover, raw])

  // ── Mouse handling: hover + click on nodes ──
  const findNodeAt = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const nodes = simNodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      const r = (RADIUS[n.type] || 6) + 4
      const dx = n.x - x, dy = n.y - y
      if (dx * dx + dy * dy <= r * r) return n
    }
    return null
  }, [])

  function handleMouseMove(e) {
    const n = findNodeAt(e.clientX, e.clientY)
    setHover(n ? n.id : null)
    if (canvasRef.current) canvasRef.current.style.cursor = n ? 'pointer' : 'default'
  }

  function handleClick(e) {
    const n = findNodeAt(e.clientX, e.clientY)
    setSelected((prev) => (n ? (n.id === prev ? null : n.id) : null))
  }

  const selectedNode = raw.nodes.find((n) => n.id === selected)
  const connectedCount = useMemo(() => {
    if (!selected) return 0
    return raw.links.filter((l) => l.source === selected || l.target === selected).length
  }, [selected, raw.links])

  return (
    <div className="card p-5 h-full flex flex-col min-h-[520px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Network size={14} className="text-accent-cyan" />
            Fraud Network Graph
          </h3>
          <div className="text-xs text-ink-muted mt-0.5">
            {raw.nodes.length} nodes · {raw.links.length} edges
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <LegendDot color={COLORS.scammer} label="Scammer" />
          <LegendDot color={COLORS.mule} label="Mule" />
          <LegendDot color={COLORS.victim} label="Victim" />
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative rounded-lg overflow-hidden bg-bg-deep/60 border border-border"
      >
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
          className="relative"
        />

        {raw.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
            Loading network…
          </div>
        )}

        {selectedNode && (
          <div className="absolute top-3 right-3 w-64 card p-4 shadow-glow-cyan">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="eyebrow mb-1">Node detail</div>
                <div className="text-sm font-semibold font-mono">{selectedNode.label}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-ink-muted hover:text-ink"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <Row
                label="Type"
                value={
                  <Badge tone={
                    selectedNode.type === 'scammer' ? 'red'
                      : selectedNode.type === 'mule' ? 'amber' : 'green'
                  }>{selectedNode.type}</Badge>
                }
              />
              <Row label="Ring" value={selectedNode.ring || '—'} mono />
              <Row label="Node ID" value={selectedNode.id} mono />
              <Row label="Connected" value={connectedCount + ' edges'} />
            </div>
            <div className="mt-3 pt-3 border-t border-border text-[10px] text-ink-muted uppercase tracking-wider">
              Hover / click nodes to explore
            </div>
          </div>
        )}

        {!selected && (
          <div className="absolute bottom-3 left-3 text-[11px] text-ink-muted font-mono">
            hover · click a node
          </div>
        )}
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-ink-muted">{label}</span>
      <span className={cn('text-ink text-right', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

function hexA(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

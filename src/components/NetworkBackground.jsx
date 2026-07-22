import React, { useEffect, useRef } from 'react'

// Matrix-style green digital-rain background.
// Uses the uploaded video (public/matrix.mp4) shown exactly as-is,
// with a subtle dark scrim so foreground content stays readable.
export function NetworkBackground() {
  const videoRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    // Respect reduced-motion: freeze on the first frame.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      v.pause()
    } else {
      const p = v.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
  }, [])

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src="/matrix.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
      {/* Light uniform scrim — keeps text legible without darkening any side */}
      <div className="absolute inset-0 bg-bg/35" />
    </div>
  )
}

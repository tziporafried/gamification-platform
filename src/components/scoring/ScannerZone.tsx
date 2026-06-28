import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import type { QrScoringMode } from '@/types'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

// Deterministic — no Math.random on render
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left:  ((i * 7.31) % 80) + 10,
  top:   ((i * 11.7) % 80) + 10,
  yOff:  -(18 + (i * 2.9) % 28),
  xOff:  ((i * 5.7) % 38) - 19,
  dur:   3.2 + (i * 0.65) % 3.8,
  delay: (i * 0.57) % 5.2,
  size:  0.9 + (i % 3) * 0.8,
}))

const CORNER_CLASSES = [
  'left-3 top-3 border-l-[3px] border-t-[3px] rounded-tl-xl',
  'right-3 top-3 border-r-[3px] border-t-[3px] rounded-tr-xl',
  'bottom-3 left-3 border-b-[3px] border-l-[3px] rounded-bl-xl',
  'bottom-3 right-3 border-b-[3px] border-r-[3px] rounded-br-xl',
]

interface Props {
  mode: QrScoringMode
  successFlash: boolean
  accent: AccentRgb
}

export interface ScannerZoneRef { resetSeparateState: () => void }

export const ScannerZone = forwardRef<ScannerZoneRef, Props>(
  function ScannerZone({ mode, successFlash, accent }, ref) {
    const [scannedParticipant, setScannedParticipant] = useState<string | null>(null)
    const [scannedAction,      setScannedAction]      = useState<string | null>(null)

    useImperativeHandle(ref, () => ({
      resetSeparateState() { setScannedParticipant(null); setScannedAction(null) },
    }))

    const a = accent
    const ac = `rgba(${a.r},${a.g},${a.b}`  // partial rgba — append ,opacity)

    const expandingRings = useMemo(() => [
      { delay: 0.00, size: 700,  color: 'rgba(34,197,94,0.35)' },
      { delay: 0.15, size: 900,  color: rgba(accent, 0.25)     },
      { delay: 0.30, size: 1100, color: 'rgba(34,197,94,0.15)' },
    ], [accent])

    return (
      <div className="flex w-full flex-col items-center justify-center">
        <motion.div
          className="relative mx-auto w-full"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 180, damping: 22 }}
        >
          {/* ── Breathing ambient glow ── */}
          <motion.div
            className="pointer-events-none absolute rounded-3xl"
            style={{ inset: '-14%', background: `radial-gradient(circle, ${ac},0.24) 0%, ${ac},0.07) 48%, transparent 72%)` }}
            animate={{ opacity: [0.45, 1, 0.45], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* ── Success: expanding rings ── */}
          <AnimatePresence>
            {successFlash && expandingRings.map((ring, i) => (
              <motion.div
                key={`ring-${i}`}
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 rounded-full"
                style={{ borderWidth: 2, borderStyle: 'solid', borderColor: ring.color }}
                initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 0.9 }}
                animate={{ width: ring.size, height: ring.size, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, delay: ring.delay, ease: 'easeOut' }}
              />
            ))}
          </AnimatePresence>

          {/* ── Success: glow burst ── */}
          <AnimatePresence>
            {successFlash && (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 rounded-full"
                style={{ background: `radial-gradient(circle, rgba(34,197,94,0.5) 0%, ${ac},0.22) 35%, transparent 70%)` }}
                initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 1 }}
                animate={{ width: 1000, height: 1000, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

          {/* ════ SCANNER FRAME ════ */}
          <div
            className="relative mx-auto aspect-square w-[min(100%,640px,min(88vw,40dvh))] overflow-hidden rounded-2xl backdrop-blur-xl sm:rounded-3xl lg:w-[min(100%,540px,min(46vw,54dvh))]"
            style={{
              background: `linear-gradient(150deg, ${ac},0.08) 0%, rgba(4,3,12,0.82) 45%, ${ac},0.05) 100%)`,
              border: `1.5px solid ${ac},0.38)`,
              boxShadow: `0 0 0 1px ${ac},0.06) inset, 0 0 50px ${ac},0.07) inset, 0 8px 40px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Dot grid texture */}
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                backgroundImage: `radial-gradient(circle, ${ac},0.14) 1px, transparent 1px)`,
                backgroundSize: '26px 26px',
              }}
            />

            {/* Inner glass border (depth layer) */}
            <div
              className="pointer-events-none absolute z-0 rounded-xl sm:rounded-2xl"
              style={{ inset: '5%', border: `1px solid ${ac},0.07)` }}
            />

            {/* Pulsing QR watermark */}
            <div className="absolute inset-0 z-0 flex items-center justify-center">
              <motion.svg
                viewBox="0 0 100 100"
                fill="none"
                className="w-[30%]"
                animate={{ opacity: [0.07, 0.18, 0.07], scale: [0.93, 1.07, 0.93] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* QR corners */}
                <rect x="8"  y="8"  width="32" height="32" rx="5" stroke={`rgb(${a.r},${a.g},${a.b})`} strokeWidth="4" />
                <rect x="60" y="8"  width="32" height="32" rx="5" stroke={`rgb(${a.r},${a.g},${a.b})`} strokeWidth="4" />
                <rect x="8"  y="60" width="32" height="32" rx="5" stroke={`rgb(${a.r},${a.g},${a.b})`} strokeWidth="4" />
                <rect x="16" y="16" width="16" height="16" rx="2" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="68" y="16" width="16" height="16" rx="2" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="16" y="68" width="16" height="16" rx="2" fill={`rgb(${a.r},${a.g},${a.b})`} />
                {/* QR data dots */}
                <rect x="60" y="60" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="72" y="60" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="84" y="60" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="60" y="72" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="84" y="72" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="60" y="84" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="72" y="84" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
                <rect x="84" y="84" width="8" height="8" rx="1" fill={`rgb(${a.r},${a.g},${a.b})`} />
              </motion.svg>
            </div>

            {/* Slowly rotating rings (cyber aesthetic) */}
            <motion.div
              className="pointer-events-none absolute z-[7] rounded-full"
              style={{ inset: '18%', border: `1px dashed ${ac},0.18)` }}
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="pointer-events-none absolute z-[7] rounded-full"
              style={{ inset: '27%', border: `1px dashed ${ac},0.10)` }}
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />

            {/* Neon corner brackets */}
            <div className="pointer-events-none absolute inset-0 z-10">
              {CORNER_CLASSES.map((cls, i) => (
                <motion.div
                  key={i}
                  className={`absolute h-[13%] w-[13%] min-h-9 min-w-9 max-h-16 max-w-16 ${cls}`}
                  style={{
                    borderColor: `rgb(${a.r},${a.g},${a.b})`,
                    boxShadow: `0 0 10px 2px ${ac},0.75), 0 0 22px 5px ${ac},0.35), 0 0 40px 8px ${ac},0.15)`,
                  }}
                  animate={{ opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.65, ease: 'easeInOut' }}
                />
              ))}
            </div>

            {/* Subtle crosshair */}
            <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center">
              <div className="absolute h-[1px] w-[26%]" style={{ backgroundColor: `${ac},0.06)` }} />
              <div className="absolute h-[26%] w-[1px]" style={{ backgroundColor: `${ac},0.06)` }} />
            </div>

            {/* ── Primary scan beam with illuminated trail ── */}
            <motion.div
              className="pointer-events-none absolute left-0 right-0 z-10"
              animate={{ top: ['2%', '98%', '2%'] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Trail above beam */}
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0, right: 0,
                height: 80,
                background: `linear-gradient(to bottom, transparent, ${ac},0.08))`,
              }} />
              {/* Main beam */}
              <div style={{
                height: 2,
                background: `linear-gradient(90deg, transparent 0%, ${ac},0.85) 15%, rgba(255,255,255,0.95) 50%, ${ac},0.85) 85%, transparent 100%)`,
                boxShadow: `0 0 8px 3px ${ac},0.7), 0 0 22px 6px ${ac},0.3), 0 0 44px 12px ${ac},0.12)`,
              }} />
              {/* Soft forward glow */}
              <div style={{
                height: 24,
                background: `linear-gradient(to bottom, ${ac},0.05), transparent)`,
              }} />
            </motion.div>

            {/* ── Secondary counter beam (thinner, subtler) ── */}
            <motion.div
              className="pointer-events-none absolute left-[8%] right-[8%] z-[9]"
              animate={{ top: ['97%', '3%', '97%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
            >
              <div style={{
                height: 1,
                background: `linear-gradient(90deg, transparent, ${ac},0.28) 25%, ${ac},0.45) 50%, ${ac},0.28) 75%, transparent)`,
                boxShadow: `0 0 5px 2px ${ac},0.22)`,
              }} />
            </motion.div>

            {/* ── Success flash overlay ── */}
            <AnimatePresence>
              {successFlash && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <motion.div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: `radial-gradient(circle, rgba(34,197,94,0.42) 0%, ${ac},0.22) 40%, transparent 75%)` }}
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 0] }}
                    transition={{ duration: 1 }}
                  />
                  <motion.div
                    className="flex h-[22%] w-[22%] min-h-14 min-w-14 max-h-24 max-w-24 items-center justify-center rounded-full bg-emerald-500/25 backdrop-blur-md"
                    style={{ boxShadow: '0 0 40px rgba(34,197,94,0.45), 0 0 80px rgba(34,197,94,0.18)' }}
                    initial={{ scale: 0, rotate: -180 }} animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                    transition={{ duration: 0.55, type: 'spring', stiffness: 200 }}
                  >
                    <Check className="h-[55%] w-[55%] text-emerald-400" strokeWidth={3} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Floating dust particles ── */}
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="pointer-events-none absolute z-[5] rounded-full"
                style={{
                  left: `${p.left}%`,
                  top:  `${p.top}%`,
                  width:  p.size,
                  height: p.size,
                  backgroundColor: `${ac},0.45)`,
                }}
                animate={{ y: [0, p.yOff, 0], x: [0, p.xOff, 0], opacity: [0, 0.65, 0], scale: [0.5, 2.2, 0.5] }}
                transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
              />
            ))}

            {/* ── Guidance text (idle state instruction) ── */}
            <AnimatePresence>
              {!successFlash && (
                <motion.div
                  className="pointer-events-none absolute inset-x-0 bottom-[8%] z-[11] flex flex-col items-center gap-0.5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.p
                    className="text-center font-semibold tracking-widest"
                    style={{ color: `${ac},0.55)`, fontSize: 'min(14px,2.2vw)' }}
                    animate={{ opacity: [0.5, 0.9, 0.5] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    כוון את המצלמה
                  </motion.p>
                  <motion.p
                    className="text-center font-medium tracking-wider"
                    style={{ color: `${ac},0.35)`, fontSize: 'min(12px,1.9vw)' }}
                    animate={{ opacity: [0.35, 0.7, 0.35] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                  >
                    לקוד QR של המשתתף
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Outer pulsing rings ── */}
          <motion.div
            className="pointer-events-none absolute -inset-1 rounded-3xl"
            style={{ borderWidth: 1, borderStyle: 'solid', borderColor: `${ac},0.16)` }}
            animate={{ opacity: [0, 0.7, 0], scale: [1, 1.02, 1.05] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="pointer-events-none absolute -inset-3 rounded-3xl"
            style={{ borderWidth: 1, borderStyle: 'solid', borderColor: `${ac},0.08)` }}
            animate={{ opacity: [0, 0.4, 0], scale: [1, 1.03, 1.07] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeOut', delay: 1.1 }}
          />
        </motion.div>

        {/* Separate mode: scanned item badges */}
        {mode === 'separate' && (scannedParticipant || scannedAction) && (
          <motion.div className="mt-5 flex gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${scannedParticipant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-game-card text-gray-500'}`}>
              {scannedParticipant && <Check size={12} />} משתתף {scannedParticipant ? `(${scannedParticipant})` : ''}
            </div>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${scannedAction ? 'bg-emerald-500/20 text-emerald-400' : 'bg-game-card text-gray-500'}`}>
              {scannedAction && <Check size={12} />} משימה {scannedAction ? `(${scannedAction})` : ''}
            </div>
          </motion.div>
        )}
      </div>
    )
  }
)

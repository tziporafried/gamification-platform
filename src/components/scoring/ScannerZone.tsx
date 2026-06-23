import { useMemo, forwardRef, useImperativeHandle, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Check } from 'lucide-react'
import type { QrScoringMode } from '@/types'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

interface ScannerZoneProps {
  mode: QrScoringMode
  successFlash: boolean
  accent: AccentRgb
}

export interface ScannerZoneRef { resetSeparateState: () => void }

export const ScannerZone = forwardRef<ScannerZoneRef, ScannerZoneProps>(
  function ScannerZone({ mode, successFlash, accent }, ref) {
    const [scannedParticipant, setScannedParticipant] = useState<string | null>(null)
    const [scannedAction, setScannedAction] = useState<string | null>(null)

    useImperativeHandle(ref, () => ({ resetSeparateState() { setScannedParticipant(null); setScannedAction(null) } }))

    const floatingParticles = useMemo(() => Array.from({ length: 14 }, () => ({
      left: 10 + Math.random() * 80, top: 10 + Math.random() * 80,
      yOffset: -30 - Math.random() * 30, xOffset: (Math.random() - 0.5) * 40,
      duration: 3 + Math.random() * 3, delay: Math.random() * 4, size: 1 + Math.random() * 2.5,
    })), [])

    const expandingRings = useMemo(() => [
      { delay: 0, maxSize: 700, color: 'rgba(34,197,94,0.35)' },
      { delay: 0.15, maxSize: 900, color: rgba(accent, 0.25) },
      { delay: 0.3, maxSize: 1100, color: 'rgba(34,197,94,0.15)' },
    ], [accent])

    const a = accent

    return (
      <div className="flex w-full max-w-full flex-col items-center justify-center">
        <motion.div className="relative mx-auto w-full max-w-[640px]" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 22 }}>

          {/* Ambient outer glow */}
          <motion.div className="pointer-events-none absolute rounded-3xl" style={{ inset: '-10%', background: `radial-gradient(circle, ${rgba(a, 0.18)} 0%, ${rgba(a, 0.05)} 50%, transparent 75%)` }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.97, 1.03, 0.97] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} />

          {/* Expanding rings on success */}
          <AnimatePresence>
            {successFlash && expandingRings.map((ring, i) => (
              <motion.div key={`ring-${i}`} className="pointer-events-none absolute left-1/2 top-1/2 z-30 rounded-full"
                style={{ borderWidth: 2, borderStyle: 'solid', borderColor: ring.color }}
                initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 0.9 }}
                animate={{ width: ring.maxSize, height: ring.maxSize, opacity: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 1.4, delay: ring.delay, ease: 'easeOut' }} />
            ))}
          </AnimatePresence>

          {/* Glow burst on success */}
          <AnimatePresence>
            {successFlash && (
              <motion.div className="pointer-events-none absolute left-1/2 top-1/2 z-20 rounded-full"
                style={{ background: `radial-gradient(circle, rgba(34,197,94,0.45) 0%, ${rgba(a, 0.2)} 35%, transparent 70%)` }}
                initial={{ width: 0, height: 0, x: '-50%', y: '-50%', opacity: 1 }}
                animate={{ width: 1000, height: 1000, opacity: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }} />
            )}
          </AnimatePresence>

          {/* ===== SCANNER FRAME ===== */}
          <div className="relative mx-auto aspect-square w-[min(100%,640px,min(92vw,48dvh))] overflow-hidden rounded-2xl bg-game-dark/80 backdrop-blur-sm sm:rounded-3xl lg:w-[min(100%,640px,min(52vw,62dvh))]"
            style={{ borderWidth: 2, borderStyle: 'solid', borderColor: rgba(a, 0.3) }}>

            {/* Pulsing QR icon */}
            <div className="absolute inset-0 z-0 flex items-center justify-center">
              <motion.div className="w-[34%]" animate={{ opacity: [0.12, 0.28, 0.12], scale: [0.92, 1.08, 0.92] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
                <QrCode className="h-auto w-full max-w-[180px] min-w-[72px]" style={{ color: rgba(a, 0.2) }} />
              </motion.div>
            </div>

            {/* Corner frames */}
            <div className="pointer-events-none absolute inset-0 z-10">
              {[
                'left-2 top-2 rounded-tl-xl border-l-[3px] border-t-[3px]',
                'right-2 top-2 rounded-tr-xl border-r-[3px] border-t-[3px]',
                'bottom-2 left-2 rounded-bl-xl border-b-[3px] border-l-[3px]',
                'bottom-2 right-2 rounded-br-xl border-b-[3px] border-r-[3px]',
              ].map((cls, i) => (
                <motion.div key={i} className={`absolute h-[10%] w-[10%] min-h-8 min-w-8 max-h-12 max-w-12 ${cls}`}
                  style={{ borderColor: rgba(a, 0.8) }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }} />
              ))}
            </div>

            {/* Crosshair */}
            <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center">
              <div className="absolute h-[1px] w-[30%]" style={{ backgroundColor: rgba(a, 0.08) }} />
              <div className="absolute h-[30%] w-[1px]" style={{ backgroundColor: rgba(a, 0.08) }} />
            </div>

            {/* Scan line */}
            <motion.div className="pointer-events-none absolute left-3 right-3 z-10 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${rgba(a, 0.7)} 15%, ${rgba(a, 1)} 50%, ${rgba(a, 0.7)} 85%, transparent 100%)`,
                boxShadow: `0 0 16px 4px ${rgba(a, 0.5)}, 0 0 40px 8px ${rgba(a, 0.2)}`,
              }}
              animate={{ top: ['8%', '92%', '8%'] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} />

            {/* Second scan line */}
            <motion.div className="pointer-events-none absolute left-6 right-6 z-10 h-[1px]"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.3) 30%, rgba(6,182,212,0.5) 50%, rgba(6,182,212,0.3) 70%, transparent 100%)',
                boxShadow: '0 0 8px 2px rgba(6,182,212,0.2)',
              }}
              animate={{ top: ['85%', '15%', '85%'] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }} />

            {/* Success flash inside */}
            <AnimatePresence>
              {successFlash && (
                <motion.div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <motion.div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle, rgba(34,197,94,0.4) 0%, ${rgba(a, 0.25)} 40%, transparent 75%)` }}
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 0] }} transition={{ duration: 1 }} />
                  <motion.div className="flex h-[22%] w-[22%] min-h-14 min-w-14 max-h-24 max-w-24 items-center justify-center rounded-full bg-emerald-500/25 backdrop-blur-md"
                    style={{ boxShadow: '0 0 40px rgba(34,197,94,0.4), 0 0 80px rgba(34,197,94,0.15)' }}
                    initial={{ scale: 0, rotate: -180 }} animate={{ scale: [0, 1.3, 1], rotate: 0 }} transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}>
                    <Check className="h-[55%] w-[55%] text-emerald-400" strokeWidth={3} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating particles */}
            {floatingParticles.map((p, i) => (
              <motion.div key={i} className="pointer-events-none absolute z-[5] rounded-full"
                style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, backgroundColor: rgba(a, 0.3) }}
                animate={{ y: [0, p.yOffset, 0], x: [0, p.xOffset, 0], opacity: [0, 0.5, 0], scale: [0.5, 1.8, 0.5] }}
                transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }} />
            ))}
          </div>

          {/* Pulsing rings */}
          <motion.div className="pointer-events-none absolute -inset-1 rounded-3xl"
            style={{ borderWidth: 1, borderStyle: 'solid', borderColor: rgba(a, 0.15) }}
            animate={{ opacity: [0, 0.6, 0], scale: [1, 1.02, 1.04] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }} />
          <motion.div className="pointer-events-none absolute -inset-3 rounded-3xl"
            style={{ borderWidth: 1, borderStyle: 'solid', borderColor: rgba(a, 0.08) }}
            animate={{ opacity: [0, 0.3, 0], scale: [1, 1.03, 1.06] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut', delay: 0.8 }} />
        </motion.div>

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

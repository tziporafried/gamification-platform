import { motion, useReducedMotion } from 'framer-motion'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { Brand, HERO_EASE_OUT, HERO_SECTION_CLASS, heroFadeUp, heroStagger } from './shared'

/**
 * Hanukkah opening section: the Gamify logo, a menorah whose candles light one
 * after another, and holiday copy - in the same fonts as the regular hero.
 */

const GOLD = '#E0A526'
const GOLD_DEEP = '#B47A0E'
const CANDLE_BLUE = '#4F7FE0'

/** Candle x positions; index 4 is the shamash in the middle. */
const CANDLE_X = [40, 70, 100, 130, 160, 190, 220, 250, 280]
const SHAMASH = 4
const BAR_Y = 104

function Flame({ x, top, delay, motionSafe }: { x: number; top: number; delay: number; motionSafe: boolean }) {
  const d = `M ${x} ${top - 26} C ${x + 8} ${top - 14}, ${x + 7} ${top - 3}, ${x} ${top - 2} C ${x - 7} ${top - 3}, ${x - 8} ${top - 14}, ${x} ${top - 26} Z`
  const inner = `M ${x} ${top - 16} C ${x + 4} ${top - 9}, ${x + 3} ${top - 4}, ${x} ${top - 3} C ${x - 3} ${top - 4}, ${x - 4} ${top - 9}, ${x} ${top - 16} Z`
  return (
    <motion.g
      style={{ transformOrigin: `${x}px ${top}px`, transformBox: 'view-box' }}
      initial={motionSafe ? { opacity: 0, scale: 0.2 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: HERO_EASE_OUT }}
    >
      <circle cx={x} cy={top - 13} r={19} fill="url(#hero-hanukkah-glow)" />
      <motion.g
        style={{ transformOrigin: `${x}px ${top}px`, transformBox: 'view-box' }}
        animate={motionSafe ? { scaleY: [1, 1.12, 0.94, 1.06, 1], rotate: [0, -3, 2, -1, 0] } : undefined}
        transition={{ delay: delay + 0.45, duration: 1.6 + (x % 3) * 0.25, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d={d} fill="url(#hero-hanukkah-flame)" stroke="#C2410C" strokeWidth={0.9} strokeOpacity={0.55} />
        <path d={inner} fill="#FFF6D6" />
      </motion.g>
    </motion.g>
  )
}

function Menorah({ motionSafe }: { motionSafe: boolean }) {
  return (
    <svg viewBox="0 0 320 210" className="h-auto w-[220px] sm:w-[260px]" role="img" aria-label="חנוכיה דולקת">
      <defs>
        <linearGradient id="hero-hanukkah-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
        <linearGradient id="hero-hanukkah-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FF7A1A" />
          <stop offset="60%" stopColor="#FFB627" />
          <stop offset="100%" stopColor="#FFE07A" />
        </linearGradient>
        <radialGradient id="hero-hanukkah-glow">
          <stop offset="0%" stopColor="#FFC94D" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFC94D" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Base and stem */}
      <path d="M 118 200 L 202 200 L 186 184 L 134 184 Z" fill="url(#hero-hanukkah-gold)" />
      <rect x={154} y={BAR_Y} width={12} height={82} rx={3} fill="url(#hero-hanukkah-gold)" />
      {/* Arms bar */}
      <rect x={26} y={BAR_Y} width={268} height={9} rx={4.5} fill="url(#hero-hanukkah-gold)" />
      {/* Shamash riser */}
      <rect x={150} y={BAR_Y - 22} width={20} height={24} rx={4} fill="url(#hero-hanukkah-gold)" />

      {CANDLE_X.map((x, i) => {
        const isShamash = i === SHAMASH
        const base = isShamash ? BAR_Y - 22 : BAR_Y
        const height = isShamash ? 46 : 40
        const top = base - height
        // Shamash first, then the eight candles one after another.
        const order = isShamash ? 0 : (i < SHAMASH ? i : i - 1) + 1
        return (
          <g key={x}>
            <rect x={x - 9} y={base - 4} width={18} height={6} rx={2} fill={GOLD_DEEP} />
            <rect
              x={x - 6}
              y={top}
              width={12}
              height={height - 3}
              rx={2.5}
              fill={isShamash ? '#FFFFFF' : i % 2 === 0 ? CANDLE_BLUE : '#FFFFFF'}
              stroke={CANDLE_BLUE}
              strokeOpacity={0.45}
            />
            <line x1={x} y1={top} x2={x} y2={top - 4} stroke="#3A2A1A" strokeWidth={1.5} strokeLinecap="round" />
            <Flame x={x} top={top - 2} delay={0.5 + order * 0.22} motionSafe={motionSafe} />
          </g>
        )
      })}
    </svg>
  )
}

export function HanukkahHero() {
  const motionSafe = !useReducedMotion()

  return (
    <motion.section
      className={HERO_SECTION_CLASS}
      variants={heroStagger}
      initial={motionSafe ? 'hidden' : false}
      animate="visible"
    >
      <motion.div
        variants={heroFadeUp}
        transition={{ duration: 0.55, ease: HERO_EASE_OUT }}
        className="mb-5 flex justify-center"
      >
        <motion.div
          animate={motionSafe ? { y: [0, -10, 0], rotate: [0, -2.5, 2.5, 0] } : undefined}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandLogo className="h-28 w-28 sm:h-36 sm:w-36 drop-shadow-[0_12px_28px_rgba(171,53,0,0.28)]" />
        </motion.div>
      </motion.div>

      <motion.div
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-4 flex justify-center"
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold"
          style={{
            color: GOLD_DEEP,
            backgroundColor: 'color-mix(in srgb, #E0A526 14%, transparent)',
            border: '1px solid color-mix(in srgb, #E0A526 45%, transparent)',
          }}
        >
          ✨ מהדורת חנוכה
        </span>
      </motion.div>

      <motion.div
        variants={heroFadeUp}
        transition={{ duration: 0.55, ease: HERO_EASE_OUT }}
        className="mb-6 flex justify-center drop-shadow-[0_14px_30px_rgba(224,165,38,0.35)]"
      >
        <Menorah motionSafe={motionSafe} />
      </motion.div>

      <motion.h1
        variants={heroFadeUp}
        transition={{ duration: 0.55, ease: HERO_EASE_OUT }}
        className="mb-5 text-[34px] font-black leading-[1.2] text-foreground sm:text-[42px]"
      >
        שמונה ערבי חנוכה,
        <br />
        כל המשפחה ביחד,
        <br />
        ומי דואג שיהיה <Brand>שמח</Brand>?
      </motion.h1>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-4 text-lg leading-[1.6] text-foreground"
      >
        אחרי הסופגנייה השנייה וסיבוב הסביבון השלישי, תמיד מגיע הרגע ש...
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-5 text-xl font-bold italic text-muted"
      >
        "משעמם לי... יש עוד משהו לעשות?"
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-5 text-[26px] font-black leading-[1.3] text-foreground sm:text-[30px]"
      >
        עם <Brand>Gamify</Brand> כל נר פותח שלב חדש.
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mx-auto mb-6 max-w-[520px] text-[17px] leading-[1.7] text-foreground"
      >
        משחק חנוכה משפחתי עם משימות, חידות ואתגרים: סורקים כרטיס, צוברים נקודות, פותחים פרסים - ולוח
        האלופים מתעדכן מנר לנר. מתאים למסיבת חנוכה בבית, בגן, בכיתה או בקהילה.
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mx-auto mb-0 max-w-[520px] text-base font-bold leading-[1.6]"
        style={{ color: GOLD_DEEP, textShadow: '0 0 18px rgba(224,165,38,0.35)' }}
      >
        יותר אור, יותר צחוק, וזיכרונות שנשארים גם אחרי שהנרות כבים.
      </motion.p>
    </motion.section>
  )
}

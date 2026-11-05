import { motion, useReducedMotion } from 'framer-motion'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { Brand, HERO_EASE_OUT, HERO_SECTION_CLASS, heroFadeUp, heroStagger } from './shared'

/** Family vacation opening section - the year-round default. */
export function FamilyVacationHero() {
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
        className="mb-6 flex justify-center"
      >
        <motion.div
          animate={motionSafe ? { y: [0, -10, 0], rotate: [0, -2.5, 2.5, 0] } : undefined}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandLogo className="h-28 w-28 sm:h-36 sm:w-36 drop-shadow-[0_12px_28px_rgba(171,53,0,0.28)]" />
        </motion.div>
      </motion.div>

      <motion.h1
        variants={heroFadeUp}
        transition={{ duration: 0.55, ease: HERO_EASE_OUT }}
        className="mb-5 text-[34px] font-black leading-[1.2] text-foreground sm:text-[42px]"
      >
        סבתא? דודה?
        <br />
        אחראית על ה-
        <Brand>Vibe</Brand>
        {' '}בנופש המשפחתי?
      </motion.h1>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-4 text-lg leading-[1.6] text-foreground"
      >
        מכירים את הרגע בנופש שמישהו אומר...
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-5 text-xl font-bold italic text-muted"
      >
        "טוב... אז מה עושים עכשיו?"
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mb-5 text-[26px] font-black leading-[1.3] text-foreground sm:text-[30px]"
      >
        עם{' '}
        <Brand>Gamify</Brand>
        {' '}זה פשוט לא קורה.
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mx-auto mb-6 max-w-[500px] text-[17px] leading-[1.7] text-foreground"
      >
        הופכים את כל הנופש לכיף אחד גדול עם משימות, אתגרים, תחרויות, ניקוד, פרסים ולוח אלופים שכווווולם רוצים לכבוש.
      </motion.p>

      <motion.p
        variants={heroFadeUp}
        transition={{ duration: 0.5, ease: HERO_EASE_OUT }}
        className="mx-auto mb-0 max-w-[500px] text-base font-bold leading-[1.6] text-primary-text [text-shadow:0_0_18px_rgba(171,53,0,0.35)]"
      >
        פחות שעמום, יותר צחוק, יותר גיבוש, ורגעים שלא שוכחים.
      </motion.p>
    </motion.section>
  )
}

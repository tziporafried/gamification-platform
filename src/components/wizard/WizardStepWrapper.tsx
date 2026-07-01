import { useEffect, useLayoutEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getWizardStepId } from '@/lib/wizard'
import { useWizardChrome } from './WizardChromeContext'
import { WizardFooterDots } from './WizardFooterDots'

interface WizardStepWrapperProps {
  title: string
  subtitle?: string
  currentStep: number
  totalSteps?: number
  canAdvance?: boolean
  onNext?: () => void
  onBack?: () => void
  nextLabel?: string
  backLabel?: string
  children: React.ReactNode
  footerBar?: React.ReactNode
}

export function WizardStepWrapper({
  title,
  subtitle,
  currentStep,
  totalSteps = 6,
  canAdvance = true,
  onNext,
  onBack,
  nextLabel,
  backLabel = 'חזור',
  children,
  footerBar,
}: WizardStepWrapperProps) {
  const { currentStep: activeStep, wizardState, hasIntroPlayed, markIntroPlayed } = useWizardChrome()
  const isActive = activeStep === currentStep
  const stepId = getWizardStepId(currentStep)
  const isIncomplete = stepId ? wizardState[stepId] !== 'completed' : false
  const [playIntro, setPlayIntro] = useState(false)

  useLayoutEffect(() => {
    if (!isActive) {
      setPlayIntro(false)
      return
    }

    if (hasIntroPlayed(currentStep)) {
      setPlayIntro(false)
      return
    }

    if (!isIncomplete) {
      markIntroPlayed(currentStep)
      setPlayIntro(false)
      return
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      markIntroPlayed(currentStep)
      setPlayIntro(false)
      return
    }

    setPlayIntro(true)
  }, [isActive, isIncomplete, currentStep, hasIntroPlayed, markIntroPlayed])

  useEffect(() => {
    if (!playIntro) return

    const fallback = window.setTimeout(() => {
      markIntroPlayed(currentStep)
      setPlayIntro(false)
    }, 2000)

    return () => window.clearTimeout(fallback)
  }, [playIntro, currentStep, markIntroPlayed])

  function handleIntroComplete(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    markIntroPlayed(currentStep)
    setPlayIntro(false)
  }

  const isFirst = currentStep === 1
  const isLast = currentStep === totalSteps

  return (
    <>
      <div className="flex h-full flex-col pb-[var(--wizard-footer-bar-height)]">
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-[var(--wizard-chrome-gap-top)] sm:px-4 sm:pt-0">
          <div className="relative mb-[var(--wizard-chrome-gap-bottom)] flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] bg-surface-elevated shadow-wizard-panel">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full blur-3xl"
                style={{ background: 'var(--gradient-wizard-panel-orb-primary)' }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full blur-3xl"
                style={{ background: 'var(--gradient-wizard-panel-orb-secondary)' }}
              />
              <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-8 sm:py-6">
                <div className="shrink-0 space-y-2 pb-4 text-center sm:pb-5">
                  <h2
                    className={cn(
                      'text-2xl font-bold tracking-tight text-foreground sm:text-3xl',
                      playIntro && 'animate-wizard-title-wow motion-reduce:animate-none',
                    )}
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      className={cn(
                        'mx-auto max-w-md text-sm leading-relaxed text-foreground/75 sm:text-base',
                        playIntro && 'animate-wizard-subtitle-in motion-reduce:animate-none',
                      )}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>

                <div
                  className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    playIntro && 'animate-wizard-content-in motion-reduce:animate-none',
                  )}
                  onAnimationEnd={playIntro ? handleIntroComplete : undefined}
                >
                  {children}

                  {footerBar && <div className="shrink-0">{footerBar}</div>}
                </div>
              </div>
          </div>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 w-full bg-surface/90 py-4 shadow-[0_-4px_12px_rgba(171,53,0,0.08)] backdrop-blur-[20px]">
        <div className="mx-auto grid w-[80%] grid-cols-3 items-center gap-2">
          {/* RTL col-1 → visual right: back link */}
          <div className="flex justify-start">
            {!isFirst && onBack ? (
              <button
                type="button"
                dir="ltr"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-1 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {backLabel}
                <ArrowRight size={16} className="shrink-0" strokeWidth={2} />
              </button>
            ) : null}
          </div>

          {/* center: step dots */}
          <div className="flex justify-center">
            <WizardFooterDots />
          </div>

          {/* RTL col-3 → visual left: primary pill CTA */}
          <div className="flex justify-end">
            {onNext && (
              <Button
                variant="primary"
                size="lg"
                dir="ltr"
                className="gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-[0_4px_14px_-2px_rgba(171,53,0,0.35)] text-[var(--color-on-primary)] [&_svg]:text-[var(--color-on-primary)]"
                onClick={onNext}
                disabled={!canAdvance}
              >
                {!isLast && <ArrowLeft size={16} className="shrink-0" strokeWidth={2.5} />}
                {nextLabel ?? (isLast ? 'סיום' : 'המשך')}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </>
  )
}

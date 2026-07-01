import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  const isFirst = currentStep === 1
  const isLast = currentStep === totalSteps

  return (
    <>
      <div className="flex h-full flex-col animate-fade-in-up pb-[4.5rem]">
        <div className="flex min-h-0 flex-1 flex-col px-2 pt-4 sm:px-3 sm:pt-6">
          <div className="relative mb-6 flex min-h-0 flex-1 flex-col rounded-[2rem] shadow-wizard-panel sm:mb-8">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] bg-surface-elevated">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl"
                style={{ background: 'var(--gradient-wizard-panel-orb-primary)' }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-3xl"
                style={{ background: 'var(--gradient-wizard-panel-orb-secondary)' }}
              />
              <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-10 sm:py-10">
                <div className="shrink-0 space-y-2 pb-8 text-center">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
                  {subtitle && (
                    <p className="mx-auto max-w-md text-sm leading-relaxed text-foreground/75 sm:text-base">
                      {subtitle}
                    </p>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  {children}
                </div>

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
            <WizardFooterDots currentStep={currentStep} />
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

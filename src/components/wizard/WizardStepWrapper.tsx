import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ScrollContainer } from '@/components/ui/ScrollContainer'

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
  backLabel = 'חזרה',
  children,
  footerBar,
}: WizardStepWrapperProps) {
  const isFirst = currentStep === 1
  const isLast = currentStep === totalSteps

  return (
    <div className="flex h-full flex-col animate-fade-in-up">
      <div className="shrink-0 space-y-1 pt-8 pb-6">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>

      <ScrollContainer className="flex-1 pb-4 pl-1 pr-0">
        {children}
      </ScrollContainer>

      {footerBar && <div className="shrink-0">{footerBar}</div>}

      <div className="shrink-0 flex items-center justify-between border-t border-game-border bg-game-dark py-4">
        {!isFirst ? (
          <Button variant="ghost" size="lg" onClick={onBack}>
            <ArrowRight size={18} className="ml-2" />
            {backLabel}
          </Button>
        ) : (
          <div />
        )}

        {onNext && (
          <Button variant="gradient" size="lg" onClick={onNext} disabled={!canAdvance}>
            {nextLabel ?? (isLast ? 'סיום' : 'המשך')}
            {!isLast && <ArrowLeft size={18} className="mr-2" />}
          </Button>
        )}
      </div>
    </div>
  )
}

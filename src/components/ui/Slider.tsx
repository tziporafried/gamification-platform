import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  showValue?: boolean
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, showValue, value, id, ...props }, ref) => (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <label htmlFor={id} className={cn('text-sm font-medium', theme.label)}>{label}</label>}
          {showValue && <span className={cn('text-xs tabular-nums', theme.textSubtle)}>{value}</span>}
        </div>
      )}
      <input
        ref={ref}
        id={id}
        type="range"
        value={value}
        className={cn(
          'w-full h-2 appearance-none rounded-full cursor-pointer bg-border accent-primary',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-md',
          className,
        )}
        {...props}
      />
    </div>
  ),
)

Slider.displayName = 'Slider'

import { useState, useEffect, forwardRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from 'renderer/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  disabled = false,
  className,
  triggerClassName,
  contentClassName
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  
  const selectedOption = options.find(option => option.value === value)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      // Use setTimeout to avoid immediate closure on the same click
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    if (disabled) return
    
    onValueChange?.(optionValue)
    setIsOpen(false)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        ref={ref}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'hover:bg-accent/50 transition-colors duration-200',
          disabled && 'cursor-not-allowed opacity-50',
          triggerClassName
        )}
      >
        <span className={cn(
          'truncate',
          !selectedOption && 'text-muted-foreground'
        )}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className={cn(
          'absolute top-full mt-1 z-50 w-full min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          contentClassName
        )}>
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                    'transition-colors duration-150',
                    option.disabled && 'pointer-events-none opacity-50',
                    value === option.value && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="flex-1 truncate text-left">
                    {option.label}
                  </span>
                  {value === option.value && (
                    <Check className="h-4 w-4 shrink-0 ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
})

Select.displayName = 'Select'
import { motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from './button'
import { cn } from 'renderer/lib/utils'

export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss: (id: string) => void
}

const toastVariants = {
  initial: { opacity: 0, x: 400, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 400, scale: 0.95, transition: { duration: 0.2 } }
}

export function Toast({
  id,
  type,
  title,
  message,
  duration = 5000,
  action,
  onDismiss
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Auto-dismiss after duration
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration])

  const handleDismiss = () => {
    setIsVisible(false)
    // Delay actual removal to allow exit animation
    setTimeout(() => {
      onDismiss(id)
    }, 200)
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getStyles = () => {
    const baseStyles = "border-l-4"
    
    switch (type) {
      case 'success':
        return cn(baseStyles, "border-green-400")
      case 'error':
        return cn(baseStyles, "border-red-400")
      case 'warning':
        return cn(baseStyles, "border-yellow-400")
      case 'info':
        return cn(baseStyles, "border-blue-400")
      default:
        return cn(baseStyles, "border-blue-400")
    }
  }

  if (!isVisible) return null

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-lg shadow-lg border border-border max-w-sm w-full",
        getStyles()
      )}
      style={{ backgroundColor: 'hsl(var(--toast-background))' }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 pt-0.5">
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            {message && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {message}
              </p>
            )}
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        {/* Action Button */}
        {action && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                action.onClick()
                handleDismiss()
              }}
              className="text-xs h-7 px-3"
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default Toast
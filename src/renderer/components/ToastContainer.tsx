import { AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

import { Toast } from './ui/toast'
import { useUIContext } from '../contexts'

export function ToastContainer() {
  const { notifications, dismissNotification } = useUIContext()

  // Create portal to render toasts at document level
  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <Toast
              id={notification.id}
              type={notification.type}
              title={notification.title}
              message={notification.message}
              duration={notification.duration}
              action={notification.action}
              onDismiss={dismissNotification}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export default ToastContainer
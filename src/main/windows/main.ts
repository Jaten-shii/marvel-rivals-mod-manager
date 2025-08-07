import { BrowserWindow, app } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'

export async function MainWindow() {
  const window = createWindow({
    id: 'main',
    title: displayName,
    width: 1380,
    height: 915,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    center: true,
    movable: true,
    resizable: true,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.ico'),

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // Allow local file access for drag & drop
      allowRunningInsecureContent: true,  // Support local file operations
      navigateOnDragDrop: false,  // Prevent navigation on file drops
    },
  })

  // Enhanced environment detection for bulletproof production safety
  const isDevelopment = (
    ENVIRONMENT.IS_DEV &&
    !app.isPackaged &&
    (process.env.NODE_ENV === 'development') &&
    (process.env.ELECTRON_IS_DEV !== 'false')
  )

  const isProduction = (
    app.isPackaged ||
    ENVIRONMENT.IS_PRODUCTION ||
    (process.env.NODE_ENV === 'production') ||
    (process.env.ELECTRON_IS_DEV === 'false')
  )

  // Force dev tools for debugging (can be controlled via environment)
  const forceDevTools = process.env.FORCE_DEVTOOLS === 'true' || 
                       (process.env.NODE_ENV === 'development' && !app.isPackaged)

  console.log('Environment Detection:', {
    isDevelopment,
    isProduction,
    forceDevTools,
    isPackaged: app.isPackaged,
    nodeEnv: process.env.NODE_ENV,
    electronIsDev: process.env.ELECTRON_IS_DEV
  })

  window.webContents.on('did-finish-load', () => {
    console.log('Main window finished loading')
    
    // Multiple safety checks to prevent DevTools in production
    if ((isDevelopment && !isProduction) || forceDevTools) {
      console.log('Opening DevTools (development mode or forced)')
      window.webContents.openDevTools({ mode: 'detach' })
    } else {
      console.log('Production mode detected - DevTools disabled')
    }

    window.show()
  })

  // Development fallback: ensure window shows and DevTools opens if needed
  if ((isDevelopment && !isProduction) || forceDevTools) {
    setTimeout(() => {
      if (!window.isVisible()) {
        console.log('Window not shown yet, forcing show and DevTools')
        window.show()
        window.webContents.openDevTools({ mode: 'detach' })
      }
    }, 3000) // 3 second fallback
  } else {
    // Production safety: ensure window shows without DevTools
    setTimeout(() => {
      if (!window.isVisible()) {
        console.log('Production fallback: showing window without DevTools')
        window.show()
      }
    }, 3000)
  }

  window.on('close', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy()
    }
  })

  return window
}

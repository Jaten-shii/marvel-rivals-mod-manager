import { app } from 'electron'

import { makeAppWithSingleInstanceLock } from 'lib/electron-app/factories/app/instance'
import { makeAppSetup } from 'lib/electron-app/factories/app/setup'
import { MainWindow } from './windows/main'
import { registerModHandlers } from './ipc/mod-handlers'
import { registerSystemHandlers } from './ipc/system-handlers'
import { registerThumbnailHandlers } from './ipc/thumbnail-handlers'
import { registerChangelogHandlers } from './ipc/changelog-handlers'
import { protocolHandler } from './services/ProtocolHandler'

// Initialize protocol handler before app is ready
protocolHandler.initialize()

// Register all IPC handlers
registerModHandlers()
registerSystemHandlers()
registerThumbnailHandlers()
registerChangelogHandlers()

makeAppWithSingleInstanceLock(async () => {
  await app.whenReady()
  
  // Register the protocol handler after app is ready
  await protocolHandler.register()
  
  await makeAppSetup(MainWindow)
})

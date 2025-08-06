import type { Configuration } from 'electron-builder'

import {
  main,
  name,
  version,
  resources,
  description,
  displayName,
  author as _author,
} from './package.json'

import { getDevFolder } from './src/lib/electron-app/release/utils/path'

const author = _author?.name ?? _author
const currentYear = new Date().getFullYear()
const appId = 'com.marvelrivals.modmanager'

const artifactName = [`${name}-v${version}`, '-${os}.${ext}'].join('')

export default {
  appId,
  productName: displayName,
  copyright: `Copyright © ${currentYear} — ${author}`,

  directories: {
    app: getDevFolder(main),
    output: `dist/v${version}`,
  },

  mac: {
    artifactName,
    icon: `${resources}/build/icons/icon.icns`,
    category: 'public.app-category.utilities',
    target: ['zip', 'dmg', 'dir'],
  },

  linux: {
    artifactName,
    category: 'Utilities',
    synopsis: description,
    target: ['AppImage', 'deb', 'pacman', 'freebsd', 'rpm'],
  },

  win: {
    artifactName,
    icon: `Assets/icon.png`,
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      'zip'
    ],
    publisherName: 'Marvel Rivals Mod Manager'
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    menuCategory: 'Gaming',
    installerIcon: `Assets/icon.png`,
    uninstallerIcon: `Assets/icon.png`,
    installerHeaderIcon: `Assets/icon.png`,
    deleteAppDataOnUninstall: false,
    displayLanguageSelector: false,
    runAfterFinish: true
  },

  fileAssociations: [
    {
      ext: 'pak',
      name: 'Marvel Rivals Mod File',
      description: 'Marvel Rivals Mod Package',
      icon: `Assets/icon.png`,
      role: 'Editor'
    }
  ],
} satisfies Configuration

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { resolve, normalize, dirname } from 'node:path'
import tailwindcss from '@tailwindcss/vite'

import injectProcessEnvPlugin from 'rollup-plugin-inject-process-env'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import reactPlugin from '@vitejs/plugin-react'

import { settings } from './src/lib/electron-router-dom'
import { main, resources } from './package.json'

const [nodeModules, devFolder] = normalize(dirname(main)).split(/\/|\\/g)
const devPath = [nodeModules, devFolder].join('/')

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

export default defineConfig({
  main: {
    plugins: [
      tsconfigPaths, 
      externalizeDepsPlugin(),
    ],

    build: {
      rollupOptions: {
        plugins: [
          injectProcessEnvPlugin({
            NODE_ENV: 'production',
            ELECTRON_IS_DEV: 'false',
            ELECTRON_IS_PACKAGED: 'true',
          }),
        ],
        
        input: {
          index: resolve('src/main/index.ts'),
        },
        
        // Externalize native dependencies that shouldn't be bundled
        external: ['sharp'],

        output: {
          dir: resolve(devPath, 'main'),
        },
      },
    },
  },

  preload: {
    plugins: [tsconfigPaths, externalizeDepsPlugin()],

    build: {
      rollupOptions: {
        plugins: [
          injectProcessEnvPlugin({
            NODE_ENV: 'production',
            ELECTRON_IS_DEV: 'false',
            ELECTRON_IS_PACKAGED: 'true',
          }),
        ],
      },
      outDir: resolve(devPath, 'preload'),
    },
  },

  renderer: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.platform': JSON.stringify(process.platform),
    },

    server: {
      port: settings.port,
    },

    plugins: [
      tsconfigPaths,
      tailwindcss(),
      reactPlugin(),

      codeInspectorPlugin({
        bundler: 'vite',
        hotKeys: ['altKey'],
        hideConsole: true,
      }),
    ],

    publicDir: resolve(resources, 'public'),

    build: {
      outDir: resolve(devPath, 'renderer'),

      rollupOptions: {
        plugins: [
          injectProcessEnvPlugin({
            NODE_ENV: 'production',
            ELECTRON_IS_DEV: 'false',
            ELECTRON_IS_PACKAGED: 'true',
            platform: process.platform,
          }),
        ],

        input: {
          index: resolve('src/renderer/index.html'),
        },

        output: {
          dir: resolve(devPath, 'renderer'),
        },
      },
    },
  },
})

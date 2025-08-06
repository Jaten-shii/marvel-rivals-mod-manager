#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist')

try {
  if (!fs.existsSync(distDir)) {
    console.log('✅ No dist directory found, nothing to clean')
    process.exit(0)
  }

  const files = fs.readdirSync(distDir)
  const toDelete = files.filter(file => 
    file.endsWith('.exe') || 
    file.endsWith('.blockmap') || 
    file.endsWith('.yml')
  )

  console.log(`🧹 Cleaning installer files from dist/`)
  
  if (toDelete.length === 0) {
    console.log('✅ No installer files found to clean')
    process.exit(0)
  }

  toDelete.forEach(file => {
    const fullPath = path.join(distDir, file)
    try {
      fs.unlinkSync(fullPath)
      console.log(`   Deleted: ${file}`)
    } catch (error) {
      console.warn(`   Warning: Could not delete ${file}: ${error.message}`)
    }
  })

  console.log(`✅ Cleaned ${toDelete.length} installer files`)
} catch (error) {
  // Silently fail if dist directory doesn't exist or other issues
  console.log('✅ No installer files to clean')
}
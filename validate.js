#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Marvel Rivals Mod Manager - Validation Script');
console.log('================================================\n');

let errors = 0;
let warnings = 0;

function logError(message) {
  console.log(`❌ ERROR: ${message}`);
  errors++;
}

function logWarning(message) {
  console.log(`⚠️  WARNING: ${message}`);
  warnings++;
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function checkFileExists(filePath, required = true) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    logSuccess(`File exists: ${filePath}`);
    return true;
  } else {
    if (required) {
      logError(`Missing required file: ${filePath}`);
    } else {
      logWarning(`Optional file missing: ${filePath}`);
    }
    return false;
  }
}

function checkDirectory(dirPath, required = true) {
  const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  if (exists) {
    logSuccess(`Directory exists: ${dirPath}`);
    return true;
  } else {
    if (required) {
      logError(`Missing required directory: ${dirPath}`);
    } else {
      logWarning(`Optional directory missing: ${dirPath}`);
    }
    return false;
  }
}

// Check core project files
console.log('📋 Checking core project files...');
checkFileExists('package.json');
checkFileExists('tsconfig.json');

// Check source structure
console.log('\n📁 Checking source directory structure...');
checkDirectory('src');
checkDirectory('src/main');
checkDirectory('src/preload');
checkDirectory('src/renderer');
checkDirectory('src/shared');

// Check main process files
console.log('\n⚙️  Checking main process files...');
checkDirectory('src/main/services');
checkDirectory('src/main/ipc');
checkFileExists('src/main/services/ModService.ts');
checkFileExists('src/main/services/FileWatcher.ts');
checkFileExists('src/main/services/ArchiveExtractor.ts');
checkFileExists('src/main/services/SettingsManager.ts');

// Check shared files
console.log('\n🔗 Checking shared files...');
checkFileExists('src/shared/types.ts');
checkFileExists('src/shared/constants.ts');

// Check preload files
console.log('\n🌉 Checking preload files...');
checkFileExists('src/preload/index.ts');

// Check renderer files
console.log('\n🖥️  Checking renderer files...');
checkFileExists('src/renderer/index.tsx');
checkFileExists('src/renderer/routes.tsx');
checkFileExists('src/renderer/screens/main.tsx');

// Check components
console.log('\n🧩 Checking UI components...');
checkDirectory('src/renderer/components');
checkDirectory('src/renderer/components/ui');
checkFileExists('src/renderer/components/MainApplication.tsx');
checkFileExists('src/renderer/components/Sidebar.tsx');
checkFileExists('src/renderer/components/ModCard.tsx');
checkFileExists('src/renderer/components/DetailsPanel.tsx');
checkFileExists('src/renderer/components/Toolbar.tsx');

// Check contexts and hooks
console.log('\n🎯 Checking state management...');
checkDirectory('src/renderer/contexts');
checkDirectory('src/renderer/hooks');
checkFileExists('src/renderer/contexts/ModContext.tsx');
checkFileExists('src/renderer/contexts/SettingsContext.tsx');
checkFileExists('src/renderer/contexts/UIContext.tsx');
checkFileExists('src/renderer/contexts/AppProvider.tsx');
checkFileExists('src/renderer/hooks/useMods.ts');
checkFileExists('src/renderer/hooks/useSettings.ts');
checkFileExists('src/renderer/hooks/useTheme.ts');
checkFileExists('src/renderer/hooks/useFileWatcher.ts');

// Check styles
console.log('\n🎨 Checking styles...');
checkFileExists('src/renderer/globals.css');
checkFileExists('src/renderer/styles/themes.css');

// Check build configuration
console.log('\n🏗️  Checking build configuration...');
checkDirectory('build');
checkFileExists('build/installer.nsi');
checkFileExists('build/installer.nsh');
checkFileExists('build/license.txt');

// Check package.json configuration
console.log('\n📦 Checking package.json configuration...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.name === 'marvel-rivals-mod-manager') {
    logSuccess('Package name is correct');
  } else {
    logError('Package name is incorrect');
  }
  
  if (packageJson.build && packageJson.build.appId) {
    logSuccess('Electron builder configuration exists');
  } else {
    logError('Missing electron builder configuration');
  }
  
  if (packageJson.build && packageJson.build.win && packageJson.build.win.fileAssociations) {
    logSuccess('File associations configured');
  } else {
    logWarning('File associations not configured');
  }
  
  // Check dependencies
  const requiredDeps = [
    'react',
    'react-dom',
    'electron-router-dom',
    'framer-motion',
    'chokidar',
    'yauzl',
    'unzipper'
  ];
  
  for (const dep of requiredDeps) {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      logSuccess(`Dependency found: ${dep}`);
    } else {
      logError(`Missing dependency: ${dep}`);
    }
  }
  
} catch (error) {
  logError(`Failed to parse package.json: ${error.message}`);
}

// Check TypeScript types
console.log('\n🔍 Checking TypeScript types...');
try {
  const typesContent = fs.readFileSync('src/shared/types.ts', 'utf8');
  
  if (typesContent.includes('export type Theme')) {
    logSuccess('Theme type is defined');
  } else {
    logError('Theme type is missing');
  }
  
  if (typesContent.includes('export type ModCategory')) {
    logSuccess('ModCategory type is defined');
  } else {
    logError('ModCategory type is missing');
  }
  
  if (typesContent.includes('export interface ModInfo')) {
    logSuccess('ModInfo interface is defined');
  } else {
    logError('ModInfo interface is missing');
  }
  
} catch (error) {
  logError(`Failed to read types.ts: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
  console.log('🎉 All checks passed! The project is ready for production.');
} else {
  console.log(`❌ ${errors} error${errors !== 1 ? 's' : ''} found`);
  console.log(`⚠️  ${warnings} warning${warnings !== 1 ? 's' : ''} found`);
  
  if (errors > 0) {
    console.log('\n🚨 Please fix the errors before building for production.');
    process.exit(1);
  } else {
    console.log('\n✨ No critical errors found. Warnings should be addressed when possible.');
  }
}

console.log('\n🚀 To build the application:');
console.log('   pnpm run build');
console.log('\n📦 To create installer:');
console.log('   pnpm run build (creates Windows installer)');
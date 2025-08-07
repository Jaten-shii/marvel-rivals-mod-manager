const { promises: fs } = require('fs');
const path = require('path');

async function generateIcon() {
  try {
    // Dynamic import for ES module
    const pngToIco = (await import('png-to-ico')).default;
    
    console.log('🔧 Generating application icon from PNG sources...');
    
    // Define icon paths - using the actual Icons folder structure
    const iconPaths = [
      'build/Icons/icon-16.png',
      'build/Icons/icon-32.png',
      'build/Icons/icon-48.png',
      'build/Icons/icon-64.png',
      'build/Icons/icon-128.png',
      'build/Icons/icon-256.png',
    ];
    
    // Verify all PNG files exist
    console.log('📋 Checking PNG source files...');
    const missingFiles = [];
    
    for (const iconPath of iconPaths) {
      try {
        await fs.access(iconPath);
        const stats = await fs.stat(iconPath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`  ✅ ${iconPath} (${sizeKB} KB)`);
      } catch (error) {
        missingFiles.push(iconPath);
        console.log(`  ❌ ${iconPath} - File not found`);
      }
    }
    
    if (missingFiles.length > 0) {
      console.error(`\n❌ Error: Missing PNG files:`);
      missingFiles.forEach(file => console.error(`   - ${file}`));
      console.error('\n💡 Please ensure all PNG files are present in the build/Icons/ folder');
      process.exit(1);
    }
    
    console.log('\n🔄 Converting PNG files to ICO format...');
    
    // Convert PNG files to ICO
    const buffer = await pngToIco(iconPaths);
    
    // Write the ICO file
    const outputPath = 'build/icon.ico';
    await fs.writeFile(outputPath, buffer);
    
    // Verify the generated file
    const stats = await fs.stat(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    
    console.log(`\n✅ Icon generation completed successfully!`);
    console.log(`📁 Output: ${outputPath} (${sizeKB} KB)`);
    console.log(`🎨 Combined ${iconPaths.length} PNG files into multi-resolution ICO`);
    console.log('🚀 Ready for Electron build process\n');
    
  } catch (error) {
    console.error('\n❌ Icon generation failed:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('png-to-ico')) {
      console.error('\n💡 Solution: Install the png-to-ico dependency:');
      console.error('   pnpm add -D png-to-ico');
    }
    
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Ensure all PNG files exist in build/Icons/');
    console.error('   2. Check that png-to-ico is installed');
    console.error('   3. Verify PNG files are valid and not corrupted\n');
    
    process.exit(1);
  }
}

// Run the icon generation
generateIcon();
const fs = require('fs');
const path = require('path');

/**
 * This script runs after the app is packed but before it's bundled into an installer.
 * It removes unnecessary files to reduce the final bundle size.
 */
exports.default = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const appName = packager.appInfo.productFilename;
  
  console.log(`Optimizing bundle for ${electronPlatformName} at: ${appOutDir}`);
  
  // Directories to clean up (adjust as needed)
  const foldersToRemove = [];
  
  // Safely add locales if the directory exists
  const localesPath = path.join(appOutDir, 'locales');
  if (fs.existsSync(localesPath)) {
    try {
      const localeFiles = fs.readdirSync(localesPath)
        .filter(file => file !== 'en-US.pak' && file !== 'en-US.pak.info')
        .map(file => path.join(localesPath, file));
      
      foldersToRemove.push(...localeFiles);
      console.log(`Found ${localeFiles.length} locale files to remove`);
    } catch (error) {
      console.error(`Error reading locales directory: ${error.message}`);
    }
  } else {
    console.log('Locales directory not found, skipping locale cleanup');
  }
  
  // Base path for node_modules
  const nodeModulesPath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');
  
  if (fs.existsSync(nodeModulesPath)) {
    // Add specific node_modules directories to remove if they exist
    const specificModulesToRemove = [
      path.join(nodeModulesPath, '@types'),
      path.join(nodeModulesPath, 'typescript'),
      path.join(nodeModulesPath, 'ts-node')
    ];
    
    for (const modulePath of specificModulesToRemove) {
      if (fs.existsSync(modulePath)) {
        foldersToRemove.push(modulePath);
      }
    }
    
    // Find common removable directories
    const dirsToFind = ['docs', 'doc', 'example', 'examples', 'test', 'tests'];
    for (const dirName of dirsToFind) {
      const found = findAllRecursive(nodeModulesPath, dirName);
      if (found.length > 0) {
        console.log(`Found ${found.length} '${dirName}' directories to remove`);
        foldersToRemove.push(...found);
      }
    }
  } else {
    console.log('Node modules directory not found in expected location, skipping module cleanup');
  }
  
  // Process all folders to remove
  let totalSaved = 0;
  
  for (const folder of foldersToRemove) {
    try {
      if (fs.existsSync(folder)) {
        const stats = await getDirectorySize(folder);
        totalSaved += stats.size;
        
        console.log(`Removing: ${folder} (${formatBytes(stats.size)})`);
        await removeDirectory(folder);
      }
    } catch (error) {
      console.error(`Error removing ${folder}:`, error);
    }
  }
  
  console.log(`Optimization complete! Saved approximately ${formatBytes(totalSaved)}`);
};

/**
 * Recursively find all directories with the given name
 */
function findAllRecursive(dir, nameToFind, result = []) {
  if (!fs.existsSync(dir)) return result;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        if (item === nameToFind) {
          result.push(fullPath);
        } else {
          // Don't go too deep - only recurse 3 levels to avoid performance issues
          const level = fullPath.split(path.sep).length - dir.split(path.sep).length;
          if (level < 3) {
            findAllRecursive(fullPath, nameToFind, result);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error searching directory ${dir}:`, error);
  }
  
  return result;
}

/**
 * Recursively remove a directory
 */
async function removeDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      await removeDirectory(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  
  fs.rmdirSync(dir);
}

/**
 * Calculate the size of a directory
 */
async function getDirectorySize(dir) {
  let size = 0;
  let fileCount = 0;
  
  if (!fs.existsSync(dir)) {
    return { size, fileCount };
  }
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        const result = await getDirectorySize(fullPath);
        size += result.size;
        fileCount += result.fileCount;
      } else {
        size += stats.size;
        fileCount++;
      }
    }
  } catch (error) {
    console.error(`Error calculating size of ${dir}:`, error);
  }
  
  return { size, fileCount };
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
} 
const fs = require('fs');
const path = require('path');

/**
 * This script runs after the app is packed but before it's bundled into an installer.
 * It aggressively removes unnecessary files to reduce the final bundle size.
 */
exports.default = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  const appName = packager.appInfo.productFilename;
  
  console.log(`Optimizing bundle for ${electronPlatformName} at: ${appOutDir}`);
  
  // Track size savings
  let totalRemoved = 0;
  
  // Directories to always clean up
  const foldersToAlwaysRemove = [
    "node_modules/@types",
    "node_modules/typescript",
    "node_modules/esbuild",
    "node_modules/ts-node",
    "node_modules/vue-tsc",
    "node_modules/prettier",
    "node_modules/eslint*"
  ];

  // Patterns to find and remove
  const patternsToRemove = [
    "*.d.ts",
    "*.map",
    "*.md",
    "LICENSE*",
    "README*",
    "CHANGELOG*",
    "CONTRIBUTORS*",
    "CONTRIBUTING*",
    ".git*",
    ".npmignore",
    ".travis.yml",
    ".eslintrc*",
    "test",
    "tests",
    "__tests__",
    "example",
    "examples",
    "docs",
    "doc",
    "benchmark",
    "coverage"
  ];
  
  // Clean locales, keeping only en-US
  const localesPath = getPath(appOutDir, 'locales');
  if (fs.existsSync(localesPath)) {
    try {
      const localeFiles = fs.readdirSync(localesPath)
        .filter(file => file !== 'en-US.pak' && file !== 'en-US.pak.info')
        .map(file => path.join(localesPath, file));
      
      totalRemoved += await removeFiles(localeFiles);
    } catch (error) {
      console.error(`Error cleaning locales: ${error.message}`);
    }
  }
  
  // Process node_modules to remove unnecessary files
  const nodeModulesPath = getPath(appOutDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    // Remove large folders that are definitely not needed
    for (const folderPattern of foldersToAlwaysRemove) {
      const folders = findByPattern(nodeModulesPath, folderPattern);
      totalRemoved += await removeFiles(folders);
    }
    
    // Find and remove files by pattern
    for (const pattern of patternsToRemove) {
      const files = findFilesByPattern(nodeModulesPath, pattern, 5); // Depth of 5 is enough for node_modules
      totalRemoved += await removeFiles(files);
    }
  }
  
  // Clean out all .DS_Store files
  const dsStoreFiles = findFilesByPattern(appOutDir, '.DS_Store', 10);
  totalRemoved += await removeFiles(dsStoreFiles);
  
  console.log(`Optimization complete! Removed approximately ${formatBytes(totalRemoved)}`);
};

// Get the correct path based on platform and packager
function getPath(appOutDir, subPath) {
  // For macOS, the app is inside a .app bundle
  if (process.platform === 'darwin') {
    const appContentsPath = path.join(appOutDir, `${path.basename(appOutDir, '.app')}.app`, 'Contents');
    const resourcesPath = path.join(appContentsPath, 'Resources');
    
    if (subPath === 'locales') {
      return path.join(appContentsPath, 'MacOS', 'locales');
    } else if (subPath === 'node_modules') {
      // Node modules could be in resources/app or resources/app.asar.unpacked
      const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
      if (fs.existsSync(unpackedPath)) {
        return unpackedPath;
      }
      return path.join(resourcesPath, 'app', 'node_modules');
    }
  }
  
  // For Windows and Linux
  if (subPath === 'locales') {
    return path.join(appOutDir, 'locales');
  } else if (subPath === 'node_modules') {
    // Check both possible locations
    const unpackedPath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');
    if (fs.existsSync(unpackedPath)) {
      return unpackedPath;
    }
    return path.join(appOutDir, 'resources', 'app', 'node_modules');
  }
  
  return path.join(appOutDir, subPath);
}

// Find files by glob pattern with limited depth
function findByPattern(basePath, pattern) {
  const found = [];
  
  if (!fs.existsSync(basePath)) {
    return found;
  }
  
  const parts = pattern.split('/');
  let currentPath = basePath;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.includes('*')) {
      // It's a pattern, we need to find matching files/dirs
      const regex = new RegExp('^' + part.replace(/\*/g, '.*') + '$');
      if (fs.existsSync(currentPath)) {
        const items = fs.readdirSync(currentPath);
        for (const item of items) {
          if (regex.test(item)) {
            if (i === parts.length - 1) {
              // This is the last part of the pattern
              found.push(path.join(currentPath, item));
            } else {
              // More parts to check, recurse
              found.push(...findByPattern(path.join(currentPath, item), parts.slice(i + 1).join('/')));
            }
          }
        }
        return found;
      }
      return found;
    } else {
      // It's a fixed name, just append to the path
      currentPath = path.join(currentPath, part);
      if (!fs.existsSync(currentPath)) {
        return found;
      }
    }
  }
  
  // If we got here, the entire pattern was fixed names and they all exist
  found.push(currentPath);
  return found;
}

// Find files by pattern recursively with depth limit
function findFilesByPattern(basePath, pattern, maxDepth = 3, currentDepth = 0) {
  const found = [];
  
  if (!fs.existsSync(basePath) || currentDepth > maxDepth) {
    return found;
  }
  
  try {
    const items = fs.readdirSync(basePath);
    
    for (const item of items) {
      const fullPath = path.join(basePath, item);
      
      try {
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Recurse into subdirectories
          found.push(...findFilesByPattern(fullPath, pattern, maxDepth, currentDepth + 1));
        } else if (matchesPattern(item, pattern)) {
          found.push(fullPath);
        }
      } catch (err) {
        // Skip files that can't be accessed
      }
    }
  } catch (err) {
    // Skip directories that can't be read
  }
  
  return found;
}

// Check if a filename matches a pattern with wildcards
function matchesPattern(filename, pattern) {
  const regexPattern = '^' + pattern.split('*').map(escapeRegExp).join('.*') + '$';
  return new RegExp(regexPattern, 'i').test(filename);
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove a list of files or directories, return total bytes removed
async function removeFiles(filePaths) {
  let bytesRemoved = 0;
  
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          const dirSize = await getDirSize(filePath);
          bytesRemoved += dirSize;
          removeDir(filePath);
        } else {
          bytesRemoved += stats.size;
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error(`Error removing ${filePath}: ${error.message}`);
    }
  }
  
  return bytesRemoved;
}

// Get the size of a directory
async function getDirSize(dirPath) {
  let size = 0;
  
  if (!fs.existsSync(dirPath)) {
    return size;
  }
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          size += await getDirSize(filePath);
        } else {
          size += stats.size;
        }
      } catch (err) {
        // Skip files that can't be accessed
      }
    }
  } catch (err) {
    // Skip directories that can't be read
  }
  
  return size;
}

// Recursively remove a directory
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          removeDir(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // Skip files that can't be accessed
      }
    }
    
    fs.rmdirSync(dirPath);
  } catch (err) {
    console.error(`Error removing directory ${dirPath}: ${err.message}`);
  }
}

// Format bytes to human-readable
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
} 
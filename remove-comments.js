import fs from 'fs';
import path from 'path';
import strip from 'strip-comments';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - file types to process
const fileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.vue'];

// Directories to exclude
const excludeDirs = ['node_modules', 'dist', '.git', '.idea'];

// Function to process a file
function processFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const strippedContent = strip(fileContent);
    
    if (fileContent !== strippedContent) {
      fs.writeFileSync(filePath, strippedContent, 'utf8');
      console.log(`Processed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Function to walk through directory
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!excludeDirs.includes(file)) {
        walkDir(filePath);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (fileExtensions.includes(ext)) {
        processFile(filePath);
      }
    }
  });
}

// Start processing from the src directory
console.log('Starting to remove comments from files...');
walkDir('./src');
console.log('Finished removing comments.'); 
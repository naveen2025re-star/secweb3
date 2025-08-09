import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔧 Installing missing server dependencies...');

const requiredDeps = ['pg@8.11.3', 'jsonwebtoken@9.0.2', 'ethers@5.7.2'];

try {
  // Check if node_modules exists
  if (!fs.existsSync('./node_modules')) {
    console.log('📦 Creating node_modules directory...');
    fs.mkdirSync('./node_modules', { recursive: true });
  }

  // Install each dependency
  for (const dep of requiredDeps) {
    console.log(`📦 Installing ${dep}...`);
    execSync(`npm install ${dep}`, { stdio: 'inherit' });
  }

  console.log('✅ All dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const tailwindCliPath = path.resolve(__dirname, 'node_modules', '.bin', 'tailwindcss');

if (!fs.existsSync(tailwindCliPath)) {
  console.log('Tailwind CSS CLI not found, creating symlink...');
  const tailwindPackagePath = path.resolve(__dirname, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
  fs.symlinkSync(tailwindPackagePath, tailwindCliPath);
  console.log('Symlink created for Tailwind CSS CLI.');
} else {
  console.log('Tailwind CSS CLI already exists.');
}


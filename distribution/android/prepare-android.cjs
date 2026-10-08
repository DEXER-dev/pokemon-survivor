const fs = require('node:fs');
const path = require('node:path');

const gameIcon = path.resolve(__dirname, '../../assets/ui/app-icon.png');
const resourceRoot = path.join(__dirname, 'android/app/src/main/res');
if (!fs.existsSync(gameIcon) || !fs.existsSync(resourceRoot)) {
  throw new Error('Android project or game launcher icon is missing. Run `npx cap add android` first.');
}

for (const directory of fs.readdirSync(resourceRoot, { withFileTypes: true })) {
  if (!directory.isDirectory() || !directory.name.startsWith('mipmap-')) continue;
  const mipmapDirectory = path.join(resourceRoot, directory.name);
  for (const iconName of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const iconPath = path.join(mipmapDirectory, iconName);
    if (fs.existsSync(iconPath)) fs.copyFileSync(gameIcon, iconPath);
  }
}
console.log('Applied the game launcher icon to the generated Android project.');

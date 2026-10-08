const fs = require('node:fs');
const path = require('node:path');

const packageRoot = __dirname;
const gameRoot = path.resolve(packageRoot, '../..');
const webRoot = path.join(packageRoot, 'www');
const requiredEntries = [
  'index.html',
  'main.js',
  'builtin-materials.js',
  'system.min.js',
  'dex.css',
  'update-log.css',
  'src',
  'engine',
  'assets',
  'LICENSE',
  'THIRD-PARTY-NOTICES.md',
];

fs.rmSync(webRoot, { recursive: true, force: true });
fs.mkdirSync(webRoot, { recursive: true });
for (const entry of requiredEntries) {
  const source = path.join(gameRoot, entry);
  if (!fs.existsSync(source)) throw new Error(`Required game file is missing: ${source}`);
  fs.cpSync(source, path.join(webRoot, entry), { recursive: true });
}
const indexPath = path.join(webRoot, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const nativeIndex = index.replace('<html lang="zh-CN">', '<html lang="zh-CN" data-native-shell="true">');
if (nativeIndex === index) throw new Error('Could not mark the Android index as a native app shell.');
fs.writeFileSync(indexPath, nativeIndex);
console.log(`Prepared Android web assets from ${gameRoot}`);

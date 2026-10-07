import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const protectedFiles = ['package.json','app.json','eas.json','babel.config.js','metro.config.js','App.js'];
const expected = {
  'package.json':'9aa66c63fa6942b63e183b928ca105741d643b3740c2982233c899480c0c845f',
  'app.json':'3741deccd61b0410e916efea84d6248a430799651e015046030fafcf67773ce7',
  'eas.json':'ff812884d5a0e652b2b37fffe22a04f6175f63b38475512ff448ecc48780f399',
  'babel.config.js':'c27c3e8f3470c96cfa6f165c5ada8dcd66b1db7556c22c31cb8f0450babdf209',
  'metro.config.js':'e064544a53be816bce639b7134098dece84b6929284add7168fdafb7b429d0c9',
  'App.js':'42edbf07853a654496b3b7bb071b21bbbff9d6f60ec61fcc621dec59aeb926d4',
};
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const app = JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
const expo = app.expo;
const checks = {
  bundleIdentifier: expo?.ios?.bundleIdentifier === 'com.kilix.app',
  scheme: expo?.scheme === 'kilix',
  tabletSupport: expo?.ios?.supportsTablet === true,
  icon: fs.existsSync(path.join(root, expo?.icon ?? '')),
  splash: fs.existsSync(path.join(root,'assets/images/kilix-splash.png')),
  iosPlugin: fs.readFileSync(path.join(root,'plugins/withKilixSplashFallback.js'),'utf8').includes('withInfoPlist'),
  expoAuthSession: fs.readFileSync(path.join(root,'src/context/AuthContext.js'),'utf8').includes("makeRedirectUri({ scheme: 'kilix' })"),
};
const protectedUnchanged = protectedFiles.every(f => hash(f) === expected[f]);
console.log(JSON.stringify({ protectedUnchanged, checks, nativeIosFolderPresent: fs.existsSync(path.join(root,'ios')), note: 'Expo CNG/EAS generates ios natively at build time; protected config files are intentionally untouched.' }, null, 2));
if (!protectedUnchanged || Object.values(checks).some(v => !v)) process.exit(1);

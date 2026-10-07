import fs from 'node:fs';
import crypto from 'node:crypto';
const root = new URL('..', import.meta.url).pathname;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const hashes = {
  'package.json':'9aa66c63fa6942b63e183b928ca105741d643b3740c2982233c899480c0c845f',
  'app.json':'3741deccd61b0410e916efea84d6248a430799651e015046030fafcf67773ce7',
  'eas.json':'ff812884d5a0e652b2b37fffe22a04f6175f63b38475512ff448ecc48780f399',
  'babel.config.js':'c27c3e8f3470c96cfa6f165c5ada8dcd66b1db7556c22c31cb8f0450babdf209',
  'metro.config.js':'e064544a53be816bce639b7134098dece84b6929284add7168fdafb7b429d0c9',
  'App.js':'42edbf07853a654496b3b7bb071b21bbbff9d6f60ec61fcc621dec59aeb926d4'
};
const out = {};
for (const [f, expected] of Object.entries(hashes)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+f, import.meta.url))).digest('hex');
  out[f] = actual === expected;
}
const create = read('../src/screens/CreateStoreScreen.js');
const variants = read('../src/constants/variants.js');
const detail = read('../src/screens/ProductDetailScreen.js');
const hook = read('../src/hooks/useFirestoreProducts.js');
const store = read('../src/services/storeService.js');
out.checks = {
  protectedUnchanged: Object.values(out).every(Boolean),
  customSize: create.includes("openCustomOptionModal('size')") && create.includes('setNewSizes'),
  customColor: create.includes("openCustomOptionModal('color')") && create.includes('setNewColors'),
  customRam: create.includes("openCustomOptionModal('ram')") && create.includes('setNewRam'),
  customStorage: create.includes("openCustomOptionModal('storage')") && create.includes('setNewStorage'),
  customPersisted: create.includes('sizes: newSizes') && create.includes('colors: newColors') && create.includes('ram: newRam') && create.includes('storage: newStorage'),
  customerUsesPublishedFields: variants.includes('return [\'sizes\',\'colors\',\'ram\',\'storage\']') && detail.includes('getProduct(id)'),
  publicFiltersInactive: hook.includes(".eq('is_active', true)") && store.includes(".eq('is_active', true)"),
  deleteOptimisticRemoval: create.includes('setProducts((current) => current.filter((product) => product.id !== productId))'),
  inventoryPagination: create.includes('getProductCount({ storeId: storeDocId') && create.includes('onEndReached={loadMoreProducts}') && create.includes('limit: 50, offset')
};
console.log(JSON.stringify(out, null, 2));
process.exitCode = Object.values(out).every(Boolean) && Object.values(out.checks).every(Boolean) ? 0 : 1;

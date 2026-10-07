import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (p) => fs.readFileSync(p, 'utf8');
const walk = (dir) => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const jsFiles = walk(path.join(root,'src')).filter(p=>p.endsWith('.js'));

const missingImports=[];
for (const file of jsFiles) {
  const s=read(file);
  for (const m of s.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)) {
    const base=path.resolve(path.dirname(file),m[2]);
    const candidates=[base,`${base}.js`,`${base}.jsx`,`${base}.ts`,`${base}.tsx`,path.join(base,'index.js')];
    if(!candidates.some(fs.existsSync)) missingImports.push(`${file}:${m[2]}`);
  }
}
const migrationDir = path.join(root,'supabase/migrations');
const migrationFiles = walk(migrationDir).filter(p=>p.endsWith('.sql')).sort();
const sql = migrationFiles.map(read).join('\n');
const canonicalSql = read(path.join(migrationDir,'000_canonical_schema.sql'));
const tables=[...canonicalSql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(m=>m[1]);
const dupTables=tables.filter((t,i)=>tables.indexOf(t)!==i);
const rpcDefs=new Map();
for(const m of sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\s*\((.*?)\)\s*\n?RETURNS/gis)){rpcDefs.set(m[1],[...m[2].matchAll(/\b(p_\w+)\b/g)].map(x=>x[1]));}
// RPCs introduced by later local migrations.
rpcDefs.set('open_store_chat',['p_store_id']);
const rpcErrors=[];
for(const file of jsFiles){const s=read(file);for(const m of s.matchAll(/\.rpc\(\s*['"](\w+)['"]\s*,\s*\{([^}]*)\}/gs)){const n=m[1],keys=[...m[2].matchAll(/(p_\w+)\s*:/g)].map(x=>x[1]);const d=rpcDefs.get(n);if(!d)rpcErrors.push(`${file}:${n} undefined`);else{const miss=d.filter(k=>!keys.includes(k)),extra=keys.filter(k=>!d.includes(k));if(miss.length||extra.length)rpcErrors.push(`${file}:${n} missing=${miss.join(',')} extra=${extra.join(',')}`)}}}
const screens=walk(path.join(root,'src/screens')).filter(p=>p.endsWith('.js'));
const directScreenDb=screens.filter(p=>/supabase\.(from|rpc|storage)/.test(read(p)));
const syntaxDirs=['services','context','config','utils','hooks'];
const syntaxFail=[];
for(const d of syntaxDirs)for(const f of walk(path.join(root,'src',d)).filter(p=>p.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)syntaxFail.push(f);}
const legacy=jsFiles.filter(p=>/(?:@firebase\/|firebase\.|firestore\.|getDocs\(|addDoc\(|updateDoc\(|deleteDoc\(|\bcollection\()/.test(read(p)));
const result={missingImports:missingImports.length,duplicateTables:dupTables,rpcErrors,directScreenDb:directScreenDb.map(p=>path.relative(root,p)),syntaxFail:syntaxFail.map(p=>path.relative(root,p)),legacyFirebaseFirestore:legacy.map(p=>path.relative(root,p))};
console.log(JSON.stringify(result,null,2));
const failed=missingImports.length||dupTables.length||rpcErrors.length||directScreenDb.length||syntaxFail.length||legacy.length;
process.exit(failed?1:0);

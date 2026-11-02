import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprint,needsInstall,npmCli} from '../scripts/launcher/launch.mjs';
it('detects incomplete installs and reinstalls when the lockfile changes',()=>{const dir=mkdtempSync(join(tmpdir(),'academy-launch-'));try{writeFileSync(join(dir,'package-lock.json'),'first');expect(needsInstall(dir)).toBe(true);mkdirSync(join(dir,'node_modules/next'),{recursive:true});writeFileSync(join(dir,'node_modules/next/package.json'),'{}');writeFileSync(join(dir,'node_modules/.academy-launcher-lock'),fingerprint(dir));expect(needsInstall(dir)).toBe(false);writeFileSync(join(dir,'package-lock.json'),'updated');expect(needsInstall(dir)).toBe(true);}finally{rmSync(dir,{recursive:true,force:true});}});
it('resolves npm without platform shell interpolation',()=>{expect(npmCli()).toContain('npm-cli.js');});
it('pins verified official runtime digests consistently across both bootstraps',()=>{const manifest=JSON.parse(readFileSync('scripts/launcher/node-runtime.json','utf8'));expect(Object.keys(manifest)).toHaveLength(4);const mac=readFileSync('scripts/launcher/bootstrap-mac.sh','utf8');for(const [key,entry] of Object.entries(manifest) as [string,{filename:string;sha256:string;version:string}][]){expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);expect(entry.filename).toContain(entry.version);if(key.startsWith('darwin')){expect(mac).toContain(entry.filename);expect(mac).toContain(entry.sha256);}}});

import {downloadPlan,verifyTarball} from '../scripts/launcher/npm-cache.mjs';
import {cacheInstallArgs} from '../scripts/launcher/launch.mjs';
import {createHash} from 'node:crypto';
it('filters package downloads to Windows architecture and rejects non-registry sources',()=>{
 const integrity='sha512-'+Buffer.alloc(64).toString('base64');
 const lock={packages:{a:{resolved:'https://registry.npmjs.org/example/-/example-1.tgz',integrity},b:{resolved:'https://registry.npmjs.org/win/-/win-1.tgz',integrity,os:['win32'],cpu:['x64']},c:{resolved:'https://registry.npmjs.org/linux/-/linux-1.tgz',integrity,os:['linux']},d:{resolved:'https://registry.npmjs.org/arm/-/arm-1.tgz',integrity,cpu:['arm64']}}};
 expect(downloadPlan(lock,'win32','x64')).toHaveLength(2);
 expect(()=>downloadPlan({packages:{a:{resolved:'http://registry.npmjs.org/a.tgz',integrity}}})).toThrow('HTTPS');
 expect(()=>downloadPlan({packages:{a:{resolved:'https://user:password@registry.npmjs.org/a.tgz',integrity}}})).toThrow('Unsupported');
 expect(()=>downloadPlan({packages:{a:{resolved:'https://untrusted.invalid/a.tgz',integrity}}})).toThrow('Unsupported');
 expect(()=>downloadPlan({packages:{a:{resolved:'https://registry.npmjs.org/a.tgz'}}})).toThrow('integrity');
});
it('verifies actual tarball bytes and stops on integrity mismatch',async()=>{const dir=mkdtempSync(join(tmpdir(),'academy-integrity-'));try{const file=join(dir,'package.tgz');writeFileSync(file,'verified-package-bytes');const integrity='sha512-'+createHash('sha512').update('verified-package-bytes').digest('base64');await expect(verifyTarball(file,integrity)).resolves.toBeUndefined();writeFileSync(file,'tampered');await expect(verifyTarball(file,integrity)).rejects.toThrow('integrity mismatch');}finally{rmSync(dir,{recursive:true,force:true});}});
it('only enables offline installation for cache matching the current lockfile',()=>{const dir=mkdtempSync(join(tmpdir(),'academy-proxy-cache-'));try{writeFileSync(join(dir,'package-lock.json'),'lock');expect(cacheInstallArgs(dir)).toEqual([]);mkdirSync(join(dir,'.runtime/npm-cache'),{recursive:true});writeFileSync(join(dir,'.runtime/npm-cache','.ready-'+fingerprint(dir)),'verified');expect(cacheInstallArgs(dir)).toEqual(['--offline','--cache',join(dir,'.runtime/npm-cache')]);writeFileSync(join(dir,'package-lock.json'),'changed');expect(cacheInstallArgs(dir)).toEqual([]);}finally{rmSync(dir,{recursive:true,force:true});}});

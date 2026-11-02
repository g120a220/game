import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprint,needsInstall,npmCli} from '../scripts/launcher/launch.mjs';
it('detects incomplete installs and reinstalls when the lockfile changes',()=>{const dir=mkdtempSync(join(tmpdir(),'academy-launch-'));try{writeFileSync(join(dir,'package-lock.json'),'first');expect(needsInstall(dir)).toBe(true);mkdirSync(join(dir,'node_modules/next'),{recursive:true});writeFileSync(join(dir,'node_modules/next/package.json'),'{}');writeFileSync(join(dir,'node_modules/.academy-launcher-lock'),fingerprint(dir));expect(needsInstall(dir)).toBe(false);writeFileSync(join(dir,'package-lock.json'),'updated');expect(needsInstall(dir)).toBe(true);}finally{rmSync(dir,{recursive:true,force:true});}});
it('resolves npm without platform shell interpolation',()=>{expect(npmCli()).toContain('npm-cli.js');});
it('pins verified official runtime digests consistently across both bootstraps',()=>{const manifest=JSON.parse(readFileSync('scripts/launcher/node-runtime.json','utf8'));expect(Object.keys(manifest)).toHaveLength(4);const mac=readFileSync('scripts/launcher/bootstrap-mac.sh','utf8');for(const [key,entry] of Object.entries(manifest) as [string,{filename:string;sha256:string;version:string}][]){expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);expect(entry.filename).toContain(entry.version);if(key.startsWith('darwin')){expect(mac).toContain(entry.filename);expect(mac).toContain(entry.sha256);}}});

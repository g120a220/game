import {createHash} from 'node:crypto';
import {readFileSync,existsSync,createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
function matches(values,current){if(!values)return true;const all=Array.isArray(values)?values:[values];if(all.includes('!'+current))return false;const positive=all.filter(v=>!v.startsWith('!'));return !positive.length||positive.includes(current)||positive.includes('any');}
export function downloadPlan(lock,platform=process.platform,arch=process.arch){const result=new Map();for(const item of Object.values(lock.packages||{})){
 if(!item.resolved||!matches(item.os,platform)||!matches(item.cpu,arch))continue;
 const url=new URL(item.resolved);if(url.protocol!=='https:'||url.username||url.password||!['registry.npmjs.org','registry.yarnpkg.com'].includes(url.hostname))throw new Error('Unsupported package source. Only audited HTTPS npm registries can be downloaded.');
 if(!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(item.integrity||''))throw new Error('Package must have a locked SHA-512 integrity value.');
 const entry={url:url.href,integrity:item.integrity,filename:createHash('sha256').update(url.href).digest('hex')+'.tgz'};
 if(result.has(entry.url)&&result.get(entry.url).integrity!==entry.integrity)throw new Error('Conflicting locked integrity values.');result.set(entry.url,entry);
 }return [...result.values()];}
export async function verifyTarball(file,integrity){const hash=createHash('sha512');for await(const chunk of createReadStream(file))hash.update(chunk);if('sha512-'+hash.digest('base64')!==integrity)throw new Error('Downloaded package integrity mismatch. Installation stopped.');}
async function cacheFile(npm,file,cache){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[npm,'cache','add',file,'--cache',cache,'--offline','--ignore-scripts','--no-audit','--no-fund'],{stdio:['ignore','ignore','pipe'],env:process.env});let stderr='';p.stderr.on('data',chunk=>{stderr+=chunk;});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(new Error(`npm cache preparation failed (${code}). ${stderr.slice(-1200)}`)));});}
async function main(){const [action,rootArg,npm]=process.argv.slice(2);const root=resolve(rootArg);const plan=downloadPlan(JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8')));
 if(action==='plan'){process.stdout.write(JSON.stringify(plan));return;}
 if(action!=='fill'||!npm||!existsSync(npm))throw new Error('Invalid npm cache command.');
 const cache=join(root,'.runtime','npm-cache'),downloads=join(root,'.runtime','npm-downloads');let next=0;
 // Verify ALL downloads before importing any into npm cache. npm ci verifies lock integrity again.
 for(const entry of plan)await verifyTarball(join(downloads,entry.filename),entry.integrity);
 await Promise.all(Array.from({length:3},async()=>{while(next<plan.length){const entry=plan[next++];await cacheFile(npm,join(downloads,entry.filename),cache);}}));
 console.log('Verified npm package cache is ready.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});

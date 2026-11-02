import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,copyFileSync,realpathSync} from 'node:fs';
import {dirname,join,resolve,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function fingerprint(root){return createHash('sha256').update(readFileSync(join(root,'package-lock.json'))).update(`${process.platform}-${process.arch}-${process.versions.node.split('.')[0]}`).digest('hex');}
export function needsInstall(root){const stamp=join(root,'node_modules','.academy-launcher-lock');return !existsSync(join(root,'node_modules','next','package.json'))||!existsSync(stamp)||readFileSync(stamp,'utf8').trim()!==fingerprint(root);}
export function npmCli(){
 const bin=dirname(process.execPath);
 const paths=[join(bin,'node_modules/npm/bin/npm-cli.js'),join(bin,'../lib/node_modules/npm/bin/npm-cli.js')];
 for(const p of (process.env.PATH||'').split(delimiter)){try{const real=realpathSync(join(p,process.platform==='win32'?'npm.cmd':'npm'));if(real.endsWith('npm-cli.js'))paths.push(real);}catch{}}
 const found=paths.find(p=>existsSync(p));if(!found)throw new Error('找不到 npm，請安裝含 npm 的 Node.js 24，或重新開啟雙擊啟動檔。');return found;
}
async function getPage(port){try{const r=await fetch(`http://localhost:${port}`,{signal:AbortSignal.timeout(1800)});return r.ok&&(await r.text()).includes('國小冒險學院');}catch{return false;}}
async function portFree(port){return new Promise((resolve,reject)=>{const server=createServer();server.once('error',e=>e.code==='EADDRINUSE'?resolve(false):reject(e));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}
export async function choosePort(first=3000){for(let port=first;port<first+20;port++){if(await portFree(port))return {port,reuse:false};if(await getPage(port))return {port,reuse:true};}throw new Error('無法找到可用的本機連接埠，請關閉舊視窗後重試。');}
async function run(args,root,env){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`準備程序未完成（${signal||code}），請檢查上方訊息及網路後再點啟動檔。`)));});}
export async function waitForReady(port,child,timeout=120000){const until=Date.now()+timeout;while(Date.now()<until){if(child.exitCode!==null||child.signalCode)throw new Error('網站啟動失敗，請查看上方錯誤訊息。');if(await getPage(port))return;await new Promise(r=>setTimeout(r,500));}throw new Error('網站啟動逾時，請檢查上方訊息後再試一次。');}
function openBrowser(url){if(process.env.ACADEMY_NO_BROWSER==='1')return;let command,args;if(process.platform==='win32'){command='rundll32.exe';args=['url.dll,FileProtocolHandler',url];}else if(process.platform==='darwin'){command='open';args=[url];}else{command='xdg-open';args=[url];}const opener=spawn(command,args,{stdio:'ignore'});opener.on('error',()=>console.log(`請在瀏覽器開啟：${url}`));opener.unref();}
export async function launch(){
 console.log('\n國小冒險學院｜正在為你打開數字森林…\n');
 if(Number(process.versions.node.split('.')[0])<24)throw new Error('需要 Node.js 24 或以上。請使用 Windows／Mac 雙擊啟動檔自動準備。');
 const portValue=Number(process.env.ACADEMY_LAUNCHER_PORT||3000);if(!Number.isInteger(portValue)||portValue<1024||portValue>65000)throw new Error('啟動埠設定不正確。');
 const {port,reuse}=await choosePort(portValue);const url=`http://localhost:${port}`;
 if(reuse){console.log(`網站已開啟：${url}`);openBrowser(url);return;}
 const env={...process.env,LOCAL_DEMO_MODE:'true',NEXT_TELEMETRY_DISABLED:'1'};
 if(!existsSync(join(projectRoot,'.env.local')))copyFileSync(join(projectRoot,'.env.example'),join(projectRoot,'.env.local'));
 if(needsInstall(projectRoot)){console.log('第一次啟動：正在安裝必要套件，可能需要幾分鐘，請保持網路連線。');await run([npmCli(),'ci','--no-audit','--no-fund'],projectRoot,env);writeFileSync(join(projectRoot,'node_modules','.academy-launcher-lock'),fingerprint(projectRoot));}
 await run(['--import','tsx','scripts/init-db.ts'],projectRoot,env);
 const next=join(projectRoot,'node_modules/next/dist/bin/next');
 const server=spawn(process.execPath,[next,'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:projectRoot,env,stdio:'inherit'});
 let stopping=false;const stop=()=>{if(stopping||server.exitCode!==null)return;stopping=true;if(process.platform==='win32'&&server.pid){const killer=spawn('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});killer.on('error',()=>server.kill());}else server.kill('SIGTERM');};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);process.once('exit',stop);
 try{await waitForReady(port,server);}catch(e){stop();throw e;}
 console.log(`\n已準備好！${url}\n瀏覽器會自動開啟。使用期間請保留此視窗，結束時關閉視窗即可。\n`);openBrowser(url);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.once('exit',code=>stopping||code===0||code===null?resolve():reject(new Error(`網站已停止（${code}）`)));});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))launch().catch(e=>{console.error(`\n啟動失敗：${e.message}\n`);process.exitCode=1;});

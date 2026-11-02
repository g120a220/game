'use client';
import { useEffect,useRef,useState } from 'react';
const assets={forest:'/art/map.png',fox:'/art/fox.png'};
export default function AdventureMap({completed,onExplore}:{completed:number;onExplore:()=>void}){
 const ref=useRef<HTMLDivElement>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let disposed=false;let game:import('phaser').Game|undefined;
 import('phaser').then(({default:P})=>{if(disposed||!ref.current)return;const host=ref.current;
 class Forest extends P.Scene{
 preload(){this.load.image('forest',assets.forest);this.load.image('fox',assets.fox);this.load.svg('lock','/art/lock.svg',{width:24,height:24});}
 create(){host.dataset.mapReady='true';const w=900,h=260;this.cameras.main.setBackgroundColor('#f7f6ef');
 this.add.image(w/2,h/2,'forest').setDisplaySize(w,h);
 const pet=this.add.image(150,166,'fox').setDisplaySize(44,44);
 const points=[{x:150,y:150},{x:450,y:150},{x:750,y:150}];
 points.forEach((p,i)=>{const unlocked=i===0||completed>=i*2;
 if(unlocked){const hotspot=this.add.zone(p.x,p.y,220,210).setInteractive({useHandCursor:true});hotspot.on('pointerdown',()=>{this.tweens.add({targets:pet,x:p.x,y:p.y+12,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250,onComplete:onExplore});});}
 else{this.add.circle(p.x,p.y+12,17,0x52614c,.8).setStrokeStyle(2,0xf8f7ef);this.add.image(p.x,p.y+12,'lock').setDisplaySize(19,19);}
 });

 }}
 game=new P.Game({type:P.CANVAS,parent:ref.current,width:900,height:260,transparent:false,scene:Forest,scale:{mode:P.Scale.FIT,autoCenter:P.Scale.CENTER_BOTH},audio:{noAudio:true},banner:false});
 }).catch(()=>setFailed(true));return()=>{disposed=true;if(ref.current)delete ref.current.dataset.mapReady;game?.destroy(true);};
 },[completed,onExplore]);
 return <div className="map-wrap"><div ref={ref} className="phaser-map" aria-hidden="true"/>{failed&&<p>地圖動畫暫時無法載入，仍可使用下方按鈕探索。</p>}<div className="map-labels">{['數數小徑','加法樹屋','減法溪谷'].map((label,i)=><button key={label} onClick={onExplore} disabled={i>0&&completed<i*2} className={i===0?'island active':'island'}>{i>0&&completed<i*2?'待探索 · ':''}{label}</button>)}</div><p className="map-caption">原創示範路線 · 與正式出版社章節無對應</p></div>;
}

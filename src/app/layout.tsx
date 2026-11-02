import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'國小冒險學院｜讓好奇心帶路',description:'每次一小步，和小栗一起探索知識。台灣國小遊戲化學習平台，本地原創示範版。',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-TW"><body>{children}</body></html>;}

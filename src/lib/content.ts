import { z } from 'zod';
export const questionInput = z.object({
  prompt: z.string().min(3).max(300), choices: z.array(z.string().min(1).max(80)).min(2).max(4),
  answer: z.number().int().min(0).max(3), explanation: z.string().min(3).max(500),
  hint: z.string().min(3).max(200), objectiveId: z.string().min(1).max(80), additionalObjectiveIds:z.array(z.string().min(1).max(80)).max(10).default([]),
  sourceUrl: z.url().refine(v => v.startsWith('https://'), '來源須為 HTTPS'), sourceTitle: z.string().min(2).max(200),
}).refine(v => v.answer < v.choices.length, '答案必須對應一個選項').refine(v => new Set(v.choices).size === v.choices.length, '選項不可重複');
export const importInput = z.object({ questions: z.array(questionInput).min(1).max(50) });
export const objectives = [
 { id:'count-10', title:'認識 10 以內的數量', area:'數數小徑', hint:'用手指或小物件，一個一個數數看。' },
 { id:'add-10', title:'10 以內的加法', area:'加法樹屋', hint:'把兩群物件放在一起，再數一次。' },
 { id:'subtract-10', title:'10 以內的減法', area:'減法溪谷', hint:'先放好全部，再拿走指定的數量。' },
];
export const demoQuestions = [
 {id:'demo-1',objectiveId:'count-10',prompt:'小栗找到 3 顆松果，又找到 2 顆。現在一共有幾顆松果？',choices:['4 顆','5 顆','6 顆'],answer:1,hint:'先數 3 顆，再往後數 2 顆。',explanation:'3 加上 2 等於 5，所以一共有 5 顆松果。'},
 {id:'demo-2',objectiveId:'count-10',prompt:'樹枝上有 6 隻小鳥，哪一個數字代表小鳥的數量？',choices:['5','6','7'],answer:1,hint:'把每一隻小鳥對應到一個數字。',explanation:'一共有 6 隻小鳥，所以用數字 6 表示。'},
 {id:'demo-3',objectiveId:'add-10',prompt:'草地上有 4 朵花，旁邊還有 3 朵。一共有幾朵花？',choices:['6 朵','8 朵','7 朵'],answer:2,hint:'從 4 開始，接著數 5、6、7。',explanation:'4 + 3 = 7，一共有 7 朵花。'},
 {id:'demo-4',objectiveId:'subtract-10',prompt:'小栗有 8 顆栗子，送給朋友 3 顆，還剩幾顆？',choices:['5 顆','4 顆','6 顆'],answer:0,hint:'用 8 個小物件，拿走 3 個看看。',explanation:'8 − 3 = 5，所以還剩下 5 顆栗子。'},
 {id:'demo-5',objectiveId:'add-10',prompt:'小溪左邊有 2 隻青蛙，右邊有 5 隻。一共有幾隻？',choices:['6 隻','7 隻','8 隻'],answer:1,hint:'把 2 隻和 5 隻合在一起。',explanation:'2 + 5 = 7，一共有 7 隻青蛙。'},
];

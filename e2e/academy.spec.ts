import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
test('parent consent, complete task, persistence, rewards and desktop/mobile navigation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'走進數字森林'})).toBeVisible();
 await page.getByRole('button',{name:'開始今日任務'}).click();await expect(page.locator('.alert[role=alert]')).toContainText('家長專區');
 await page.getByRole('button',{name:'家長專區'}).click();await page.getByRole('button',{name:'同意本地示範學習資料保存'}).click();
 await page.getByLabel('約定內容').fill('一起讀一本故事書');await page.getByLabel('所需星星').fill('10');await page.getByRole('button',{name:'新增家庭約定'}).click();await expect(page.getByRole('status')).toContainText('已保存');
 await page.getByLabel('本地示範角色').selectOption('student');await expect(page.getByRole('heading',{name:'走進數字森林'})).toBeVisible();
 await expect(page.locator('.phaser-map[data-map-ready=true] canvas')).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));
 mkdirSync('/tmp/academy-qa',{recursive:true});await page.screenshot({path:'/tmp/academy-qa/desktop.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1505,height:1045});await page.screenshot({path:'/tmp/academy-qa/native.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'開始今日任務'}).click();
 const choices=[1,1,2,0,1];
 for(let i=0;i<choices.length;i++){
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  if(i===0){await dialog.getByRole('button',{name:'我想休息一下'}).click();await expect(dialog.getByRole('heading',{name:'休息一下，也很好。'})).toBeVisible();await dialog.getByRole('button',{name:'回到這一題'}).click();await dialog.getByRole('button',{name:'給我一點提示'}).click();await expect(dialog.locator('.hint-box')).toBeVisible();}
  await dialog.getByRole('radio').nth(choices[i]).check();await dialog.getByRole('button',{name:'確認答案'}).click();await expect(dialog.getByRole('status')).toContainText('你發現答案了');
  if(i===0)await page.screenshot({path:'/tmp/academy-qa/answer.png',fullPage:true,animations:'disabled'});
  await dialog.getByRole('button',{name:i===4?'完成這次探索':'下一個發現'}).click();
 }
 await expect(page.getByRole('heading',{name:'今天的探索，完成了！'})).toBeVisible();await page.getByRole('button',{name:'收好手帳，去休息'}).click();await page.reload();
 await expect(page.locator('.stats-strip')).toContainText('10');await page.getByRole('button',{name:'學習紀錄',exact:true}).click();await expect(page.getByText('5 / 5 題')).toBeVisible();
 await page.getByRole('button',{name:'我的夥伴',exact:true}).click();await page.getByRole('button',{name:'提出約定'}).click();await expect(page.getByRole('status')).toContainText('已送出');await page.reload();
 await page.getByRole('button',{name:'我的夥伴',exact:true}).click();await expect(page.getByText('等待家長陪伴')).toBeVisible();
 await page.getByRole('button',{name:'家長專區'}).click();await page.getByRole('button',{name:'確認已陪伴完成'}).click();await expect(page.getByRole('status')).toContainText('已記錄完成');
 await page.getByLabel('本地示範角色').selectOption('student');await page.getByLabel('年級',{exact:true}).selectOption('2');await expect(page.getByText('目前所選內容尚未建置與核驗')).toBeVisible();await page.getByRole('button',{name:'回到原創示範'}).click();
 await page.setViewportSize({width:390,height:844});await page.locator('.phaser-map[data-map-ready=true]').waitFor();await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c&&c.getBoundingClientRect().width<=390;});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/academy-qa/mobile.png',fullPage:true,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'開啟選單'}).click();await page.getByRole('button',{name:'學習地圖',exact:true}).click();await expect(page.getByRole('heading',{name:'每一步，都有新發現。'})).toBeVisible();expect(errors).toEqual([]);
});
test('draft import, reviewer separation and publication gate',async({page})=>{
 await page.goto('/');await page.getByLabel('本地示範角色').selectOption('admin');
 const input={questions:[{prompt:'E2E 測試：1 加 1 等於多少？',choices:['1','2'],answer:1,hint:'想想兩個物件放在一起。',explanation:'1 + 1 = 2。',objectiveId:'add-10',sourceUrl:'https://www.naer.edu.tw/',sourceTitle:'自動測試資料，非已核驗教材'}]};
 await page.getByLabel('JSON 題目資料').fill(JSON.stringify(input));await page.getByRole('button',{name:'驗證並匯入草稿'}).click();await expect(page.getByRole('status')).toContainText('草稿已保存');
 let row=page.getByRole('row').filter({hasText:'E2E 測試'});await expect(row).toContainText('待審草稿');await expect(row.getByRole('button',{name:'發布題目'})).toHaveCount(0);
 await page.getByLabel('本地示範角色').selectOption('reviewer');await page.getByLabel('審查紀錄').fill('自動測試獨立審核流程，不代表教材已人工查核。');await page.getByLabel('我已人工開啟來源').check();
 row=page.getByRole('row').filter({hasText:'E2E 測試'});await row.getByRole('button',{name:'核驗通過'}).click();await expect(row).toContainText('審核通過');
 await page.getByLabel('本地示範角色').selectOption('admin');await page.getByRole('row').filter({hasText:'E2E 測試'}).getByRole('button',{name:'發布題目'}).click();await expect(page.getByRole('status')).toContainText('單題發布');
});
test('HTTP rejects forged origin, student admin mutation and answer leakage',async({request})=>{
 const login=await request.post('/api/academy',{headers:{origin:'http://localhost:3100'},data:{action:'login',role:'student'}});expect(login.ok()).toBe(true);
 const forged=await request.post('/api/academy',{headers:{origin:'https://foreign.example'},data:{action:'start'}});expect(forged.status()).toBe(403);
 const denied=await request.post('/api/academy',{headers:{origin:'http://localhost:3100'},data:{action:'import',payload:{questions:[]}}});expect(denied.status()).toBe(403);
 const summary=await request.get('/api/academy?studentId=student-2');expect(summary.status()).toBe(403);
});
test('builds a new subject and knowledge objective through the management UI',async({page})=>{
 await page.goto('/');await page.getByLabel('本地示範角色').selectOption('admin');
 await page.getByLabel('架構 JSON',{exact:true}).fill(JSON.stringify({records:[{table:'subjects',id:'e2e-subject',values:{code:'e2e-subject',name:'測試科目（非正式課程）'}},{table:'learning_objectives',id:'e2e-objective',values:{subject_id:'e2e-subject',code:'e2e-objective',title:'測試知識點',description:'原創測試用，不代表已核驗課綱'}}]}));
 await page.getByRole('button',{name:'儲存教材架構草稿'}).click();await expect(page.getByRole('status')).toContainText('2 筆架構資料');
 await page.getByLabel('資料種類').selectOption('learning_objectives');await expect(page.locator('.catalog-records')).toContainText('測試知識點');await page.reload();await page.getByRole('button',{name:'教材管理'}).click();await page.getByLabel('資料種類').selectOption('learning_objectives');await expect(page.locator('.catalog-records')).toContainText('測試知識點');
});

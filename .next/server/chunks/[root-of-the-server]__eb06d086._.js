module.exports=[93695,(e,t,n)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},70406,(e,t,n)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},18622,(e,t,n)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},14747,(e,t,n)=>{t.exports=e.x("path",()=>require("path"))},33405,(e,t,n)=>{t.exports=e.x("child_process",()=>require("child_process"))},50960,e=>{"use strict";var t=e.i(33405),n=e.i(14747);let r=process.env.OPENCLAW_CALLBACK_URL||"http://localhost:3848/api/openclaw/callback",o=(0,n.resolve)(process.cwd()).replace(/\\/g,"/"),s=(0,n.join)(o,"openclaw/scripts/platform-scrape.mjs").replace(/\\/g,"/");async function a(n,o,s,a){try{if(!await c())return console.warn("[openclaw] CLI not available"),{queued:!1};let f="";if("market-research"===n){let e=o.keyword||"",t=o.researchConfig?.sources||o.sources||["taobao"],n=o.dateRange||o.researchConfig?.dateRange||30,[r,s]=await Promise.all([i(e,t),l(e,n)]);f=r.scraped+s.trends,console.log(`[openclaw] Pre-scraped ${r.productCount} products, Google Trends: ${s.success?"OK":"failed"}`)}let g=d(n,o,s,a)+f,h=await e.A(23970),m=await e.A(7480),w=await e.A(89793),y=w.join(m.tmpdir(),`oc-msg-${Date.now()}.txt`).replace(/\\/g,"/");h.writeFileSync(y,g,"utf-8");let x=await u(),$=`
const { execFileSync } = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('${y}', 'utf-8');
try {
  const result = execFileSync(process.execPath, ['${x}', 'agent', '--agent', 'main', '-m', msg, '--json'], {
    encoding: 'utf-8',
    timeout: 600000,
    env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' },
  });
  process.stdout.write(result);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(e.status || 1);
}
try { fs.unlinkSync('${y}'); } catch {}
`,v=w.join(m.tmpdir(),`oc-run-${Date.now()}.js`).replace(/\\/g,"/");h.writeFileSync(v,$,"utf-8");let S=(0,t.spawn)("node",[v],{shell:!1,stdio:["ignore","pipe","pipe"],env:{...process.env,OPENCLAW_GATEWAY_TOKEN:""}});S.on("exit",()=>{try{h.unlinkSync(v)}catch{}try{h.unlinkSync(y)}catch{}});let O="",N="";return S.stdout.on("data",e=>{O+=e.toString("utf-8")}),S.stderr.on("data",e=>{N+=e.toString("utf-8")}),S.on("close",async e=>{console.log(`[openclaw] Process exited with code ${e}`),console.log(`[openclaw] stdout length: ${O.length}`),N&&console.log(`[openclaw] stderr: ${N.slice(0,200)}`);try{let e,t=!1;try{let e=await fetch(`${r.replace("/api/openclaw/callback","/api/drafts")}?instanceId=${s}`),n=await e.json(),o=n.data?.[0];if(o){let e=await fetch(`${r.replace("/api/openclaw/callback","/api/drafts")}/${o.id}`),n=await e.json(),s=n.data?.content;s&&!s._placeholder&&!s._rawText&&s.marketSize&&(console.log("[openclaw] Agent already posted valid report via direct callback, skipping stdout parse"),t=!0)}}catch{}if(t)return;let n=o.keyword||"产品",i=O.trim();try{let e=JSON.parse(i);e.payloads?.[0]?.text&&(i=e.payloads[0].text)}catch{}let l=p(i);l.length>0?e={...l.find(e=>e.marketSize||e.priceDistribution||e.competitors)||l.sort((e,t)=>JSON.stringify(t).length-JSON.stringify(e).length)[0],keyword:n}:(console.warn("[openclaw] No JSON found in agent output, using raw text fallback"),e={keyword:n,overview:i||"调研完成",generatedAt:new Date().toISOString(),_rawText:!0}),console.log("[openclaw] Posting callback to",r),await fetch(r,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instanceId:s,nodeId:a,status:"completed",output:{fullReport:e}})}),console.log("[openclaw] Callback posted successfully")}catch(e){console.error("[openclaw] Callback failed:",e);try{await fetch(r,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instanceId:s,nodeId:a,status:"failed",error:e instanceof Error?e.message:String(e)})})}catch{}}}),setTimeout(()=>{try{S.kill()}catch{}},6e5),{queued:!0}}catch(e){return console.error("[openclaw] Failed to spawn:",e),{queued:!1}}}async function i(e,n){let r=n.filter(e=>["taobao","jd","1688","pinduoduo","douyin","xiaohongshu"].includes(e));if(0===r.length)return{scraped:"",productCount:0};console.log(`[pre-scrape] Scraping ${r.length} platforms for "${e}"`);let o=[],a=[];for(let n of r){let r=await function(e,n,r=20){return new Promise(o=>{let a=(0,t.execFile)("node",[s,e,n,"--limit",String(r)],{encoding:"utf-8",timeout:45e3,env:process.env},(t,n,r)=>{if(r&&console.log(`[scrape:${e}] ${r.slice(0,200)}`),t){console.warn(`[scrape:${e}] Failed:`,t.message?.slice(0,100)),o(null);return}try{let t=JSON.parse(n.trim());t.success&&t.products?.length>0?(console.log(`[scrape:${e}] Got ${t.products.length} products`),o(t)):(console.warn(`[scrape:${e}] No products:`,t.error||"empty"),o(null))}catch{console.warn(`[scrape:${e}] Invalid JSON output`),o(null)}});setTimeout(()=>{try{a.kill()}catch{}},5e4)})}(n,e);if(r&&Array.isArray(r.products)){let e=r.products;o.push(...e),a.push(`### ${n} (${e.length} products)
${JSON.stringify(e.slice(0,30),null,0)}`)}else a.push(`### ${n}
采集失败或无数据`)}return{scraped:`

=== 以下是 Playwright 真实采集的商品数据（共 ${o.length} 条）===
请直接使用这些数据生成报告，不要编造任何商品或店铺。每条 product 中的 url 字段是真实链接，必须原样传递到 competitors 的 url 字段。

${a.join("\n\n")}

=== 采集数据结束 ===`,productCount:o.length}}async function l(e,t){try{let n=new Date(Date.now()-24*t*36e5),r=await googleTrends.interestOverTime({keyword:e,startTime:n,geo:"CN"}),o=JSON.parse(r),s=o.default?.timelineData;if(!s||0===s.length)return console.warn("[google-trends] No timeline data returned"),{trends:"",success:!1};let a=s.map(e=>({date:e.formattedTime,value:e.value[0]})),i=`

=== 以下是 Google Trends 真实搜索热度数据（关键词: "${e}", 地区: 中国, 近${t}天）===
数据格式: [{date, value}]，value 为 0-100 的相对搜索热度。
请直接使用这些数据生成 searchTrends 章节，不要编造趋势数据。

${JSON.stringify(a)}

=== Google Trends 数据结束 ===`;return console.log(`[google-trends] Got ${a.length} data points for "${e}"`),{trends:i,success:!0}}catch(e){return console.warn("[google-trends] Failed:",e instanceof Error?e.message:String(e)),{trends:"",success:!1}}}function c(){return new Promise(e=>{let n=(0,t.spawn)("openclaw",["--version"],{shell:!0,stdio:"pipe"});n.on("close",t=>e(0===t)),n.on("error",()=>e(!1)),setTimeout(()=>{try{n.kill()}catch{}e(!1)},3e3)})}async function u(){let t=await e.A(23970),n=await e.A(89793),r=n.join(n.dirname(process.execPath),"node_modules","openclaw","openclaw.mjs");if(t.existsSync(r))return r.replace(/\\/g,"/");if(process.env.APPDATA){let e=n.join(process.env.APPDATA,"npm","node_modules","openclaw","openclaw.mjs");if(t.existsSync(e))return e.replace(/\\/g,"/")}return"D:/App/Dev/nvm/v24.13.0/node_modules/openclaw/openclaw.mjs"}function d(e,t,n,o){if("market-research"===e){let e=t.keyword||"产品",s=t.sources||["taobao","jd","xiaohongshu","google_trends"],a=t.depth||"standard",i=t.dateRange||30;return`/market-research keyword="${e}" sources=${JSON.stringify(s)} depth="${a}" dateRange=${i} callbackUrl="${r}" instanceId="${n}" nodeId="${o}"`}if("marketing-factory"===e){let e=t.keyword||"产品",s=t.style||"活力";return`你是一个专业的电商营销文案专家。为"${e}"写营销文案，风格：${s}。

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "headlines": ["标题1", "标题2", "标题3"],
  "mainCopy": "主文案（50-100字）",
  "hashtags": ["#话题1", "#话题2", "#话题3"],
  "callToAction": "行动号召语"
}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${o}","status":"completed","output":{"result": <你的JSON结果>}}`}if("customer-service"===e){let e=t.customerMessage||t.message||"我的订单什么时候发货？",s=t.customerName||t.name||"顾客",a=t.orderInfo?JSON.stringify(t.orderInfo):"",i=t.intent||"",l=t.sentiment||"",c=t.ticketId||n,u="",d=t.knowledgeChunks,p=t.knowledgeRules;return d&&d.length>0&&(u+=`

【文档参考】以下是从文档库检索到的相关片段，基于它自由组织回复：
${d.map((e,t)=>`片段${t+1} [来源:${e.filename}]:
  ${e.content}`).join("\n\n")}
【文档参考结束】`),p&&p.length>0&&(u+=`

【话术参考】以下是标准回复模板，优先参考这些话术：
${p.map((e,t)=>`规则${t+1} [ID:${e.id}]:
  条件：${e.condition}
  回复参考：${e.content}
  置信度：${(100*e.confidence).toFixed(0)}%`).join("\n\n")}
【话术参考结束】`),`你是一个专业的电商客服代表，请处理以下客户工单并生成回复草稿。

客户姓名：${s}
客户消息：${e}
${i?`意图分类：${i}`:""}
${l?`客户情绪：${l}`:""}
${a?`订单信息：${a}`:""}
${u}

要求：
1. 语气亲切专业，解决客户问题
2. 如果知识库规则中有相关回复参考，请基于它生成回复（可适当调整措辞），并在 citedRuleIds 中标注引用的规则 ID
3. 回复简洁明了，不超过150字
4. reasoning 字段说明你为什么这样回复（引用了哪些规则、做了什么判断）

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "reply": "回复内容",
  "intent": "意图分类",
  "sentiment": "情感分析",
  "citedRuleIds": ["引用的规则ID"],
  "reasoning": "推理过程说明",
  "confidence": 0.85
}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${o}","status":"completed","output":{"result": <你的JSON结果>, "ticketId": "${c}"}}`}if("product-listing"===e){let e=t.keyword||"产品",s=t.category||"通用",a=t.productInfo?JSON.stringify(t.productInfo):"{}";return`你是一个专业的电商产品上架专家。请为以下产品生成完整的上架信息。

产品名称：${e}
品类：${s}
产品信息：${a}

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "title": "产品标题（不超过60字，包含关键词）",
  "bullets": ["卖点1", "卖点2", "卖点3", "卖点4", "卖点5"],
  "description": "产品描述（100-200字）",
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "suggestedPrice": 299,
  "pricingReason": "定价依据说明"
}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${o}","status":"completed","output":{"result": <你的JSON结果>}}`}if("diff-classify"===e){let e=t.original||"",s=t.edited||"";return`你是一个文本分析专家。请判断以下两段客服回复之间的修改属于"语义修改"还是"措辞修改"。

原始回复：${e}
修改后回复：${s}

判断标准：
- 语义修改(semantic)：改变了回复的实质内容、政策、承诺或解决方案
- 措辞修改(cosmetic)：只调整了用语、语气、格式，但实质内容不变

返回严格JSON格式（不要任何其他文字）：
{"diffType": "semantic或cosmetic", "reason": "判断依据"}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${o}","status":"completed","output":{"result": <你的JSON结果>}}`}if("knowledge-extract"===e){let e=t.message||"";return`你是一个客服知识管理专家。用户用自然语言描述了一条业务规则，请从中提取结构化的知识规则。

用户输入：${e}

请从中提取：
1. condition: 触发条件（什么情况下使用这条规则）
2. content: 回复内容（客服应该怎么说）
3. tags: 标签数组（如：退货、尺码、物流、优惠、材质、运费等）

返回严格JSON格式（不要任何其他文字）：
{"condition": "触发条件", "content": "回复内容", "tags": ["标签1", "标签2"]}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${o}","status":"completed","output":{"result": <你的JSON结果>}}`}if("knowledge-extract-batch"===e){let e=t.fileContent||"",s=t.fileName||"未知文件";return`你是一个专业的客服知识管理专家。请从以下文件内容中提取客服知识规则。

${e}

要求：
1. 从文件内容中识别出所有可用于客服自动回复的知识点
2. 每条规则转化为：condition（客户可能问的问题）、content（客服回复内容）、tags（标签）
3. 如果原文是产品说明/规格，请转化为客户 Q&A 的形式
4. content 应该语气亲切专业，适合直接作为客服回复使用
5. tags 从以下选择：退货、物流、尺码、材质、优惠、售后、支付、售前、定制、运费

返回严格JSON数组格式（不要任何其他文字、不要markdown代码块）：
[{"condition":"客户问...", "content":"回复内容...", "tags":["标签"]}]

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${o}","status":"completed","output":{"result": <你的JSON数组>, "fileName": "${s}"}}`}return`/skill ${e} ${JSON.stringify(t)}`}function p(e){let t,n=[],r=/```(?:json)?\s*\n?([\s\S]*?)```/g;for(;null!==(t=r.exec(e));)try{let e=JSON.parse(t[1].trim());"object"==typeof e&&null!==e&&n.push(e)}catch{}if(0===n.length){let r=/\{[\s\S]*\}/g;for(;null!==(t=r.exec(e));)try{let e=JSON.parse(t[0]);"object"==typeof e&&null!==e&&n.push(e)}catch{}}return n}async function f(n,r,o=12e4){try{if(!await c())return console.warn("[openclaw-sync] CLI not available"),null;let s=`sync-${Date.now()}`,a=d(n,r,s,"sync"),i=a.indexOf("完成后将结果 POST");i>0&&(a=a.slice(0,i).trim()),a+="\n\n请直接返回JSON结果，不要POST到任何URL。";let l=await e.A(23970),f=await e.A(7480),g=await e.A(89793),h=g.join(f.tmpdir(),`oc-sync-${Date.now()}.txt`).replace(/\\/g,"/");l.writeFileSync(h,a,"utf-8");let m=await u(),w=`
const { execFileSync } = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('${h}', 'utf-8');
try {
  const result = execFileSync(process.execPath, ['${m}', 'agent', '--agent', 'main', '-m', msg, '--json'], {
    encoding: 'utf-8',
    timeout: ${o},
    env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' },
  });
  process.stdout.write(result);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(e.status || 1);
}
`,y=g.join(f.tmpdir(),`oc-sync-run-${Date.now()}.js`).replace(/\\/g,"/");return l.writeFileSync(y,w,"utf-8"),new Promise(e=>{let n=(0,t.spawn)("node",[y],{shell:!1,stdio:["ignore","pipe","pipe"],env:{...process.env,OPENCLAW_GATEWAY_TOKEN:""}}),r="",s="";n.stdout.on("data",e=>{r+=e.toString("utf-8")}),n.stderr.on("data",e=>{s+=e.toString("utf-8")});let a=setTimeout(()=>{try{n.kill()}catch{}console.warn("[openclaw-sync] Timeout after",o,"ms"),e(null)},o);n.on("close",t=>{clearTimeout(a);try{l.unlinkSync(h)}catch{}try{l.unlinkSync(y)}catch{}if(console.log(`[openclaw-sync] Exit code: ${t}, stdout: ${r.length} bytes`),s&&console.log(`[openclaw-sync] stderr: ${s.slice(0,200)}`),!r.trim())return void e(null);let n=r.trim();try{let e=JSON.parse(n);e.payloads?.[0]?.text&&(n=e.payloads[0].text)}catch{}let o=n.match(/\[[\s\S]*\]/);if(o)try{let t=JSON.parse(o[0]);if(Array.isArray(t))return void e(t)}catch{}let i=p(n);i.length>0?e(1===i.length?i[0]:i):(console.warn("[openclaw-sync] No JSON found in output"),e(null))}),n.on("error",()=>{clearTimeout(a),e(null)})})}catch(e){return console.error("[openclaw-sync] Failed:",e),null}}e.s(["callOpenClawSync",()=>f,"sendToOpenClaw",()=>a])},23249,e=>{"use strict";let t={退货:["退货","退换","退回","退款","七天无理由","7天无理由"],物流:["物流","快递","配送","发货","包裹","运输","到达"],尺码:["尺码","尺寸","大小","号码","偏大","偏小","码数"],材质:["材质","面料","纯棉","涤纶","成分","布料"],优惠:["优惠","折扣","满减","促销","打折","优惠券","活动"],售后:["售后","维修","保修","换货","质量问题"],支付:["支付","付款","转账","货到付款","分期"],运费:["运费","包邮","邮费"]};function n(e,n){let r=`${e} ${n}`,o=[];for(let[e,n]of Object.entries(t))n.some(e=>r.includes(e))&&o.push(e);return o.length>0?o:["通用"]}async function r(e,t){let n=t.split(".").pop()?.toLowerCase()||"";try{switch(n){case"xlsx":case"xls":return await o(e);case"pdf":return await s(e);case"csv":return function(e){let t=e.split("\n").filter(e=>e.trim());if(t.length<2)return{text:e,structured:[]};let n=t[0];n.toLowerCase();let r=n.includes("	")?"	":",",o=n.split(r).map(e=>e.trim().toLowerCase()),s=o.findIndex(e=>["条件","condition","问题","question","q","触发"].includes(e)),a=o.findIndex(e=>["内容","content","回答","answer","a","回复","reply"].includes(e));if(s>=0&&a>=0){let n=[];for(let e=1;e<t.length;e++){let o=t[e].split(r).map(e=>e.trim()),i=o[s],l=o[a];i&&l&&n.push({condition:i,content:l})}return{text:e,structured:n}}return{text:e,structured:[]}}(e.toString("utf-8"));default:return{text:e.toString("utf-8"),structured:[]}}}catch(e){return console.error(`[file-parser] Failed to extract from ${t}:`,e),{text:"",structured:[]}}}async function o(t){let n=await e.A(20733),r=n.default??n,o=r.read(t,{type:"buffer"}),s=o.SheetNames[0],a=o.Sheets[s];if(!a)return{text:"",structured:[]};let i=r.utils.sheet_to_csv(a),l=r.utils.sheet_to_json(a),c=[];for(let e of l){let t=e["条件"]||e.condition||e.Condition||e["问题"]||e.question||e.Question||"",n=e["内容"]||e.content||e.Content||e["回答"]||e.answer||e.Answer||e["回复"]||"";t&&n&&c.push({condition:String(t),content:String(n)})}return 0===c.length?{text:i,structured:[]}:{text:i,structured:c}}async function s(t){let n=await e.A(41106),r=n.default||n;return{text:(await r(t)).text||"",structured:[]}}e.s(["extractTextFromFile",()=>r,"inferTags",()=>n])},64685,e=>{"use strict";var t=e.i(94499),n=e.i(76339),r=e.i(93648),o=e.i(26248),s=e.i(72100),a=e.i(80115),i=e.i(75458),l=e.i(69571),c=e.i(94757),u=e.i(47812),d=e.i(26798),p=e.i(4232),f=e.i(51909),g=e.i(62676),h=e.i(90547),m=e.i(93695);e.i(52105);var w=e.i(76233),y=e.i(90594);async function x(e,t){let n=e.toString("utf-8").trim();return n?function(e){let t=[];for(let n=0;n<e.length;n++){let r=e[n];if("customer"===r.role&&n+1<e.length){let o=e[n+1];"agent"===o.role&&(o.content.length>=10&&t.push({customer:r.content,agent:o.content}),n++)}}let n=new Set;return t.filter(e=>{let t=`${e.customer}|${e.agent}`;return!n.has(t)&&(n.add(t),!0)})}("json"===(t.split(".").pop()?.toLowerCase()||"")||n.startsWith("[")?function(e){try{let t=JSON.parse(e);if(!Array.isArray(t))return[];return t.filter(e=>e.role&&e.content).map(e=>({role:String(e.role),content:String(e.content)}))}catch{return[]}}(n):function(e){let t=e.split("\n").filter(e=>e.trim());if(0===t.length)return[];let n=t[0].toLowerCase(),r=n.includes("role")&&n.includes("content")?1:0,o=[];for(let e=r;e<t.length;e++){let n=t[e],r=n.indexOf(",");if(r<0)continue;let s=n.slice(0,r).trim(),a=n.slice(r+1).trim();s&&a&&o.push({role:s,content:a})}return o}(n)):[]}let $={退货退款:["退货","退款","退回","不想要","换货"],物流配送:["物流","快递","配送","发货","运费","到货","签收"],尺码规格:["尺码","尺寸","大小","规格","颜色","款式"],优惠活动:["优惠","打折","折扣","满减","券","活动","促销"]};var v=e.i(50960),S=e.i(23249);async function O(e){let t,n=e.headers.get("content-type")||"",r=0;if(n.includes("multipart/form-data")){let n=(await e.formData()).get("file");if(!n)return y.NextResponse.json({error:"No file provided"},{status:400});let o=await n.arrayBuffer(),s=Buffer.from(o),a=await x(s,n.name);r=function(e,t){try{let n=t.split(".").pop()?.toLowerCase()||"";if("json"===n||e.startsWith("[")){let t=JSON.parse(e);if(!Array.isArray(t))return 0;let n=0;for(let e=0;e<t.length;e++)t[e]?.role==="customer"&&e+1<t.length&&t[e+1]?.role==="agent"&&n++;return n}let r=e.split("\n").filter(e=>e.trim()),o=0;for(let e=0;e<r.length;e++){let t=r[e],n=t.indexOf(",");if(n<0)continue;let s=t.slice(0,n).trim();if("customer"===s&&e+1<r.length){let t=r[e+1],n=t.indexOf(",");n>=0&&"agent"===t.slice(0,n).trim()&&o++}}return o}catch{return 0}}(s.toString("utf-8").trim(),n.name),t=a}else t=(await e.json()).conversations,r=t?.length??0;if(!Array.isArray(t)||0===t.length)return y.NextResponse.json({error:"未解析到有效对话（短回复已过滤）"},{status:400});let o=t.length,{sampled:s,stats:a}=function(e,t=30){let n=e.length,r={};for(let t of e){let e=function(e){let t=e.customer+e.agent;for(let[e,n]of Object.entries($))if(n.some(e=>t.includes(e)))return e;return"通用"}(t);r[e]||(r[e]=[]),r[e].push(t)}let o=Math.ceil(t/Object.keys(r).length),s=[],a={};for(let[e,t]of Object.entries(r)){let n=[...t].sort((e,t)=>t.agent.length-e.agent.length).slice(0,o);s.push(...n),a[e]=n.length}let i=s.slice(0,t);return{sampled:i,stats:{original:n,afterDedup:n,afterFilter:n,sampled:i.length,groups:a}}}(t,30);a.original=r||o,a.afterDedup=o,a.afterFilter=o;let i=s.map((e,t)=>`对话${t+1}:
  客户: ${e.customer}
  客服: ${e.agent}`).join("\n\n"),l=await (0,v.callOpenClawSync)("knowledge-extract-batch",{fileContent:i,fileName:"历史对话记录"});if(l&&Array.isArray(l)&&l.length>0){let e=l.map(e=>({condition:e.condition||"",content:e.content||"",tags:e.tags||(0,S.inferTags)(e.condition||"",e.content||""),source:"conversation",confidence:.85}));return y.NextResponse.json({data:e,meta:{total:e.length,source:"ai",parsedConversations:s.length,stats:a}})}let c=s.map(e=>({condition:e.customer.length>50?e.customer.slice(0,50)+"...":e.customer,content:e.agent,tags:(0,S.inferTags)(e.customer,e.agent),source:"conversation",confidence:.7}));return y.NextResponse.json({data:c,meta:{total:c.length,source:"local",parsedConversations:s.length,stats:a}})}e.s(["POST",()=>O],88265);var N=e.i(88265);let A=new t.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/knowledge/import-conversations/route",pathname:"/api/knowledge/import-conversations",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/knowledge/import-conversations/route.ts",nextConfigOutput:"",userland:N}),{workAsyncStorage:k,workUnitAsyncStorage:R,serverHooks:C}=A;function T(){return(0,r.patchFetch)({workAsyncStorage:k,workUnitAsyncStorage:R})}async function j(e,t,r){A.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let y="/api/knowledge/import-conversations/route";y=y.replace(/\/index$/,"")||"/";let x=await A.prepare(e,t,{srcPage:y,multiZoneDraftMode:!1});if(!x)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:$,params:v,nextConfig:S,parsedUrl:O,isDraftMode:N,prerenderManifest:k,routerServerContext:R,isOnDemandRevalidate:C,revalidateOnlyGenerated:T,resolvedPathname:j,clientReferenceManifest:_,serverActionsManifest:P}=x,E=(0,i.normalizeAppPath)(y),b=!!(k.dynamicRoutes[E]||k.routes[j]),I=async()=>((null==R?void 0:R.render404)?await R.render404(e,t,O,!1):t.end("This page could not be found"),null);if(b&&!N){let e=!!k.routes[j],t=k.dynamicRoutes[E];if(t&&!1===t.fallback&&!e){if(S.experimental.adapterPath)return await I();throw new m.NoFallbackError}}let J=null;!b||A.isDev||N||(J="/index"===(J=j)?"/":J);let D=!0===A.isDev||!b,q=b&&!D;P&&_&&(0,a.setManifestsSingleton)({page:y,clientReferenceManifest:_,serverActionsManifest:P});let F=e.method||"GET",L=(0,s.getTracer)(),U=L.getActiveScopeSpan(),H={params:v,prerenderManifest:k,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:D,incrementalCache:(0,o.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:S.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,r,o)=>A.onRequestError(e,t,r,o,R)},sharedContext:{buildId:$}},K=new l.NodeNextRequest(e),M=new l.NodeNextResponse(t),W=c.NextRequestAdapter.fromNodeNextRequest(K,(0,c.signalFromNodeResponse)(t));try{let a=async e=>A.handle(W,H).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let n=L.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=n.get("next.route");if(r){let t=`${F} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t)}else e.updateName(`${F} ${y}`)}),i=!!(0,o.getRequestMeta)(e,"minimalMode"),l=async o=>{var s,l;let c=async({previousCacheEntry:n})=>{try{if(!i&&C&&T&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await a(o);e.fetchMetrics=H.renderOpts.fetchMetrics;let l=H.renderOpts.pendingWaitUntil;l&&r.waitUntil&&(r.waitUntil(l),l=void 0);let c=H.renderOpts.collectedTags;if(!b)return await (0,p.sendResponse)(K,M,s,H.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,f.toNodeOutgoingHttpHeaders)(s.headers);c&&(t[h.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==H.renderOpts.collectedRevalidate&&!(H.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&H.renderOpts.collectedRevalidate,r=void 0===H.renderOpts.collectedExpire||H.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:H.renderOpts.collectedExpire;return{value:{kind:w.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:r}}}}catch(t){throw(null==n?void 0:n.isStale)&&await A.onRequestError(e,t,{routerKind:"App Router",routePath:y,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:C})},!1,R),t}},u=await A.handleResponse({req:e,nextConfig:S,cacheKey:J,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:k,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:T,responseGenerator:c,waitUntil:r.waitUntil,isMinimalMode:i});if(!b)return null;if((null==u||null==(s=u.value)?void 0:s.kind)!==w.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(l=u.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});i||t.setHeader("x-nextjs-cache",C?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),N&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,f.fromNodeOutgoingHttpHeaders)(u.value.headers);return i&&b||m.delete(h.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,g.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(K,M,new Response(u.value.body,{headers:m,status:u.value.status||200})),null};U?await l(U):await L.withPropagatedContext(e.headers,()=>L.trace(u.BaseServerSpan.handleRequest,{spanName:`${F} ${y}`,kind:s.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},l))}catch(t){if(t instanceof m.NoFallbackError||await A.onRequestError(e,t,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:C})},!1,R),b)throw t;return await (0,p.sendResponse)(K,M,new Response(null,{status:500})),null}}e.s(["handler",()=>j,"patchFetch",()=>T,"routeModule",()=>A,"serverHooks",()=>C,"workAsyncStorage",()=>k,"workUnitAsyncStorage",()=>R],64685)},23970,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_fs_54ffce70._.js"].map(t=>e.l(t))).then(()=>t(22734)))},7480,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_os_066ffa03._.js"].map(t=>e.l(t))).then(()=>t(46786)))},89793,e=>{e.v(e=>Promise.resolve().then(()=>e(14747)))},20733,e=>{e.v(t=>Promise.all(["server/chunks/a505b_xlsx_xlsx_mjs_95922ec0._.js"].map(t=>e.l(t))).then(()=>t(26276)))},41106,e=>{e.v(t=>Promise.all(["server/chunks/67e58_pdf-parse_dist_pdf-parse_esm_index_64ca61ec.js"].map(t=>e.l(t))).then(()=>t(58244)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__eb06d086._.js.map
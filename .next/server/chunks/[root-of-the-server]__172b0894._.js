module.exports=[70406,(e,t,n)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},18622,(e,t,n)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,n)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},14747,(e,t,n)=>{t.exports=e.x("path",()=>require("path"))},93695,(e,t,n)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},80313,(e,t,n)=>{t.exports=e.x("@prisma/client-bd102ee44d0467c7",()=>require("@prisma/client-bd102ee44d0467c7"))},16496,e=>{"use strict";var t=e.i(80313);let n=globalThis.prisma||new t.PrismaClient;e.s(["prisma",0,n])},22734,(e,t,n)=>{t.exports=e.x("fs",()=>require("fs"))},56345,e=>{"use strict";var t=e.i(22734),n=e.i(14747);let r=(0,n.join)(process.cwd(),"data");(0,n.join)(r,"vector-store.json");class s{entries=new Map;embedFn=null;collectionName;filePath;initialized=!1;constructor(e="knowledge-rules"){this.collectionName=e,this.filePath=(0,n.join)(r,`vectors-${e}.json`)}async init(){if(!this.initialized){if((0,t.existsSync)(this.filePath))try{for(let e of JSON.parse((0,t.readFileSync)(this.filePath,"utf-8")))this.entries.set(e.id,e)}catch{}this.embedFn||(this.embedFn=await o()),this.initialized=!0}}async ensureInit(){this.initialized||await this.init()}persist(){(0,t.existsSync)(r)||(0,t.mkdirSync)(r,{recursive:!0});let e=Array.from(this.entries.values());(0,t.writeFileSync)(this.filePath,JSON.stringify(e),"utf-8")}async upsert(e,t,n,r={}){await this.ensureInit();let s=`${t} ${n}`,o=await this.embedFn(s);this.entries.set(e,{id:e,document:s,embedding:o,metadata:r}),this.persist()}async query(e,t=5){if(await this.ensureInit(),0===this.entries.size)return[];let n=await this.embedFn(e),r=[];for(let e of this.entries.values()){let t=function(e,t){if(e.length!==t.length)return 0;let n=0,r=0,s=0;for(let o=0;o<e.length;o++)n+=e[o]*t[o],r+=e[o]*e[o],s+=t[o]*t[o];let o=Math.sqrt(r)*Math.sqrt(s);return 0===o?0:n/o}(n,e.embedding);r.push({id:e.id,score:t,metadata:e.metadata,document:e.document})}return r.sort((e,t)=>t.score-e.score),r.slice(0,t)}async remove(e){await this.ensureInit(),this.entries.delete(e),this.persist()}async reset(){if(this.entries.clear(),(0,t.existsSync)(this.filePath))try{(0,t.writeFileSync)(this.filePath,"[]","utf-8")}catch{}this.initialized=!1}get size(){return this.entries.size}}async function o(){let{pipeline:t}=await e.A(77788),n=await t("feature-extraction","Xenova/all-MiniLM-L6-v2");return async e=>Array.from((await n(e,{pooling:"mean",normalize:!0})).data)}let i=null;function a(){return i||(i=new s),i}e.s(["getVectorStore",()=>a])},33405,(e,t,n)=>{t.exports=e.x("child_process",()=>require("child_process"))},50960,e=>{"use strict";var t=e.i(33405),n=e.i(14747);let r=process.env.OPENCLAW_CALLBACK_URL||"http://localhost:3848/api/openclaw/callback",s=(0,n.resolve)(process.cwd()).replace(/\\/g,"/"),o=(0,n.join)(s,"openclaw/scripts/platform-scrape.mjs").replace(/\\/g,"/");async function i(n,s,o,i){try{if(!await l())return console.warn("[openclaw] CLI not available"),{queued:!1};let f="";if("market-research"===n){let e=s.keyword||"",t=s.researchConfig?.sources||s.sources||["taobao"],n=s.dateRange||s.researchConfig?.dateRange||30,[r,o]=await Promise.all([a(e,t),c(e,n)]);f=r.scraped+o.trends,console.log(`[openclaw] Pre-scraped ${r.productCount} products, Google Trends: ${o.success?"OK":"failed"}`)}let g=u(n,s,o,i)+f,h=await e.A(23970),m=await e.A(7480),y=await e.A(89793),w=y.join(m.tmpdir(),`oc-msg-${Date.now()}.txt`).replace(/\\/g,"/");h.writeFileSync(w,g,"utf-8");let $=await d(),S=`
const { execFileSync } = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('${w}', 'utf-8');
try {
  const result = execFileSync(process.execPath, ['${$}', 'agent', '--agent', 'main', '-m', msg, '--json'], {
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
try { fs.unlinkSync('${w}'); } catch {}
`,x=y.join(m.tmpdir(),`oc-run-${Date.now()}.js`).replace(/\\/g,"/");h.writeFileSync(x,S,"utf-8");let O=(0,t.spawn)("node",[x],{shell:!1,stdio:["ignore","pipe","pipe"],env:{...process.env,OPENCLAW_GATEWAY_TOKEN:""}});O.on("exit",()=>{try{h.unlinkSync(x)}catch{}try{h.unlinkSync(w)}catch{}});let k="",N="";return O.stdout.on("data",e=>{k+=e.toString("utf-8")}),O.stderr.on("data",e=>{N+=e.toString("utf-8")}),O.on("close",async e=>{console.log(`[openclaw] Process exited with code ${e}`),console.log(`[openclaw] stdout length: ${k.length}`),N&&console.log(`[openclaw] stderr: ${N.slice(0,200)}`);try{let e,t=!1;try{let e=await fetch(`${r.replace("/api/openclaw/callback","/api/drafts")}?instanceId=${o}`),n=await e.json(),s=n.data?.[0];if(s){let e=await fetch(`${r.replace("/api/openclaw/callback","/api/drafts")}/${s.id}`),n=await e.json(),o=n.data?.content;o&&!o._placeholder&&!o._rawText&&o.marketSize&&(console.log("[openclaw] Agent already posted valid report via direct callback, skipping stdout parse"),t=!0)}}catch{}if(t)return;let n=s.keyword||"产品",a=k.trim();try{let e=JSON.parse(a);e.payloads?.[0]?.text&&(a=e.payloads[0].text)}catch{}let c=p(a);c.length>0?e={...c.find(e=>e.marketSize||e.priceDistribution||e.competitors)||c.sort((e,t)=>JSON.stringify(t).length-JSON.stringify(e).length)[0],keyword:n}:(console.warn("[openclaw] No JSON found in agent output, using raw text fallback"),e={keyword:n,overview:a||"调研完成",generatedAt:new Date().toISOString(),_rawText:!0}),console.log("[openclaw] Posting callback to",r),await fetch(r,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instanceId:o,nodeId:i,status:"completed",output:{fullReport:e}})}),console.log("[openclaw] Callback posted successfully")}catch(e){console.error("[openclaw] Callback failed:",e);try{await fetch(r,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instanceId:o,nodeId:i,status:"failed",error:e instanceof Error?e.message:String(e)})})}catch{}}}),setTimeout(()=>{try{O.kill()}catch{}},6e5),{queued:!0}}catch(e){return console.error("[openclaw] Failed to spawn:",e),{queued:!1}}}async function a(e,n){let r=n.filter(e=>["taobao","jd","1688","pinduoduo","douyin","xiaohongshu"].includes(e));if(0===r.length)return{scraped:"",productCount:0};console.log(`[pre-scrape] Scraping ${r.length} platforms for "${e}"`);let s=[],i=[];for(let n of r){let r=await function(e,n,r=20){return new Promise(s=>{let i=(0,t.execFile)("node",[o,e,n,"--limit",String(r)],{encoding:"utf-8",timeout:45e3,env:process.env},(t,n,r)=>{if(r&&console.log(`[scrape:${e}] ${r.slice(0,200)}`),t){console.warn(`[scrape:${e}] Failed:`,t.message?.slice(0,100)),s(null);return}try{let t=JSON.parse(n.trim());t.success&&t.products?.length>0?(console.log(`[scrape:${e}] Got ${t.products.length} products`),s(t)):(console.warn(`[scrape:${e}] No products:`,t.error||"empty"),s(null))}catch{console.warn(`[scrape:${e}] Invalid JSON output`),s(null)}});setTimeout(()=>{try{i.kill()}catch{}},5e4)})}(n,e);if(r&&Array.isArray(r.products)){let e=r.products;s.push(...e),i.push(`### ${n} (${e.length} products)
${JSON.stringify(e.slice(0,30),null,0)}`)}else i.push(`### ${n}
采集失败或无数据`)}return{scraped:`

=== 以下是 Playwright 真实采集的商品数据（共 ${s.length} 条）===
请直接使用这些数据生成报告，不要编造任何商品或店铺。每条 product 中的 url 字段是真实链接，必须原样传递到 competitors 的 url 字段。

${i.join("\n\n")}

=== 采集数据结束 ===`,productCount:s.length}}async function c(e,t){try{let n=new Date(Date.now()-24*t*36e5),r=await googleTrends.interestOverTime({keyword:e,startTime:n,geo:"CN"}),s=JSON.parse(r),o=s.default?.timelineData;if(!o||0===o.length)return console.warn("[google-trends] No timeline data returned"),{trends:"",success:!1};let i=o.map(e=>({date:e.formattedTime,value:e.value[0]})),a=`

=== 以下是 Google Trends 真实搜索热度数据（关键词: "${e}", 地区: 中国, 近${t}天）===
数据格式: [{date, value}]，value 为 0-100 的相对搜索热度。
请直接使用这些数据生成 searchTrends 章节，不要编造趋势数据。

${JSON.stringify(i)}

=== Google Trends 数据结束 ===`;return console.log(`[google-trends] Got ${i.length} data points for "${e}"`),{trends:a,success:!0}}catch(e){return console.warn("[google-trends] Failed:",e instanceof Error?e.message:String(e)),{trends:"",success:!1}}}function l(){return new Promise(e=>{let n=(0,t.spawn)("openclaw",["--version"],{shell:!0,stdio:"pipe"});n.on("close",t=>e(0===t)),n.on("error",()=>e(!1)),setTimeout(()=>{try{n.kill()}catch{}e(!1)},3e3)})}async function d(){let t=await e.A(23970),n=await e.A(89793),r=n.join(n.dirname(process.execPath),"node_modules","openclaw","openclaw.mjs");if(t.existsSync(r))return r.replace(/\\/g,"/");if(process.env.APPDATA){let e=n.join(process.env.APPDATA,"npm","node_modules","openclaw","openclaw.mjs");if(t.existsSync(e))return e.replace(/\\/g,"/")}return"D:/App/Dev/nvm/v24.13.0/node_modules/openclaw/openclaw.mjs"}function u(e,t,n,s){if("market-research"===e){let e=t.keyword||"产品",o=t.sources||["taobao","jd","xiaohongshu","google_trends"],i=t.depth||"standard",a=t.dateRange||30;return`/market-research keyword="${e}" sources=${JSON.stringify(o)} depth="${i}" dateRange=${a} callbackUrl="${r}" instanceId="${n}" nodeId="${s}"`}if("marketing-factory"===e){let e=t.keyword||"产品",o=t.style||"活力";return`你是一个专业的电商营销文案专家。为"${e}"写营销文案，风格：${o}。

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "headlines": ["标题1", "标题2", "标题3"],
  "mainCopy": "主文案（50-100字）",
  "hashtags": ["#话题1", "#话题2", "#话题3"],
  "callToAction": "行动号召语"
}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${s}","status":"completed","output":{"result": <你的JSON结果>}}`}if("customer-service"===e){let e=t.customerMessage||t.message||"我的订单什么时候发货？",o=t.customerName||t.name||"顾客",i=t.orderInfo?JSON.stringify(t.orderInfo):"",a=t.intent||"",c=t.sentiment||"",l=t.ticketId||n,d="",u=t.knowledgeChunks,p=t.knowledgeRules;return u&&u.length>0&&(d+=`

【文档参考】以下是从文档库检索到的相关片段，基于它自由组织回复：
${u.map((e,t)=>`片段${t+1} [来源:${e.filename}]:
  ${e.content}`).join("\n\n")}
【文档参考结束】`),p&&p.length>0&&(d+=`

【话术参考】以下是标准回复模板，优先参考这些话术：
${p.map((e,t)=>`规则${t+1} [ID:${e.id}]:
  条件：${e.condition}
  回复参考：${e.content}
  置信度：${(100*e.confidence).toFixed(0)}%`).join("\n\n")}
【话术参考结束】`),`你是一个专业的电商客服代表，请处理以下客户工单并生成回复草稿。

客户姓名：${o}
客户消息：${e}
${a?`意图分类：${a}`:""}
${c?`客户情绪：${c}`:""}
${i?`订单信息：${i}`:""}
${d}

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
{"instanceId":"${n}","nodeId":"${s}","status":"completed","output":{"result": <你的JSON结果>, "ticketId": "${l}"}}`}if("product-listing"===e){let e=t.keyword||"产品",o=t.category||"通用",i=t.productInfo?JSON.stringify(t.productInfo):"{}";return`你是一个专业的电商产品上架专家。请为以下产品生成完整的上架信息。

产品名称：${e}
品类：${o}
产品信息：${i}

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
{"instanceId":"${n}","nodeId":"${s}","status":"completed","output":{"result": <你的JSON结果>}}`}if("diff-classify"===e){let e=t.original||"",o=t.edited||"";return`你是一个文本分析专家。请判断以下两段客服回复之间的修改属于"语义修改"还是"措辞修改"。

原始回复：${e}
修改后回复：${o}

判断标准：
- 语义修改(semantic)：改变了回复的实质内容、政策、承诺或解决方案
- 措辞修改(cosmetic)：只调整了用语、语气、格式，但实质内容不变

返回严格JSON格式（不要任何其他文字）：
{"diffType": "semantic或cosmetic", "reason": "判断依据"}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${s}","status":"completed","output":{"result": <你的JSON结果>}}`}if("knowledge-extract"===e){let e=t.message||"";return`你是一个客服知识管理专家。用户用自然语言描述了一条业务规则，请从中提取结构化的知识规则。

用户输入：${e}

请从中提取：
1. condition: 触发条件（什么情况下使用这条规则）
2. content: 回复内容（客服应该怎么说）
3. tags: 标签数组（如：退货、尺码、物流、优惠、材质、运费等）

返回严格JSON格式（不要任何其他文字）：
{"condition": "触发条件", "content": "回复内容", "tags": ["标签1", "标签2"]}

完成后将结果 POST 到 ${r}：
{"instanceId":"${n}","nodeId":"${s}","status":"completed","output":{"result": <你的JSON结果>}}`}if("knowledge-extract-batch"===e){let e=t.fileContent||"",o=t.fileName||"未知文件";return`你是一个专业的客服知识管理专家。请从以下文件内容中提取客服知识规则。

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
{"instanceId":"${n}","nodeId":"${s}","status":"completed","output":{"result": <你的JSON数组>, "fileName": "${o}"}}`}return`/skill ${e} ${JSON.stringify(t)}`}function p(e){let t,n=[],r=/```(?:json)?\s*\n?([\s\S]*?)```/g;for(;null!==(t=r.exec(e));)try{let e=JSON.parse(t[1].trim());"object"==typeof e&&null!==e&&n.push(e)}catch{}if(0===n.length){let r=/\{[\s\S]*\}/g;for(;null!==(t=r.exec(e));)try{let e=JSON.parse(t[0]);"object"==typeof e&&null!==e&&n.push(e)}catch{}}return n}async function f(n,r,s=12e4){try{if(!await l())return console.warn("[openclaw-sync] CLI not available"),null;let o=`sync-${Date.now()}`,i=u(n,r,o,"sync"),a=i.indexOf("完成后将结果 POST");a>0&&(i=i.slice(0,a).trim()),i+="\n\n请直接返回JSON结果，不要POST到任何URL。";let c=await e.A(23970),f=await e.A(7480),g=await e.A(89793),h=g.join(f.tmpdir(),`oc-sync-${Date.now()}.txt`).replace(/\\/g,"/");c.writeFileSync(h,i,"utf-8");let m=await d(),y=`
const { execFileSync } = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('${h}', 'utf-8');
try {
  const result = execFileSync(process.execPath, ['${m}', 'agent', '--agent', 'main', '-m', msg, '--json'], {
    encoding: 'utf-8',
    timeout: ${s},
    env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' },
  });
  process.stdout.write(result);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(e.status || 1);
}
`,w=g.join(f.tmpdir(),`oc-sync-run-${Date.now()}.js`).replace(/\\/g,"/");return c.writeFileSync(w,y,"utf-8"),new Promise(e=>{let n=(0,t.spawn)("node",[w],{shell:!1,stdio:["ignore","pipe","pipe"],env:{...process.env,OPENCLAW_GATEWAY_TOKEN:""}}),r="",o="";n.stdout.on("data",e=>{r+=e.toString("utf-8")}),n.stderr.on("data",e=>{o+=e.toString("utf-8")});let i=setTimeout(()=>{try{n.kill()}catch{}console.warn("[openclaw-sync] Timeout after",s,"ms"),e(null)},s);n.on("close",t=>{clearTimeout(i);try{c.unlinkSync(h)}catch{}try{c.unlinkSync(w)}catch{}if(console.log(`[openclaw-sync] Exit code: ${t}, stdout: ${r.length} bytes`),o&&console.log(`[openclaw-sync] stderr: ${o.slice(0,200)}`),!r.trim())return void e(null);let n=r.trim();try{let e=JSON.parse(n);e.payloads?.[0]?.text&&(n=e.payloads[0].text)}catch{}let s=n.match(/\[[\s\S]*\]/);if(s)try{let t=JSON.parse(s[0]);if(Array.isArray(t))return void e(t)}catch{}let a=p(n);a.length>0?e(1===a.length?a[0]:a):(console.warn("[openclaw-sync] No JSON found in output"),e(null))}),n.on("error",()=>{clearTimeout(i),e(null)})})}catch(e){return console.error("[openclaw-sync] Failed:",e),null}}e.s(["callOpenClawSync",()=>f,"sendToOpenClaw",()=>i])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__172b0894._.js.map
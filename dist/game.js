import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const MAX_PERIODS = 3, ACTIONS_PER_PERIOD = 10;
const COLORS = ["金", "青", "赤", "緑", "紫", "橙"];
const MARKET_TEMPLATE = [
  { id:"north", name:"北部市場", buy:2, cap:14, demand:8 },
  { id:"central", name:"中央市場", buy:3, cap:17, demand:6 },
  { id:"coast", name:"沿岸市場", buy:1, cap:11, demand:10 }
];
const AI_NAMES = ["つばさ商事", "みらい工業", "北星カンパニー"];
let mode = null, myId = null, roomCode = null, state = null, online = null, selectedAction = null, reportTab = "pl";

function player(name, ai=false, index=0){ return {name,ai,color:COLORS[index],cash:300,materials:0,products:0,workers:1,machines:1,ads:0,quality:0,training:0,debt:0,actions:0,revenue:0,cogs:0,expenses:0,profit:0}; }
function freshGame(players, order, host=""){ return {phase:"playing",period:1,current:0,host,order,players,markets:MARKET_TEMPLATE.map(m=>({...m,remaining:m.demand})),logs:[{text:"会社を設立し、第1期を開始しました。"}],competition:null,report:null}; }
function equity(p){ return Math.round(p.cash+p.materials*2+p.products*4+p.machines*18-p.debt); }
function capacity(p){ return p.workers*2+p.machines*3+p.training; }
function currentId(s=state){ return s.order[s.current]; }
function market(id,s=state){ return s.markets.find(m=>m.id===id); }
function addLog(s,text){ s.logs.unshift({text,at:Date.now()}); s.logs=s.logs.slice(0,60); }

function nameValue(){ return $("playerName").value.trim() || "社長"; }
function showScreen(id){ ["startScreen","lobbyScreen","gameScreen"].forEach(x=>$(x).hidden=x!==id); }
function showError(id,msg){ $(id).textContent=msg; }

$("soloBtn").onclick=()=>{
  mode="solo"; myId="human";
  const players={human:player(nameValue(),false,0)}; AI_NAMES.forEach((n,i)=>players[`ai${i}`]=player(n,true,i+1));
  state=freshGame(players,Object.keys(players)); showScreen("gameScreen"); render();
};

async function firebase(){
  if(online) return online;
  if(!firebaseConfig.apiKey||!firebaseConfig.databaseURL) throw new Error("firebase-config.jsの設定が必要です。");
  const [{initializeApp},{getAuth,signInAnonymously},{getDatabase,ref,set,onValue,runTransaction,get,remove}]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js")
  ]);
  const app=initializeApp(firebaseConfig); const auth=getAuth(app); const cred=await signInAnonymously(auth);
  online={db:getDatabase(app),ref,set,onValue,runTransaction,get,remove,uid:cred.user.uid}; return online;
}

function makeCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
$("createBtn").onclick=async()=>{
  try{ showError("startError","接続しています…"); const f=await firebase(); mode="online"; myId=f.uid; roomCode=makeCode();
    const lobby={phase:"lobby",host:myId,createdAt:Date.now(),players:{[myId]:{name:nameValue(),color:COLORS[0]}}};
    await f.set(f.ref(f.db,`rooms/${roomCode}`),lobby); watchRoom(); showScreen("lobbyScreen"); showError("startError","");
  }catch(e){showError("startError",e.message)}
};
$("joinBtn").onclick=async()=>{
  try{ const code=$("roomCode").value.trim().toUpperCase(); if(code.length!==6) throw new Error("6文字のルームコードを入力してください。");
    showError("startError","接続しています…"); const f=await firebase(); const snap=await f.get(f.ref(f.db,`rooms/${code}`)); if(!snap.exists()) throw new Error("ルームが見つかりません。");
    const data=snap.val(); if(data.phase!=="lobby") throw new Error("このルームはゲーム開始済みです。"); if(Object.keys(data.players||{}).length>=6) throw new Error("このルームは満員です。");
    mode="online"; myId=f.uid; roomCode=code; await f.set(f.ref(f.db,`rooms/${code}/players/${myId}`),{name:nameValue(),color:COLORS[Object.keys(data.players).length]}); watchRoom(); showScreen("lobbyScreen"); showError("startError","");
  }catch(e){showError("startError",e.message)}
};

function watchRoom(){
  const f=online; f.onValue(f.ref(f.db,`rooms/${roomCode}`),snap=>{
    if(!snap.exists()){ location.reload(); return; } state=snap.val();
    if(state.phase==="lobby"){ showScreen("lobbyScreen"); renderLobby(); }
    else{ showScreen("gameScreen"); render(); handleRemotePhase(); }
  });
}
function renderLobby(){
  $("copyCode").textContent=roomCode; const entries=Object.entries(state.players||{});
  $("lobbyPlayers").innerHTML=entries.map(([id,p])=>`<div><b>${escapeHtml(p.name)}</b><small>${id===state.host?" ホスト":" 参加者"}</small></div>`).join("");
  $("startGameBtn").hidden=myId!==state.host; $("startGameBtn").disabled=entries.length<2; $("lobbyNote").textContent=`${entries.length} / 6人参加中`;
}
$("copyCode").onclick=()=>navigator.clipboard?.writeText(roomCode);
$("startGameBtn").onclick=async()=>{
  const f=online; await f.runTransaction(f.ref(f.db,`rooms/${roomCode}`),r=>{
    if(!r||r.host!==myId||r.phase!=="lobby") return r; const order=Object.keys(r.players); const ps={}; order.forEach((id,i)=>ps[id]=player(r.players[id].name,false,i)); return freshGame(ps,order,myId);
  });
};

function render(){ if(!state||state.phase==="lobby")return; const me=state.players[myId]; if(!me)return;
  $("clock").textContent=`第${state.period}期・${Math.min(me.actions+1,ACTIONS_PER_PERIOD)}手目`;
  $("myName").textContent=me.name; $("myCash").textContent=`${Math.round(me.cash)}万円`;
  $("resources").innerHTML=[["材料",me.materials],["製品",me.products],["社員",me.workers],["設備",me.machines],["広告",me.ads],["品質",me.quality],["借入",`${me.debt}万`]].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
  $("markets").innerHTML=state.markets.map(m=>`<article class="market"><h3>${m.name}</h3><p>需要 ${m.remaining}/${m.demand}</p><div class="track">${Array.from({length:m.demand},(_,i)=>`<i class="${i>=m.remaining?"off":""}"></i>`).join("")}</div><dl><dt>材料単価</dt><dd>${m.buy}万円</dd><dt>販売上限</dt><dd>${m.cap}万円</dd></dl></article>`).join("");
  const ranked=Object.entries(state.players).sort((a,b)=>equity(b[1])-equity(a[1]));
  $("companies").innerHTML=ranked.map(([id,p],i)=>`<div class="company-row"><header><b>${i+1}. ${escapeHtml(p.name)}${id===myId?"（自社）":""}</b><span>${p.actions}/${ACTIONS_PER_PERIOD}手</span></header><dl><div><dt>自己資本</dt><dd>${equity(p)}</dd></div><div><dt>製品</dt><dd>${p.products}</dd></div><div><dt>販売</dt><dd>${p.revenue}</dd></div></dl></div>`).join("");
  $("gameLog").innerHTML=(state.logs||[]).map(l=>`<li>${escapeHtml(l.text)}</li>`).join("");
  const mine=currentId()===myId&&state.phase==="playing"&&!state.competition; const waiting=state.competition?"販売コンペの入札中です。":mine?"あなたの手番です。経営行動を1つ選んでください。":`${escapeHtml(state.players[currentId()]?.name||"")}の手番を待っています。`;
  $("turnMessage").textContent=waiting; document.querySelectorAll("#actions button").forEach(b=>b.disabled=!mine); $("news").textContent=state.logs?.[0]?.text||"市場は平穏です。";
  if(mode==="solo"&&state.phase==="report")showReport(false); if(mode==="solo"&&state.phase==="finished")showReport(true);
}

document.querySelectorAll("#actions button").forEach(b=>b.onclick=()=>openAction(b.dataset.action));
function openAction(action){ const p=state.players[myId]; selectedAction=action; showError("actionError","");
  if(action==="sell"){ openBid(true); return; }
  if(["hire","machine","ad","research","train","borrow","pass"].includes(action)){ performAction(action,{}); return; }
  const buy=action==="buy"; $("actionTitle").textContent=buy?"材料を購入":"製品を製造"; $("actionHelp").textContent=buy?"仕入市場と数量を選択します。":"材料を使い、生産能力の範囲で製品を作ります。";
  $("marketField").hidden=!buy; $("actionMarket").innerHTML=state.markets.map(m=>`<option value="${m.id}">${m.name}（${m.buy}万円）</option>`).join(""); $("actionQty").max=buy?6:Math.max(1,Math.min(p.materials,capacity(p))); $("actionQty").value=1; updateActionCost(); $("actionDialog").showModal();
}
$("actionMarket").onchange=updateActionCost; $("actionQty").oninput=updateActionCost;
function updateActionCost(){ const q=+$('actionQty').value||0; const cost=selectedAction==="buy"?market($("actionMarket").value).buy*q:q; $("actionCost").textContent=`必要資金：${cost}万円`; }
$("actionForm").onsubmit=e=>{e.preventDefault(); const args={qty:+$("actionQty").value,marketId:$("actionMarket").value}; const err=validateAction(state.players[myId],selectedAction,args); if(err){showError("actionError",err);return} $("actionDialog").close(); performAction(selectedAction,args);};

function validateAction(p,a,x={}){ const costs={hire:20,machine:30,ad:12,research:18,train:14};
  if(a==="buy"&&p.cash<market(x.marketId).buy*x.qty)return"現金が不足しています。"; if(a==="produce"&&(x.qty>p.materials||x.qty>capacity(p)))return"材料または生産能力が不足しています。";
  if(costs[a]&&p.cash<costs[a])return"現金が不足しています。"; if(a==="borrow"&&p.debt>=90)return"借入上限に達しています。"; return"";
}
function applyAction(s,id,a,x={}){ const p=s.players[id], costs={hire:20,machine:30,ad:12,research:18,train:14}; let text="";
  if(a==="buy"){const m=marketFrom(s,x.marketId);p.cash-=m.buy*x.qty;p.materials+=x.qty;p.cogs+=m.buy*x.qty;text=`${p.name}が${m.name}で材料を${x.qty}個購入。`;}
  if(a==="produce"){p.cash-=x.qty;p.materials-=x.qty;p.products+=x.qty;p.cogs+=x.qty;text=`${p.name}が製品を${x.qty}個製造。`;}
  if(a==="hire"){p.cash-=20;p.workers++;p.expenses+=20;text=`${p.name}が社員を1人採用。`;}
  if(a==="machine"){p.cash-=30;p.machines++;text=`${p.name}が設備を増設。`;}
  if(a==="ad"){p.cash-=12;p.ads++;p.expenses+=12;text=`${p.name}が広告を実施。`;}
  if(a==="research"){p.cash-=18;p.quality++;p.expenses+=18;text=`${p.name}が研究開発を実施。`;}
  if(a==="train"){p.cash-=14;p.training++;p.expenses+=14;text=`${p.name}が社員教育を実施。`;}
  if(a==="borrow"){p.cash+=30;p.debt+=30;text=`${p.name}が銀行から30万円を借入。`;}
  if(a==="pass")text=`${p.name}は資金を温存。`; p.actions++; addLog(s,text);
}
function marketFrom(s,id){return s.markets.find(m=>m.id===id)}

async function performAction(a,x){
  if(mode==="solo"){const err=validateAction(state.players[myId],a,x);if(err)return;applyAction(state,myId,a,x);runAiRound();afterRoundLocal();render();}
  else await online.runTransaction(online.ref(online.db,`rooms/${roomCode}`),s=>{if(!s||s.phase!=="playing"||currentId(s)!==myId||s.competition)return s; const p=s.players[myId];if(validateAction(p,a,x))return s;applyAction(s,myId,a,x);advance(s);return s;});
}
function advance(s){ if(Object.values(s.players).every(p=>p.actions>=ACTIONS_PER_PERIOD)){settle(s);return} let n=s.current;do{n=(n+1)%s.order.length}while(s.players[s.order[n]].actions>=ACTIONS_PER_PERIOD);s.current=n; }
function settle(s){ const rows={};Object.entries(s.players).forEach(([id,p])=>{const fixed=p.workers*6+p.machines*4+p.ads*2+p.quality*2+p.training*2+Math.ceil(p.debt*.1)+p.products;p.cash-=fixed;p.expenses+=fixed;p.profit=p.revenue-p.cogs-p.expenses;if(p.cash<0){p.debt+=Math.ceil(-p.cash/10)*10;p.cash+=Math.ceil(-p.cash/10)*10}rows[id]={name:p.name,revenue:p.revenue,cogs:p.cogs,expenses:p.expenses,profit:p.profit,equity:equity(p)};});s.report={period:s.period,rows};s.phase=s.period>=MAX_PERIODS?"finished":"report";addLog(s,`第${s.period}期の決算を行いました。`);}
function nextPeriod(s){s.period++;s.current=0;s.markets=MARKET_TEMPLATE.map(m=>({...m,remaining:m.demand}));Object.values(s.players).forEach(p=>{p.actions=0;p.revenue=0;p.cogs=0;p.expenses=0;p.profit=0});s.phase="playing";s.report=null;addLog(s,`第${s.period}期を開始しました。`);}

function openBid(initiating){ const p=state.players[myId]; $("bidMarketField").hidden=!initiating; $("bidMarket").innerHTML=state.markets.filter(m=>m.remaining>0).map(m=>`<option value="${m.id}">${m.name}（上限${m.cap}万円・残${m.remaining}個）</option>`).join(""); $("bidQty").max=Math.max(1,p.products);$("bidQty").value=Math.min(2,Math.max(1,p.products));$("bidPrice").value=10;$("bidHelp").textContent=initiating?"市場を選び、販売コンペを開始します。":"他社が販売コンペを開始しました。秘密入札してください。";$("bidStatus").textContent=`自社製品 ${p.products}個｜広告 ${p.ads}｜品質 ${p.quality}`;$("skipBid").hidden=initiating;showError("bidError","");if(!$("bidDialog").open)$("bidDialog").showModal(); }
$("bidForm").onsubmit=e=>{e.preventDefault();submitBid(false)};$("skipBid").onclick=()=>submitBid(true);
async function submitBid(skip){const p=state.players[myId],qty=skip?0:+$("bidQty").value,price=+$("bidPrice").value;
  if(!skip&&(p.products<qty||qty<1)){showError("bidError","販売できる製品数を確認してください。");return}
  if(mode==="solo"){const m=market($("bidMarket").value);if(price>m.cap){showError("bidError",`価格上限は${m.cap}万円です。`);return} const bids={[myId]:{qty,price}};state.order.filter(id=>id!==myId).forEach(id=>{const a=state.players[id];bids[id]=a.products?{qty:Math.min(a.products,1+Math.floor(Math.random()*3)),price:Math.min(m.cap,7+Math.floor(Math.random()*6))}: {qty:0,price:0};});resolveCompetition(state,m.id,bids);state.players[myId].actions++;addLog(state,`${p.name}が${m.name}で販売コンペを開催。`);$("bidDialog").close();runAiRound(false);afterRoundLocal();render();return}
  const f=online;await f.runTransaction(f.ref(f.db,`rooms/${roomCode}`),s=>{if(!s)return s;
    if(!s.competition){if(currentId(s)!==myId||skip)return s;const m=marketFrom(s,$("bidMarket").value);if(price>m.cap)return s;const bids={[myId]:{qty,price}};s.order.forEach(id=>{if(!s.players[id].products&&id!==myId)bids[id]={qty:0,price:0}});s.competition={marketId:m.id,initiator:myId,bids};}
    else if(!s.competition.bids?.[myId]){const m=marketFrom(s,s.competition.marketId);if(!skip&&price>m.cap)return s;s.competition.bids=s.competition.bids||{};s.competition.bids[myId]={qty,price};}return s;});$("bidDialog").close();
}

function resolveCompetition(s,marketId,bids){const m=marketFrom(s,marketId);let left=m.remaining;const valid=Object.entries(bids).filter(([id,b])=>b.qty>0&&s.players[id].products>0&&b.price<=m.cap).sort((a,b)=>a[1].price-b[1].price||s.players[b[0]].ads-s.players[a[0]].ads||s.players[b[0]].quality-s.players[a[0]].quality);
  const result=[];valid.forEach(([id,b])=>{const p=s.players[id],q=Math.min(left,b.qty,p.products);if(!q)return;p.products-=q;p.cash+=q*b.price;p.revenue+=q*b.price;left-=q;result.push(`${p.name} ${q}個×${b.price}万`);});m.remaining=left;addLog(s,`${m.name}の落札：${result.join("、")||"成立なし"}`);s.competition=null;}

function runAiRound(allowSell=true){state.order.filter(id=>id!==myId).forEach(id=>{const p=state.players[id];if(p.actions>=ACTIONS_PER_PERIOD)return;let a,x={};
    if(p.cash<25){a="borrow"}else if(p.products>2&&allowSell&&Math.random()<.4){const ms=state.markets.filter(m=>m.remaining>0);if(ms.length){const m=ms[Math.floor(Math.random()*ms.length)];const bids={[id]:{qty:Math.min(p.products,3),price:Math.min(m.cap,8+Math.floor(Math.random()*5))}};state.order.filter(x=>x!==myId&&x!==id).forEach(x=>{const q=state.players[x];bids[x]=q.products?{qty:Math.min(q.products,2),price:Math.min(m.cap,8+Math.floor(Math.random()*5))}:{qty:0,price:0}});resolveCompetition(state,m.id,bids);p.actions++;return}}
    if(p.materials>0&&p.products<4){a="produce";x={qty:Math.min(p.materials,capacity(p),3)}}else if(p.materials<2){a="buy";const m=[...state.markets].sort((a,b)=>a.buy-b.buy)[0];x={qty:3,marketId:m.id}}else{a=["ad","research","hire","machine"][Math.floor(Math.random()*4)]} if(validateAction(p,a,x))a="pass";applyAction(state,id,a,x);
  });}
function afterRoundLocal(){if(state.players[myId].actions>=ACTIONS_PER_PERIOD)settle(state);}

function handleRemotePhase(){
  if(state.phase==="playing"&&$("reportDialog").open)$("reportDialog").close();
  if(state.competition&&!state.competition.bids?.[myId]&&state.players[myId].products>0)openBid(false);
  if(mode==="online"&&myId===state.host&&state.competition&&Object.keys(state.competition.bids||{}).length===state.order.length){online.runTransaction(online.ref(online.db,`rooms/${roomCode}`),s=>{if(!s?.competition)return s;const initiator=s.competition.initiator;resolveCompetition(s,s.competition.marketId,s.competition.bids);s.players[initiator].actions++;advance(s);return s;});}
  if(state.phase==="report")showReport(false); if(state.phase==="finished")showReport(true);
}
function showReport(final=false){const r=state.report;if(!r)return;reportTab=final?"rank":"pl";$("reportTitle").textContent=final?"最終決算":`第${r.period}期 決算`;$("reportNext").textContent=final?"最終順位を見る":myId===state.host||mode==="solo"?"次の期へ":"ホストが進めるのを待つ";$("reportNext").disabled=!final&&mode==="online"&&myId!==state.host;renderReport();if(!$("reportDialog").open)$("reportDialog").showModal();}
function renderReport(){const rows=state.report.rows;document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===reportTab));if(reportTab==="rank"){$("reportBody").innerHTML=Object.entries(rows).sort((a,b)=>b[1].equity-a[1].equity).map(([id,r],i)=>`<div class="rank-row"><b>${i+1}</b><span>${escapeHtml(r.name)}${id===myId?"（自社）":""}</span><b>${r.equity}万円</b></div>`).join("");return}const r=rows[myId];$("reportBody").innerHTML=reportTab==="pl"?`<table><tr><td>売上高 PQ</td><td>${r.revenue}</td></tr><tr><td>変動費 VQ</td><td>${r.cogs}</td></tr><tr><td>固定費 F</td><td>${r.expenses}</td></tr><tr class="total"><td>利益 G</td><td>${r.profit}</td></tr></table>`:`<table><tr><td>現金</td><td>${state.players[myId].cash}</td></tr><tr><td>材料・製品価値</td><td>${state.players[myId].materials*2+state.players[myId].products*4}</td></tr><tr><td>設備価値</td><td>${state.players[myId].machines*18}</td></tr><tr><td>借入金</td><td>-${state.players[myId].debt}</td></tr><tr class="total"><td>自己資本</td><td>${r.equity}</td></tr></table>`;}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{reportTab=b.dataset.tab;renderReport()});
$("reportNext").onclick=async()=>{if(state.phase==="finished"){$("reportDialog").close();showFinal();return}if(mode==="solo"){nextPeriod(state);$("reportDialog").close();render()}else if(myId===state.host){await online.runTransaction(online.ref(online.db,`rooms/${roomCode}`),s=>{if(s?.phase==="report")nextPeriod(s);return s});$("reportDialog").close();}};
function showFinal(){const rows=state.report.rows;$("finalBody").innerHTML=Object.entries(rows).sort((a,b)=>b[1].equity-a[1].equity).map(([id,r],i)=>`<div class="rank-row"><b>${i+1}</b><span>${escapeHtml(r.name)}${id===myId?"（自社）":""}</span><b>${r.equity}万円</b></div>`).join("");$("finalDialog").showModal()}

$("rulesBtn").onclick=()=>$("rulesDialog").showModal();document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());$("resetBtn").onclick=()=>{if(confirm("ゲームから退出しますか？"))location.reload()};$("againBtn").onclick=()=>location.reload();
$("bidDialog").addEventListener("cancel",e=>{if(state?.competition){e.preventDefault();showError("bidError","入札するか辞退を選んでください。")}});
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}

// 対応ブラウザでは、AIエージェントから現在の会社状況を読み取れるようにします。
if(document.modelContext?.registerTool) Promise.resolve(document.modelContext.registerTool({name:"read_company_status",description:"現在の経営ゲームの自社状態を読み取る。",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>state?.players?.[myId]||{status:"not_started"}})).catch(()=>{});

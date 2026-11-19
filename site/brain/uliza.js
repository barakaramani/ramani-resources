/* Uliza Ramani: the AI assistant on every Ramani resource page.
   Brain order: 1) RAMANI.brainEndpoint on the live site (/api/uliza: Claude or Cloudflare Workers AI),
   2) Claude through the artifact viewer (demo), 3) quick answers from Ramani's own tools when no AI is available.
   Numbers always come from Ramani's tools (RG_CORE), never from the model.
   The chat is kept for the browser session, so it survives moving between pages.
   When a trader shows real intent, a small card offers to send the estimate on WhatsApp, with consent. */
(function(){
  if(window.__uliza) return; window.__uliza=1;
  var C=window.RG_CORE, R=window.RAMANI||{};
  if(!C) return;
  var SW=function(){ return document.documentElement.lang==="sw"; };
  var page=(location.pathname.split("/").pop()||"index.html");
  var FONT="var(--sans,Galvji,Inter,system-ui,sans-serif)";

  var css=document.createElement("style");
  css.textContent=
  ".ul-fab{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:58;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px 12px 12px;background:var(--ds-secondary-1,#1E222E);color:#fff;font:700 15px "+FONT+";box-shadow:0 12px 30px rgba(0,0,0,.25);cursor:pointer;transition:transform .15s}"+
  ".ul-fab:hover{transform:translateY(-2px)}.ul-fab:active{transform:none}"+
  ".ul-dot{width:30px;height:30px;border-radius:50%;background:var(--ds-primary,#04C401);display:grid;place-items:center;flex:none}"+
  ".ul-dot svg{width:17px;height:17px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}"+
  ".ul-panel{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:59;width:min(410px,calc(100vw - 32px));height:min(640px,calc(100dvh - 32px));display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#1F2937);border:1px solid var(--line,#D9DDE7);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.28);overflow:hidden;font-family:"+FONT+"}"+
  ".ul-head{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:var(--ds-secondary-1,#1E222E);color:#fff}"+
  ".ul-head b{display:block;font-size:15.5px;letter-spacing:.1px}.ul-head small{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.85}"+
  ".ul-head small i{width:7px;height:7px;border-radius:50%;background:var(--ds-primary,#04C401);display:inline-block}"+
  ".ul-hb{margin-left:auto;display:flex;gap:6px}.ul-hb button{background:rgba(255,255,255,.12);border:0;color:#fff;width:34px;height:34px;border-radius:6px;font-size:18px;line-height:1;cursor:pointer;display:grid;place-items:center}"+
  ".ul-hb button:hover{background:rgba(255,255,255,.22)}.ul-hb svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}"+
  ".ul-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#F7F9FF);overscroll-behavior:contain}"+
  ".ul-m{max-width:90%;padding:10px 13px;border-radius:12px;font-size:14.5px;line-height:1.55;overflow-wrap:anywhere}"+
  ".ul-m.u{align-self:flex-end;background:var(--ds-secondary-1,#1E222E);color:#fff;border-bottom-right-radius:4px}"+
  ".ul-m.a{align-self:flex-start;background:var(--surface,#fff);border:1px solid var(--line,#D9DDE7);border-bottom-left-radius:4px}"+
  ".ul-m.a a{color:var(--brand-text,#027A00);font-weight:700;text-decoration:underline;text-underline-offset:2px}"+
  ".ul-m.a ul{margin:6px 0;padding-left:18px}.ul-m.a li{margin:2px 0}.ul-m.a p{margin:0 0 6px}.ul-m.a p:last-child{margin:0}"+
  ".ul-m.a .note{font-size:12px;color:var(--muted,#4B5563);margin-top:6px}"+
  ".ul-typing{display:inline-flex;gap:4px;padding:4px 2px}.ul-typing i{width:7px;height:7px;border-radius:50%;background:var(--muted,#6B7280);opacity:.4;animation:ulb 1.1s infinite}"+
  ".ul-typing i:nth-child(2){animation-delay:.15s}.ul-typing i:nth-child(3){animation-delay:.3s}"+
  "@keyframes ulb{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}"+
  "@media (prefers-reduced-motion:reduce){.ul-typing i{animation:none}.ul-fab{transition:none}}"+
  ".ul-chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:100%}"+
  ".ul-chip{font:600 13px "+FONT+";border:1px solid var(--line,#D9DDE7);background:var(--surface,#fff);color:var(--ink,#1F2937);border-radius:999px;padding:7px 12px;cursor:pointer;text-align:left}"+
  ".ul-chip:hover{border-color:var(--ds-primary,#04C401);color:var(--brand-text,#027A00)}"+
  ".ul-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px;border-top:1px solid var(--line,#D9DDE7);background:var(--surface,#fff)}"+
  ".ul-form textarea{flex:1;resize:none;height:44px;max-height:120px;font:500 16px "+FONT+";color:var(--ink,#1F2937);background:var(--bg,#F7F9FF);border:1px solid var(--line,#D9DDE7);border-radius:6px;padding:10px 12px;min-width:0;line-height:1.4}"+
  ".ul-form button{border:0;border-radius:6px;background:var(--ds-primary,#04C401);color:#fff;font:700 15px "+FONT+";height:44px;padding:0 16px;cursor:pointer}"+
  ".ul-form button:hover{background:var(--ds-hover,#5897DC)}.ul-form button:active{background:var(--ds-pressed,#0C4A8F)}"+
  ".ul-form button.stop{background:var(--ds-error,#EB5757)}"+
  ".ul-foot{padding:6px 14px 10px;font-size:11.5px;color:var(--muted,#4B5563);background:var(--surface,#fff);display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}"+
  ".ul-foot button{background:none;border:0;color:var(--brand-text,#027A00);font:700 12.5px "+FONT+";cursor:pointer;padding:0}"+
  ".ul-card{display:grid;gap:8px;align-self:stretch;background:var(--surface,#fff);border:1px solid var(--ds-primary,#04C401);border-left-width:4px;border-radius:12px;padding:12px 13px;font-size:14px}"+
  ".ul-card b{font-size:14.5px}.ul-card p{margin:0;color:var(--muted,#4B5563);font-size:13px;line-height:1.45}"+
  ".ul-card input:not([type=checkbox]){font:500 16px "+FONT+";border:1px solid var(--line,#D9DDE7);border-radius:6px;padding:9px 11px;background:var(--bg,#F7F9FF);color:var(--ink,#1F2937);min-width:0}"+
  ".ul-card label{display:flex!important;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.4;font-weight:500;margin:0;text-align:left}"+
  ".ul-card label input{width:18px!important;height:18px;flex:none;margin:1px 0 0!important;padding:0}.ul-card label span{flex:1;min-width:0}"+
  ".ul-card .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}"+
  ".ul-card .go{border:0;border-radius:6px;background:var(--ds-primary,#04C401);color:#fff;font:700 14px "+FONT+";padding:9px 14px;cursor:pointer}"+
  ".ul-card .go:hover{background:var(--ds-hover,#5897DC)}"+
  ".ul-card .no{border:0;background:none;color:var(--muted,#4B5563);font:600 13px "+FONT+";cursor:pointer;padding:6px}"+
  ".ul-card .e{color:var(--ds-error,#EB5757);font-size:12.5px}"+
  "@media (max-width:520px){.ul-panel{right:0;left:0;bottom:0;width:100%;height:min(92dvh,680px);border-radius:16px 16px 0 0}.ul-fab>span:last-child{display:none}.ul-fab{padding:10px}}"+
  ".ul-panel[hidden],.ul-fab[hidden]{display:none!important}"+
  "@media print{.ul-fab,.ul-panel{display:none!important}}";
  document.head.appendChild(css);

  var BUBBLE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>';
  var NEW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  var fab=document.createElement("button"); fab.type="button"; fab.className="ul-fab"; fab.setAttribute("data-noi18n","");
  fab.innerHTML='<span class="ul-dot">'+BUBBLE+"</span><span></span>"; document.body.appendChild(fab);
  var panel=document.createElement("section"); panel.className="ul-panel"; panel.hidden=true; panel.setAttribute("role","dialog"); panel.setAttribute("aria-label","Uliza Ramani"); panel.setAttribute("data-noi18n","");
  panel.innerHTML='<div class="ul-head"><span class="ul-dot">'+BUBBLE+'</span><div><b>Uliza Ramani</b><small><i></i><span class="sub"></span></small></div>'+
    '<div class="ul-hb"><button type="button" class="nw">'+NEW+'</button><button type="button" class="x">×</button></div></div>'+
    '<div class="ul-log" aria-live="polite"></div><form class="ul-form"><textarea rows="1"></textarea><button type="submit" class="go"></button></form>'+
    '<div class="ul-foot"><span class="disc"></span><button type="button" class="cb"></button></div>';
  document.body.appendChild(panel);
  var log=panel.querySelector(".ul-log"), form=panel.querySelector(".ul-form"), box=form.querySelector("textarea"), go=form.querySelector(".go");

  var GOODS={household:["household goods","bidhaa za nyumbani"],elec:["electronics","vifaa vya umeme"],build:["building materials","vifaa vya ujenzi"],textile:["clothes","nguo"],food:["food","chakula"],cosm:["cosmetics","vipodozi"],med:["medicines","dawa"],agri:["farm inputs","pembejeo za kilimo"],mach:["machinery","mashine"],parts:["spare parts","vipuri"],furn:["furniture","samani"]};
  var REG={dar:"Dar es Salaam",aru:"Arusha",mwz:"Mwanza",mby:"Mbeya",dod:"Dodoma"};
  var T={
    en:{fab:"Uliza Ramani",sub:"Import assistant · Kiswahili and English",ph:"Ask about costs, permits, suppliers…",send:"Ask",stop:"Stop",nw:"New chat",x:"Close",
      disc:"AI answers can be wrong. Numbers come from Ramani's tools. Finance is subject to assessment.",cb:"Ask a BDM to call me",
      hi:"Habari! I'm Uliza Ramani. Ask me what an import will cost, which permits you need, how to pay a supplier or what a word means. I'll point you to the right free tool.",
      chips:["What will USD 15,000 of tiles from China cost me in Mwanza?","Which permits do I need to import cosmetics?","How do I pay a supplier in China safely?","What is demurrage?"],
      more:["How many free days do I get at Dar port?","Which documents do I need to import?","How do I pay a supplier in China safely?","What is demurrage?","How do I work out landed cost?"],
      permQ:function(g){ return "Which permits do I need for "+g+"?"; },costQ:function(g){ return "What will USD 10,000 of "+g+" from China cost me?"; },regQ:function(r){ return "What if it goes to "+r+" instead?"; },payQ:"How do I pay the supplier safely?",
      offline:"Here is a quick answer from Ramani's tools:",err:"Sorry, I could not answer that just now. Try again, or ask a BDM to call you.",
      noai:"AI is not available in this view, so I am answering from Ramani's tools.",stopped:"Stopped.",
      cbT:"A Ramani BDM will call you within one working day.",name:"Your name",phone:"WhatsApp number",
      cbOk:"Ramani may call or message me about my question.",cbGo:"Call me",cbDone:"Done. A Ramani BDM will call you within one working day.",
      fErr:"Please add your name, a Tanzanian number and tick the box.",
      lead:{plan:{t:"Get this estimate on WhatsApp",p:"We'll send your estimate and a few useful import tips. Reply STOP anytime.",ok:"Ramani may message me on WhatsApp about my import. I can reply STOP anytime.",go:"Send it",done:"Sent. Check your WhatsApp soon, and keep asking here anytime."},
        finance:{t:"Talk to a Ramani BDM about paying your supplier",p:"A BDM will contact you within one working day. Financing is subject to assessment.",ok:"Ramani may call or message me about financing my stock.",go:"Contact me",done:"Thank you. A Ramani BDM will contact you within one working day."},
        tips:{t:"Get weekly import tips on WhatsApp",p:"Exchange rates, clearing tips and free tools, once a week. Reply STOP anytime.",ok:"Ramani may send me import tips on WhatsApp. I can reply STOP anytime.",go:"Join",done:"You're in. Your first tips arrive this week."},
        me:"Use my saved details",no:"Not now"}},
    sw:{fab:"Uliza Ramani",sub:"Msaidizi wa uagizaji · Kiswahili na Kiingereza",ph:"Uliza kuhusu gharama, vibali, wasambazaji…",send:"Uliza",stop:"Simamisha",nw:"Mazungumzo mapya",x:"Funga",
      disc:"Majibu ya AI yanaweza kukosea. Namba zinatoka kwenye zana za Ramani. Ufadhili unategemea tathmini.",cb:"Mwombe BDM anipigie",
      hi:"Habari! Mimi ni Uliza Ramani. Niulize mzigo utagharimu kiasi gani, vibali unavyohitaji, jinsi ya kumlipa msambazaji au maana ya neno. Nitakuelekeza kwenye zana sahihi ya bure.",
      chips:["Vigae vya USD 15,000 kutoka China hadi Mwanza vitanigharimu kiasi gani?","Nahitaji vibali gani kuagiza vipodozi?","Nimlipeje msambazaji wa China kwa usalama?","Demurrage ni nini?"],
      more:["Napata siku ngapi za bure bandari ya Dar?","Nahitaji nyaraka gani kuagiza mzigo?","Nimlipeje msambazaji wa China kwa usalama?","Demurrage ni nini?","Nakokotoaje gharama ya mzigo hadi dukani?"],
      permQ:function(g){ return "Nahitaji vibali gani kwa "+g+"?"; },costQ:function(g){ return g.charAt(0).toUpperCase()+g.slice(1)+" za USD 10,000 kutoka China zitanigharimu kiasi gani?"; },regQ:function(r){ return "Je, ikienda "+r+" badala yake?"; },payQ:"Nimlipeje msambazaji kwa usalama?",
      offline:"Hili ni jibu la haraka kutoka kwenye zana za Ramani:",err:"Samahani, sikuweza kujibu sasa hivi. Jaribu tena, au mwombe BDM akupigie.",
      noai:"AI haipatikani hapa, kwa hiyo najibu kutoka kwenye zana za Ramani.",stopped:"Imesimamishwa.",
      cbT:"BDM wa Ramani atakupigia ndani ya siku moja ya kazi.",name:"Jina lako",phone:"Namba ya WhatsApp",
      cbOk:"Ramani inaweza kunipigia au kunitumia ujumbe kuhusu swali langu.",cbGo:"Nipigie",cbDone:"Tayari. BDM wa Ramani atakupigia ndani ya siku moja ya kazi.",
      fErr:"Tafadhali weka jina, namba ya Tanzania na uweke tiki.",
      lead:{plan:{t:"Pata makadirio haya WhatsApp",p:"Tutakutumia makadirio yako na vidokezo vichache vya kuagiza mizigo. Jibu STOP wakati wowote.",ok:"Ramani inaweza kunitumia ujumbe WhatsApp kuhusu mzigo wangu. Naweza kujibu STOP wakati wowote.",go:"Nitumie",done:"Imetumwa. Angalia WhatsApp yako hivi karibuni, na endelea kuuliza hapa wakati wowote."},
        finance:{t:"Ongea na BDM wa Ramani kuhusu kumlipa msambazaji",p:"BDM atawasiliana nawe ndani ya siku moja ya kazi. Ufadhili unategemea tathmini.",ok:"Ramani inaweza kunipigia au kunitumia ujumbe kuhusu ufadhili wa mzigo wangu.",go:"Niwasiliane",done:"Asante. BDM wa Ramani atawasiliana nawe ndani ya siku moja ya kazi."},
        tips:{t:"Pata vidokezo vya uagizaji kila wiki WhatsApp",p:"Viwango vya fedha, vidokezo vya forodha na zana za bure, mara moja kwa wiki. Jibu STOP wakati wowote.",ok:"Ramani inaweza kunitumia vidokezo WhatsApp. Naweza kujibu STOP wakati wowote.",go:"Jiunge",done:"Umejiunga. Vidokezo vya kwanza vinakuja wiki hii."},
        me:"Tumia taarifa zangu",no:"Sio sasa"}}
  };
  function L(){ return SW()?T.sw:T.en; }
  function labels(){ var l=L(); fab.querySelector("span:last-child").textContent=l.fab; fab.setAttribute("aria-label",l.fab); panel.querySelector(".sub").textContent=l.sub; box.placeholder=l.ph; box.setAttribute("aria-label",l.ph);
    go.textContent=busy?l.stop:l.send; go.classList.toggle("stop",busy); panel.querySelector(".disc").textContent=l.disc; panel.querySelector(".cb").textContent=l.cb;
    var nw=panel.querySelector(".nw"), x=panel.querySelector(".x"); nw.title=l.nw; nw.setAttribute("aria-label",l.nw); x.title=l.x; x.setAttribute("aria-label",l.x); }

  // ---------- session memory (survives moving between pages; cleared when the browser tab closes)
  var KEY="rg_uliza_v2", S={turns:[],log:[],plan:null,leadDone:0,leadSeen:{},answers:0,open:false};
  function load(){ try{ var j=JSON.parse(sessionStorage.getItem(KEY)||"null"); if(j&&Array.isArray(j.turns)) S=Object.assign(S,j); }catch(e){} }
  function save(){ try{ S.log=S.log.slice(-30); S.turns=S.turns.slice(-10); sessionStorage.setItem(KEY,JSON.stringify(S)); }catch(e){} }
  load();

  // ---------- rendering (no HTML from the model ever reaches innerHTML)
  function safeUrl(u){ u=String(u||"").trim(); if(/^[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i.test(u)) return u; if(/^https:\/\/(www\.)?ramani\.io(\/|$)/.test(u)) return u; return null; }
  function prettyLabel(label,url){ if(/\.html\b/i.test(label)||label===url){ var b=String(url).split(/[?#]/)[0], r=(C.search(b.replace(/\.html$/,"").replace(/-/g," "),3)||[]).filter(function(x){ return x.url===b; })[0];
      if(r) return SW()?r.title_sw:r.title; var w=b.replace(/\.html$/i,"").replace(/-/g," "); return w.charAt(0).toUpperCase()+w.slice(1); } return label; }
  function inline(parent,text){
    var re=/\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g, last=0, m;
    while((m=re.exec(text))){ if(m.index>last) parent.appendChild(document.createTextNode(text.slice(last,m.index)));
      if(m[1]){ var u=safeUrl(m[2]); if(u){ var a=document.createElement("a"); a.href=u; a.textContent=prettyLabel(m[1],m[2]); if(/^https:/.test(u)){ a.target="_blank"; a.rel="noopener"; } a.addEventListener("click",function(){ track("uliza_link",{to:this.getAttribute("href")}); }); parent.appendChild(a); } else parent.appendChild(document.createTextNode(m[1])); }
      else { var b=document.createElement("b"); b.textContent=m[3]; parent.appendChild(b); }
      last=re.lastIndex; }
    if(last<text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function render(el,text){
    el.replaceChildren(); var list=null;
    String(text||"").replace(/\r/g,"").replace(/[—–]/g,",").split("\n").forEach(function(line){
      var t=line.trim(); if(!t){ list=null; return; }
      var li=t.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if(li){ if(!list){ list=document.createElement("ul"); el.appendChild(list); } var x=document.createElement("li"); inline(x,li[1]); list.appendChild(x); }
      else { list=null; var p=document.createElement("p"); inline(p,t.replace(/^#+\s*/,"")); el.appendChild(p); }
    });
  }
  function scroll(){ log.scrollTop=log.scrollHeight; }
  function bubble(kind,text,note,keep){ var d=document.createElement("div"); d.className="ul-m "+kind; if(kind==="a"){ render(d,text); if(note){ var n=document.createElement("p"); n.className="note"; n.style.margin="0 0 6px"; n.textContent=note; d.insertBefore(n,d.firstChild); } } else d.textContent=text; log.appendChild(d); scroll();
    if(keep!==false){ S.log.push({k:kind,t:text,n:note||""}); save(); } return d; }
  function typing(){ var d=document.createElement("div"); d.className="ul-m a"; d.setAttribute("aria-label",SW()?"Nafikiri":"Thinking"); d.innerHTML='<span class="ul-typing"><i></i><i></i><i></i></span>'; log.appendChild(d); scroll(); return d; }
  function chips(list){ var old=log.querySelectorAll(".ul-chips"); for(var i=0;i<old.length;i++) old[i].remove();
    if(!list||!list.length) return; var w=document.createElement("div"); w.className="ul-chips";
    list.forEach(function(c){ var b=document.createElement("button"); b.type="button"; b.className="ul-chip"; b.textContent=c; b.addEventListener("click",function(){ w.remove(); track("uliza_chip",{page:page}); ask(c); }); w.appendChild(b); });
    log.appendChild(w); scroll(); }
  function track(ev,p){ try{ if(window.rtrack) rtrack(ev,p||{}); }catch(e){} }

  // ---------- what to suggest next, and when to offer WhatsApp (from Ramani's own tools, no AI needed)
  var FIN=/financ|fund|loan|credit|capital|mkopo|ufadhili|mtaji|pay (?:the |my )?supplier|supplier payment|kulipa msambazaji|lipa msambazaji|kumlipa msambazaji/i;
  var PERM=/permit|kibali|vibali|tbs|tmda|tcra|standard|certificate|cheti/i;
  function planFor(q){ var p=null; try{ p=C.parsePlan(q); }catch(e){}
    if(p){ S.plan=p; return p; }
    if(S.plan){ var g=C.goods(q), v=C.money(q), reg=null; Object.keys(REG).forEach(function(k){ if(new RegExp("\\b"+REG[k].split(" ")[0]+"\\b","i").test(q)) reg=k; });
      if(g||v||reg||/cost|gharama|bei|how much|kiasi|instead|badala/i.test(q)){ p={goods:g||S.plan.goods,origin:S.plan.origin,region:reg||S.plan.region,value_usd:v||S.plan.value_usd}; S.plan=p; return p; } }
    return null; }
  function gname(k){ var g=GOODS[k]||GOODS.household; return SW()?g[1]:g[0]; }
  function suggest(q,p){ var l=L(), out=[];
    if(p){ out.push(l.permQ(gname(p.goods))); out.push(l.payQ); var other=p.region==="dar"?"Arusha":"Dar es Salaam"; out.push(l.regQ(other)); }
    else if(PERM.test(q)){ var g=C.goods(q)||(S.plan&&S.plan.goods); if(g) out.push(l.costQ(gname(g))); }
    var asked=S.turns.filter(function(t){ return t.role==="user"; }).map(function(t){ return t.content; });
    l.more.forEach(function(m){ if(out.length<3&&asked.indexOf(m)<0&&out.indexOf(m)<0) out.push(m); });
    return out.slice(0,3); }
  function intent(q,p){ if(S.leadDone) return null;
    if(FIN.test(q)&&!S.leadSeen.finance) return "finance";
    if(p&&!S.leadSeen.plan) return "plan";
    if(S.answers>=3&&!S.leadSeen.tips&&!S.leadSeen.plan) return "tips";
    return null; }

  // ---------- lead card: only with a clear yes from the trader
  function leadCard(kind,q,p){
    var l=L(), c=l.lead[kind], me=R.people&&R.people.me&&R.people.me();
    S.leadSeen[kind]=1; save(); track("uliza_lead_shown",{kind:kind,page:page});
    var f=document.createElement("form"); f.className="ul-card"; f.noValidate=true;
    f.innerHTML='<b></b><p class="d"></p><input class="n" autocomplete="name"><input class="ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="+255 7xx xxx xxx"><label><input type="checkbox" class="ok"><span></span></label><span class="e"></span><div class="row"><button type="submit" class="go"></button><button type="button" class="no"></button></div>';
    f.querySelector("b").textContent=c.t; f.querySelector(".d").textContent=c.p; f.querySelector("label span").textContent=c.ok; f.querySelector(".go").textContent=c.go; f.querySelector(".no").textContent=l.lead.no;
    var n=f.querySelector(".n"), ph=f.querySelector(".ph"); n.placeholder=l.name; n.setAttribute("aria-label",l.name); ph.setAttribute("aria-label",l.phone);
    if(me){ if(me.name) n.value=me.name; if(me.phone) ph.value=me.phone; }
    f.querySelector(".no").addEventListener("click",function(){ f.remove(); track("uliza_lead_dismissed",{kind:kind}); });
    f.addEventListener("submit",function(e){ e.preventDefault(); var name=n.value.trim(), tel=ph.value.replace(/[\s()-]/g,"");
      if(!name||!/^(\+?255|0)[67]\d{8}$/.test(tel)||!f.querySelector(".ok").checked){ f.querySelector(".e").textContent=l.fErr; return; }
      var base={name:name,phone:tel,whatsapp:tel,channel:"whatsapp",question:String(q||"").slice(0,300),source:"uliza_ramani",marketing_consent:true,consent_text:c.ok,language:lang()};
      var type=kind==="plan"?"import_plan":kind==="finance"?"finance_interest":"newsletter";
      if(p) Object.assign(base,{goods:p.goods,origin:p.origin,region:p.region,value_usd:p.value_usd});
      if(R.send) try{ R.send(type,base); }catch(err){}
      S.leadDone=1; save(); f.remove(); bubble("a",c.done); track("uliza_lead_sent",{kind:kind,page:page}); });
    log.appendChild(f); scroll(); }

  // ---------- tools Claude can call in the artifact viewer (they run here in the page)
  function lang(){ return SW()?"sw":"en"; }
  var TOOLS=[
    {name:"plan_import",description:"Works out an import with Ramani's own calculator: shipping option, landed cost in TZS, duty band, VAT, deposit, days to the shop, permits, and a link to the full plan. Use it for ANY question about what an import will cost. Returns JSON.",
      inputSchema:{type:"object",properties:{goods:{type:"string",description:"One of household, elec, build, textile, food, cosm, med, agri, mach, parts, furn"},origin:{type:"string",description:"cn, in, ae, tr or eu"},value_usd:{type:"number",description:"Value of the goods in USD"},region:{type:"string",description:"dar, aru, mwz, mby, dod or oth"}},required:["goods","value_usd"]},
      execute:function(i){ return C.plan(i); }},
    {name:"search_resources",description:"Finds Ramani tools, templates, guides and courses for a need. Returns up to 5 with title and url. Use it to give links.",
      inputSchema:{type:"object",properties:{query:{type:"string"}},required:["query"]},
      execute:function(i){ return C.search(String(i.query||""),5).map(function(r){ return {title:SW()?r.title_sw:r.title,url:r.url,about:SW()?r.about_sw:r.about}; }); }},
    {name:"permits_for",description:"Lists the Tanzanian permits and standards Ramani's permit finder shows for a kind of goods. Returns JSON.",
      inputSchema:{type:"object",properties:{goods:{type:"string"}},required:["goods"]},
      execute:function(i){ return {permits:C.permits(String(i.goods||"")).map(function(p){ return {agency:p.agency,rule:SW()?p.sw:p.en}; }),url:"import-permit-finder.html",note:"Confirm with a licensed clearing agent before the goods ship."}; }},
    {name:"define_word",description:"Looks up an import word in the Ramani glossary (English and Kiswahili meanings).",
      inputSchema:{type:"object",properties:{word:{type:"string"}},required:["word"]},
      execute:function(i){ var d=C.define(String(i.word||"")); if(!d.length) throw new Error("Not in the glossary"); return d; }}
  ];
  var RULES=function(){ return [
    "You are Uliza Ramani, the assistant on Ramani's free resource site for Tanzanian importers. Ramani is a trade finance company in Dar es Salaam.",
    "Rules:",
    "1. Reply in the language of the user's last message (Kiswahili or English). Keep it short: under 100 words, simple words, short lines. Start with the answer; do not repeat the question.",
    "2. Every number (costs, duty, VAT, days) must come from the plan_import tool. Never invent duty rates, prices, permits, laws or bank fees. If the tools do not cover it, say you are not sure and suggest a licensed clearing agent or a Ramani BDM.",
    "3. Finance: Ramani pays the supplier and the importer repays as they sell, subject to assessment. Never say someone qualifies, will be approved or what rate they will pay. Suggest the readiness score (import-finance-readiness-score.html) or a call with a Ramani BDM.",
    "4. End with one or two links to Ramani pages as markdown links, using urls exactly as the tools return them. The link text is the page title, never a file name.",
    "5. Never ask for phone numbers, ID numbers or bank details.",
    "6. Only help with importing, trade, Ramani's tools and running an import business. Politely decline anything else.",
    "7. Do not use dashes. Use plain sentences or short bullet lists. Put each number on its own bullet.",
    "8. Kiswahili: write simple, everyday Tanzanian Kiswahili as traders in Kariakoo speak it. Use common trade words (mzigo, kontena, ushuru, msambazaji, wakala wa forodha, bandari).",
    "9. If the user is following up on an earlier answer, use the earlier details (goods, amount, origin, region) unless they change them.",
    "The user is on the page: "+document.title+". Site language now: "+(SW()?"Kiswahili":"English")+"."
  ].join("\n"); };

  // ---------- quick answers without AI (also used when the AI is off)
  function money(n){ return "TZS "+Math.round(n).toLocaleString("en-US"); }
  function quick(q,pp){
    var sw=SW()||/\b(nini|gani|vipi|nataka|kutoka|kiasi|bei|mzigo|ushuru|vibali|nahitaji)\b/i.test(q), p=pp||null, out=[];
    if(p){ var r=C.plan(p);
      out.push(sw?("Makadirio: **"+money(r.landed_cost_tzs_excluding_vat_claimed_back)+"** kwa mzigo kufika ("+r.landed_cost_multiple_of_goods+" × thamani ya bidhaa), ukidai VAT ya uagizaji."):("Estimate: **"+money(r.landed_cost_tzs_excluding_vat_claimed_back)+"** landed ("+r.landed_cost_multiple_of_goods+" × the goods value), if you claim back import VAT."));
      out.push(sw?("- Usafirishaji: "+r.shipping+", takriban m³ "+r.cubic_metres):("- Shipping: "+r.shipping+", about "+r.cubic_metres+" m³"));
      out.push(sw?("- Ushuru kiwango "+r.duty_band_percent+"%: "+money(r.duty_tzs)):("- Duty band "+r.duty_band_percent+"%: "+money(r.duty_tzs)));
      out.push(sw?("- VAT 18%: "+money(r.import_vat_tzs)):("- VAT 18%: "+money(r.import_vat_tzs)));
      out.push(sw?("- Malipo ya awali 30%: "+money(r.deposit_30_percent_tzs)):("- 30% deposit: "+money(r.deposit_30_percent_tzs)));
      out.push(sw?("- Takriban siku "+r.days_from_order_to_shop+" hadi dukani"):("- About "+r.days_from_order_to_shop+" days to your shop"));
      out.push(sw?("- Vibali vya kuangalia: "+r.permits.join(", ")):("- Permits to check: "+r.permits.join(", ")));
      out.push(sw?("Kiwango cha leo: 1 USD = "+r.usd_tzs_rate+" TZS. Benki, maduka ya fedha na TRA vinaweza kutofautiana."):("Today's rate: 1 USD = "+r.usd_tzs_rate+" TZS. Bank, bureau and TRA rates may differ."));
      out.push(""); out.push(sw?("[Fungua mpango kamili]("+r.url+") · [Kipimo cha utayari wa ufadhili](import-finance-readiness-score.html)"):("[Open the full plan]("+r.url+") · [Finance readiness score](import-finance-readiness-score.html)"));
      return out.join("\n"); }
    var g=C.goods(q)||(PERM.test(q)&&S.plan&&S.plan.goods);
    if(g&&PERM.test(q)){ C.permits(g).forEach(function(x){ out.push("- **"+x.agency+"**: "+(sw?x.sw:x.en)); }); out.push(""); out.push(sw?"[Kitafuta vibali](import-permit-finder.html)":"[Permit finder](import-permit-finder.html)"); return out.join("\n"); }
    var m=q.match(/(?:what is|what's|nini maana ya|maana ya|ni nini)\s+([a-z0-9 ]+?)\??$/i)||q.match(/^([a-z0-9 ]+?)\s+(?:ni nini|maana yake)\??$/i), d=C.define(m?m[1]:q);
    if(d.length&&(m||q.split(/\s+/).length<=3)){ var w=d[0]; return "**"+w.word+"**"+(w.also?" ("+w.also+")":"")+": "+(sw?w.maana_sw:w.meaning_en)+"\n\n["+(sw?"Kamusi ya mwagizaji":"Importer glossary")+"](glossary.html)"; }
    var s=C.search(q,3);
    if(s.length){ out.push(sw?"Zana hizi za bure zitakusaidia:":"These free resources will help:"); s.forEach(function(r){ out.push("- ["+(sw?r.title_sw:r.title)+"]("+r.url+"): "+(sw?r.about_sw:r.about)); }); return out.join("\n"); }
    return sw?"Sina jibu la uhakika kwa hilo. Angalia [maktaba ya rasilimali](resources.html) au mwombe BDM wa Ramani akupigie.":"I am not sure about that one. Try the [resource library](resources.html) or ask a Ramani BDM to call you.";
  }

  // ---------- the brain
  var busy=false, ctl=null, samplerP=null, mode=null, lastQ="";
  function sampler(){ if(!samplerP) samplerP=(window.claude&&window.claude.use)?window.claude.use("sample").catch(function(){return null;}):Promise.resolve(null); return samplerP; }
  function setBusy(b){ busy=b; labels(); }
  function ask(q){
    q=String(q||"").trim(); if(!q||busy) return; lastQ=q; chips(null); bubble("u",q); box.value=""; size();
    S.turns.push({role:"user",content:q}); if(S.turns.length>10) S.turns=S.turns.slice(-10); while(S.turns.length&&S.turns[0].role!=="user") S.turns.shift(); save();
    track("uliza_asked",{page:page});
    var p=planFor(q), out=typing(); setBusy(true); ctl=new AbortController();
    var finish=function(text,note){ out.remove(); var el=bubble("a",text,note); S.turns.push({role:"assistant",content:text}); S.answers++; save(); setBusy(false);
      var k=intent(q,p); if(k) leadCard(k,q,p); chips(suggest(q,p));
      log.scrollTop=Math.max(0,el.offsetTop-log.offsetTop-56); };
    var fallback=function(note){ finish(quick(q,p),note); };
    if(R.brainEndpoint){
      fetch(R.brainEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:S.turns,lang:lang(),page:page}),signal:ctl.signal})
        .then(function(r){ return r.json(); }).then(function(j){ if(j&&j.text) finish(j.text); else fallback(L().offline); },function(e){ if(e&&e.name==="AbortError"){ out.remove(); bubble("a",L().stopped); setBusy(false); } else fallback(L().offline); });
      return;
    }
    sampler().then(function(s){
      if(!s||mode==="off") return fallback(mode==="off"?null:L().noai);
      return s.limits().then(function(lim){
        var live=null, opts={signal:ctl.signal,modelTier:"quick",onText:function(o){ if(o.text){ if(!live){ out.remove(); live=bubble("a","",null,false); } render(live,o.text); scroll(); } }};
        var input=[{role:"user",content:RULES()}].concat(S.turns);
        if(lim&&lim.tools) opts.tools=TOOLS;
        else { var ctx={resources:C.search(q,5),plan:(function(){ try{ return p?C.plan(p):null; }catch(e){ return null; } })(),glossary:C.define(q)}; input[0]={role:"user",content:RULES()+"\n\nRamani data for this question (use only this for numbers and links):\n"+JSON.stringify(ctx)}; opts.cache=false; }
        var done=function(text){ if(live){ live.remove(); out=document.createElement("div"); } finish(text); };
        return s(input,opts).then(function(r){ done(r.text); },function(e){
          if(e&&e.code==="cancelled") return done(e.text||L().stopped);
          if(e&&(e.code==="not_granted"||e.code==="sampling_disabled"||e.code==="capability_disabled"||e.code==="not_declared")){ mode="off"; if(live) live.remove(); return fallback(L().noai); }
          if(e&&e.code==="refused") return done(SW()?"Siwezi kusaidia na hilo. Niulize kuhusu uagizaji na zana za Ramani.":"I cannot help with that. Ask me about importing and Ramani's tools.");
          if(live) live.remove(); fallback(L().offline);
        });
      });
    }).catch(function(){ fallback(L().offline); });
  }

  // ---------- call back (lands in the BDM queue)
  function callback(){
    var me=R.people&&R.people.me&&R.people.me(), l=L();
    var send=function(name,phone){ if(R.send) R.send("callback_request",{name:name,phone:phone,question:lastQ.slice(0,300),page:page,source:"uliza_ramani",marketing_consent:true,language:lang()}); bubble("a",l.cbDone); track("uliza_callback",{page:page}); };
    if(me&&me.phone){ send(me.name||"",me.phone); return; }
    var f=document.createElement("form"); f.className="ul-card"; f.noValidate=true;
    f.innerHTML='<b></b><input class="n" autocomplete="name"><input class="p" type="tel" inputmode="tel" autocomplete="tel" placeholder="+255 7xx xxx xxx"><label><input type="checkbox" class="ok"><span></span></label><span class="e"></span><div class="row"><button type="submit" class="go"></button></div>';
    f.querySelector("b").textContent=l.cbT; f.querySelector(".n").placeholder=l.name; f.querySelector(".n").setAttribute("aria-label",l.name); f.querySelector(".p").setAttribute("aria-label",l.phone); f.querySelector("label span").textContent=l.cbOk; f.querySelector(".go").textContent=l.cbGo;
    if(me&&me.name) f.querySelector(".n").value=me.name;
    f.addEventListener("submit",function(e){ e.preventDefault(); var n=f.querySelector(".n").value.trim(), p=f.querySelector(".p").value.replace(/[\s()-]/g,"");
      if(!n||!/^(\+?255|0)[67]\d{8}$/.test(p)||!f.querySelector(".ok").checked){ f.querySelector(".e").textContent=l.fErr; return; } f.remove(); send(n,p); });
    log.appendChild(f); scroll(); f.querySelector(".n").focus();
  }

  // ---------- open, close, new chat
  var drawn=false;
  function draw(){ log.replaceChildren(); var hi=document.createElement("div"); hi.className="ul-m a"; render(hi,L().hi); log.appendChild(hi);
    S.log.forEach(function(m){ bubble(m.k,m.t,m.n,false); });
    if(!S.log.length) chips(L().chips); else { var lu=S.turns.filter(function(t){ return t.role==="user"; }).pop(); chips(suggest(lu?lu.content:"",S.plan)); }
    drawn=true; }
  function open(){ panel.hidden=false; fab.hidden=true; if(!drawn) draw(); S.open=true; save(); setTimeout(function(){ box.focus(); scroll(); },50); track("uliza_opened",{page:page}); sampler(); }
  function close(){ panel.hidden=true; fab.hidden=false; S.open=false; save(); fab.focus(); }
  function reset(){ if(busy&&ctl) ctl.abort(); S.turns=[]; S.log=[]; S.plan=null; S.answers=0; save(); draw(); box.focus(); track("uliza_new_chat",{page:page}); }
  function size(){ box.style.height="44px"; box.style.height=Math.min(120,box.scrollHeight+2)+"px"; }
  fab.addEventListener("click",open);
  panel.querySelector(".x").addEventListener("click",close);
  panel.querySelector(".nw").addEventListener("click",reset);
  panel.addEventListener("keydown",function(e){ if(e.key==="Escape") close(); });
  panel.querySelector(".cb").addEventListener("click",callback);
  form.addEventListener("submit",function(e){ e.preventDefault(); if(busy){ if(ctl) ctl.abort(); return; } ask(box.value); });
  box.addEventListener("input",size);
  box.addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event("submit",{cancelable:true})); } });
  window.addEventListener("rg-lang",function(){ labels(); if(drawn) draw(); });
  window.UlizaRamani={open:open,ask:function(q){ open(); ask(q); },reset:reset};
  labels();
  try{ if(/[?&]uliza=1/.test(location.search)) open(); }catch(e){}
})();

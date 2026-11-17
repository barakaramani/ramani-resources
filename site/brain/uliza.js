/* Uliza Ramani: the AI assistant on every Ramani resource page.
   Brain order: 1) RAMANI.brainEndpoint on the live site (Cloudflare function calling the Claude API),
   2) Claude through the artifact viewer (demo), 3) quick answers from Ramani's own tools when no AI is available.
   Numbers always come from Ramani's tools (RG_CORE), never from the model. */
(function(){
  if(window.__uliza) return; window.__uliza=1;
  var C=window.RG_CORE, R=window.RAMANI||{};
  if(!C) return;
  var SW=function(){ return document.documentElement.lang==="sw"; };
  var page=(location.pathname.split("/").pop()||"index.html");

  var css=document.createElement("style");
  css.textContent=
  ".ul-fab{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:58;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px 12px 14px;background:var(--brand,#388539);color:var(--brand-ink,#fff);font:700 15px 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.22);cursor:pointer}"+
  ".ul-fab svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}"+
  ".ul-fab:hover{filter:brightness(1.05)}"+
  ".ul-panel{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:59;width:min(400px,calc(100vw - 32px));height:min(620px,calc(100vh - 32px));display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#16211a);border:1px solid var(--line,#e4e1d6);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.28);overflow:hidden;font-family:'Plus Jakarta Sans',system-ui,sans-serif}"+
  ".ul-head{display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--brand,#388539);color:var(--brand-ink,#fff)}"+
  ".ul-head svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}"+
  ".ul-head b{display:block;font-size:16px}.ul-head small{display:block;font-size:12px;opacity:.85}"+
  ".ul-head .x{margin-left:auto;background:rgba(255,255,255,.15);border:0;color:inherit;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer}"+
  ".ul-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#fbfaf6)}"+
  ".ul-m{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14.5px;line-height:1.5;white-space:normal;overflow-wrap:anywhere}"+
  ".ul-m.u{align-self:flex-end;background:var(--brand,#388539);color:var(--brand-ink,#fff);border-bottom-right-radius:4px}"+
  ".ul-m.a{align-self:flex-start;background:var(--surface,#fff);border:1px solid var(--line,#e4e1d6);border-bottom-left-radius:4px}"+
  ".ul-m.a a{color:var(--brand,#388539);font-weight:700}"+
  ".ul-m.a ul{margin:6px 0;padding-left:18px}.ul-m.a p{margin:0 0 6px}.ul-m.a p:last-child{margin:0}"+
  ".ul-m.t{color:var(--muted,#5f6d63);font-style:italic}"+
  ".ul-chips{display:flex;flex-wrap:wrap;gap:6px}"+
  ".ul-chip{font:600 13px 'Plus Jakarta Sans',system-ui,sans-serif;border:1px solid var(--line2,#d4d0c2);background:var(--surface,#fff);color:var(--ink,#16211a);border-radius:999px;padding:7px 11px;cursor:pointer;text-align:left}"+
  ".ul-chip:hover{border-color:var(--brand,#388539)}"+
  ".ul-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line,#e4e1d6);background:var(--surface,#fff)}"+
  ".ul-form textarea{flex:1;resize:none;height:44px;max-height:110px;font:500 15px 'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink,#16211a);background:var(--bg,#fbfaf6);border:1px solid var(--line2,#d4d0c2);border-radius:12px;padding:11px 12px;min-width:0}"+
  ".ul-form button{border:0;border-radius:12px;background:var(--brand,#388539);color:var(--brand-ink,#fff);font:700 14px 'Plus Jakarta Sans',system-ui,sans-serif;padding:0 14px;cursor:pointer}"+
  ".ul-form button.stop{background:var(--warn,#b5432c)}"+
  ".ul-foot{padding:8px 14px 12px;font-size:11.5px;color:var(--muted,#5f6d63);background:var(--surface,#fff);display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}"+
  ".ul-foot button{background:none;border:0;color:var(--brand,#388539);font:700 12.5px 'Plus Jakarta Sans',system-ui,sans-serif;cursor:pointer;padding:0}"+
  ".ul-cb{display:grid;gap:8px;background:var(--brand-soft,#e7f1e3);border-radius:14px;padding:12px;font-size:14px}"+
  ".ul-cb input{font:500 15px 'Plus Jakarta Sans',system-ui,sans-serif;border:1px solid var(--line2,#d4d0c2);border-radius:10px;padding:9px 11px;background:var(--surface,#fff);color:var(--ink,#16211a);min-width:0}"+
  ".ul-cb label{display:flex;gap:8px;align-items:flex-start;font-size:12.5px}.ul-cb button{justify-self:start;border:0;border-radius:10px;background:var(--brand,#388539);color:var(--brand-ink,#fff);font:700 14px 'Plus Jakarta Sans',system-ui,sans-serif;padding:9px 14px;cursor:pointer}"+
  "@media (max-width:520px){.ul-panel{right:0;left:0;bottom:0;width:100%;height:min(88vh,640px);border-radius:20px 20px 0 0}.ul-fab span{display:none}.ul-fab{padding:14px}}"+
  "@media print{.ul-fab,.ul-panel{display:none!important}}";
  document.head.appendChild(css);

  var ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>';
  var fab=document.createElement("button"); fab.type="button"; fab.className="ul-fab"; fab.setAttribute("data-noi18n","");
  fab.innerHTML=ICON+"<span></span>"; document.body.appendChild(fab);
  var panel=document.createElement("section"); panel.className="ul-panel"; panel.hidden=true; panel.setAttribute("role","dialog"); panel.setAttribute("aria-label","Uliza Ramani"); panel.setAttribute("data-noi18n","");
  panel.innerHTML='<div class="ul-head">'+ICON+'<div><b>Uliza Ramani</b><small class="sub"></small></div><button type="button" class="x" aria-label="Close">×</button></div>'+
    '<div class="ul-log" aria-live="polite"></div><form class="ul-form"><textarea rows="1"></textarea><button type="submit" class="go"></button></form>'+
    '<div class="ul-foot"><span class="disc"></span><button type="button" class="cb"></button></div>';
  document.body.appendChild(panel);
  var log=panel.querySelector(".ul-log"), form=panel.querySelector(".ul-form"), box=form.querySelector("textarea"), go=form.querySelector(".go");

  var T={
    en:{fab:"Uliza Ramani",sub:"AI assistant · Kiswahili and English",ph:"Ask about importing, costs, permits…",send:"Ask",stop:"Stop",
      disc:"AI answers can be wrong. Numbers come from Ramani's tools. Finance is subject to assessment.",cb:"Ask a BDM to call me",
      hi:"Habari! I am Uliza Ramani. Ask me what an import will cost, which permits you need, how to pay a supplier or what a word means. I will point you to the right free tool.",
      chips:["What will USD 15,000 of tiles from China cost me in Mwanza?","Which permits do I need to import cosmetics?","What is demurrage?","How do I pay a supplier in China safely?"],
      thinking:"Thinking…",offline:"Here is a quick answer from Ramani's tools:",err:"Sorry, I could not answer that just now. Try again, or ask a BDM to call you.",
      noai:"Claude is not available in this view, so I am answering from Ramani's tools.",cbT:"A Ramani BDM will call you within one working day.",
      cbName:"Your name",cbPhone:"Phone number",cbOk:"Ramani may call or message me about my question.",cbGo:"Call me",cbDone:"Done. A Ramani BDM will call you within one working day.",
      cbErr:"Please add your name, a Tanzanian phone number and tick the box."},
    sw:{fab:"Uliza Ramani",sub:"Msaidizi wa AI · Kiswahili na Kiingereza",ph:"Uliza kuhusu uagizaji, gharama, vibali…",send:"Uliza",stop:"Simamisha",
      disc:"Majibu ya AI yanaweza kukosea. Namba zinatoka kwenye zana za Ramani. Ufadhili unategemea tathmini.",cb:"Mwombe BDM anipigie",
      hi:"Habari! Mimi ni Uliza Ramani. Niulize mzigo utagharimu kiasi gani, vibali unavyohitaji, jinsi ya kumlipa msambazaji au maana ya neno. Nitakuelekeza kwenye zana sahihi ya bure.",
      chips:["Vigae vya USD 15,000 kutoka China hadi Mwanza vitanigharimu kiasi gani?","Nahitaji vibali gani kuagiza vipodozi?","Demurrage ni nini?","Nimlipeje msambazaji wa China kwa usalama?"],
      thinking:"Nafikiri…",offline:"Hili ni jibu la haraka kutoka kwenye zana za Ramani:",err:"Samahani, sikuweza kujibu sasa hivi. Jaribu tena, au mwombe BDM akupigie.",
      noai:"Claude haipatikani hapa, kwa hiyo najibu kutoka kwenye zana za Ramani.",cbT:"BDM wa Ramani atakupigia ndani ya siku moja ya kazi.",
      cbName:"Jina lako",cbPhone:"Namba ya simu",cbOk:"Ramani inaweza kunipigia au kunitumia ujumbe kuhusu swali langu.",cbGo:"Nipigie",cbDone:"Tayari. BDM wa Ramani atakupigia ndani ya siku moja ya kazi.",
      cbErr:"Tafadhali weka jina, namba ya simu ya Tanzania na uweke tiki."}
  };
  function L(){ return SW()?T.sw:T.en; }
  function labels(){ var l=L(); fab.querySelector("span").textContent=l.fab; fab.setAttribute("aria-label",l.fab); panel.querySelector(".sub").textContent=l.sub; box.placeholder=l.ph; box.setAttribute("aria-label",l.ph);
    go.textContent=busy?l.stop:l.send; go.classList.toggle("stop",busy); panel.querySelector(".disc").textContent=l.disc; panel.querySelector(".cb").textContent=l.cb; }

  // ---------- rendering (no HTML from the model ever reaches innerHTML)
  function safeUrl(u){ u=String(u||"").trim(); if(/^[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i.test(u)) return u; if(/^https:\/\/(www\.)?ramani\.io(\/|$)/.test(u)) return u; return null; }
  function inline(parent,text){
    var re=/\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g, last=0, m;
    while((m=re.exec(text))){ if(m.index>last) parent.appendChild(document.createTextNode(text.slice(last,m.index)));
      if(m[1]){ var u=safeUrl(m[2]); if(u){ var a=document.createElement("a"); a.href=u; a.textContent=m[1]; if(/^https:/.test(u)){ a.target="_blank"; a.rel="noopener"; } a.addEventListener("click",function(){ track("uliza_link",{to:this.getAttribute("href")}); }); parent.appendChild(a); } else parent.appendChild(document.createTextNode(m[1])); }
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
  function bubble(kind,text){ var d=document.createElement("div"); d.className="ul-m "+kind; if(kind==="a") render(d,text); else d.textContent=text; log.appendChild(d); log.scrollTop=log.scrollHeight; return d; }
  function chips(){ var w=document.createElement("div"); w.className="ul-chips"; L().chips.forEach(function(c){ var b=document.createElement("button"); b.type="button"; b.className="ul-chip"; b.textContent=c; b.addEventListener("click",function(){ w.remove(); ask(c); }); w.appendChild(b); }); log.appendChild(w); }
  function track(ev,p){ try{ if(window.rtrack) rtrack(ev,p||{}); }catch(e){} }

  // ---------- tools Claude can call (they run here in the page)
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
    "1. Reply in the language of the user's last message (Kiswahili or English). Keep it short: under 120 words, simple words, short lines.",
    "2. Every number (costs, duty, VAT, days) must come from the plan_import tool. Never invent duty rates, prices, permits, laws or bank fees. If the tools do not cover it, say you are not sure and suggest a licensed clearing agent or a Ramani BDM.",
    "3. Finance: Ramani pays the supplier and the importer repays as they sell, subject to assessment. Never say someone qualifies, will be approved or what rate they will pay. Suggest the readiness score (import-finance-readiness-score.html) or a call with a Ramani BDM.",
    "4. End with one or two links to Ramani pages as markdown links, using urls exactly as the tools return them.",
    "5. Never ask for phone numbers, ID numbers or bank details.",
    "6. Only help with importing, trade, Ramani's tools and running an import business. Politely decline anything else.",
    "7. Do not use dashes. Use plain sentences or short bullet lists.",
    "The user is on the page: "+document.title+". Site language now: "+(SW()?"Kiswahili":"English")+"."
  ].join("\n"); };

  // ---------- quick answers without AI (also used when Claude is off)
  function money(n){ return "TZS "+Math.round(n).toLocaleString("en-US"); }
  function quick(q){
    var sw=SW()||/\b(nini|gani|vipi|nataka|kutoka|kiasi|bei|mzigo|ushuru|vibali|nahitaji)\b/i.test(q), p=C.parsePlan(q), out=[];
    if(p){ var r=C.plan(p);
      out.push(sw?("Makadirio: **"+money(r.landed_cost_tzs_excluding_vat_claimed_back)+"** kwa mzigo kufika ("+r.landed_cost_multiple_of_goods+" × thamani ya bidhaa), ukidai VAT ya uagizaji."):("Estimate: **"+money(r.landed_cost_tzs_excluding_vat_claimed_back)+"** landed ("+r.landed_cost_multiple_of_goods+" × the goods value), if you claim back import VAT."));
      out.push(sw?("- Usafirishaji: "+r.shipping+", takriban m³ "+r.cubic_metres):("- Shipping: "+r.shipping+", about "+r.cubic_metres+" m³"));
      out.push(sw?("- Ushuru kiwango "+r.duty_band_percent+"%: "+money(r.duty_tzs)+"; VAT 18%: "+money(r.import_vat_tzs)):("- Duty band "+r.duty_band_percent+"%: "+money(r.duty_tzs)+"; VAT 18%: "+money(r.import_vat_tzs)));
      out.push(sw?("- Malipo ya awali 30%: "+money(r.deposit_30_percent_tzs)+"; takriban siku "+r.days_from_order_to_shop+" hadi dukani"):("- 30% deposit: "+money(r.deposit_30_percent_tzs)+"; about "+r.days_from_order_to_shop+" days to your shop"));
      out.push(sw?("- Vibali vya kuangalia: "+r.permits.join(", ")):("- Permits to check: "+r.permits.join(", ")));
      out.push(""); out.push(sw?("[Fungua mpango kamili]("+r.url+") · [Kipimo cha utayari wa ufadhili](import-finance-readiness-score.html)"):("[Open the full plan]("+r.url+") · [Finance readiness score](import-finance-readiness-score.html)"));
      return out.join("\n"); }
    var g=C.goods(q);
    if(g&&/permit|kibali|vibali|tbs|tmda|standard/i.test(q)){ C.permits(g).forEach(function(x){ out.push("- **"+x.agency+"**: "+(sw?x.sw:x.en)); }); out.push(""); out.push(sw?"[Kitafuta vibali](import-permit-finder.html)":"[Permit finder](import-permit-finder.html)"); return out.join("\n"); }
    var m=q.match(/(?:what is|what's|nini maana ya|maana ya|ni nini)\s+([a-z0-9 ]+?)\??$/i)||q.match(/^([a-z0-9 ]+?)\s+(?:ni nini|maana yake)\??$/i), d=C.define(m?m[1]:q);
    if(d.length&&(m||q.split(/\s+/).length<=3)){ var w=d[0]; return "**"+w.word+"**"+(w.also?" ("+w.also+")":"")+": "+(sw?w.maana_sw:w.meaning_en)+"\n\n["+(sw?"Kamusi ya mwagizaji":"Importer glossary")+"](glossary.html)"; }
    var s=C.search(q,3);
    if(s.length){ out.push(sw?"Zana hizi za bure zitakusaidia:":"These free resources will help:"); s.forEach(function(r){ out.push("- ["+(sw?r.title_sw:r.title)+"]("+r.url+"): "+(sw?r.about_sw:r.about)); }); return out.join("\n"); }
    return sw?"Sina jibu la uhakika kwa hilo. Angalia [maktaba ya rasilimali](resources.html) au mwombe BDM wa Ramani akupigie.":"I am not sure about that one. Try the [resource library](resources.html) or ask a Ramani BDM to call you.";
  }

  // ---------- the brain
  var turns=[], busy=false, ctl=null, samplerP=null, mode=null, lastQ="";
  function sampler(){ if(!samplerP) samplerP=(window.claude&&window.claude.use)?window.claude.use("sample").catch(function(){return null;}):Promise.resolve(null); return samplerP; }
  function setBusy(b){ busy=b; labels(); box.disabled=false; }
  function ask(q){
    q=String(q||"").trim(); if(!q||busy) return; lastQ=q; bubble("u",q); box.value="";
    turns.push({role:"user",content:q}); if(turns.length>10) turns=turns.slice(-10); while(turns.length&&turns[0].role!=="user") turns.shift();
    if(R.send) try{ R.send("uliza_question",{question:q.slice(0,300),page:page,language:lang()},{quiet:true}); }catch(e){}
    track("uliza_asked",{page:page});
    var out=bubble("a t",L().thinking); setBusy(true); ctl=new AbortController();
    var finish=function(text,note){ out.className="ul-m a"; render(out,text); if(note){ var n=document.createElement("p"); n.style.cssText="font-size:12px;color:var(--muted,#5f6d63);margin-top:6px"; n.textContent=note; out.appendChild(n); }
      turns.push({role:"assistant",content:text}); setBusy(false); log.scrollTop=log.scrollHeight; };
    var fallback=function(note){ finish(quick(q),note); };
    if(R.brainEndpoint){
      fetch(R.brainEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:turns,lang:lang(),page:page}),signal:ctl.signal})
        .then(function(r){ return r.json(); }).then(function(j){ if(j&&j.text) finish(j.text); else fallback(L().offline); },function(e){ if(e&&e.name==="AbortError"){ finish(SW()?"Imesimamishwa.":"Stopped."); } else fallback(L().offline); });
      return;
    }
    sampler().then(function(s){
      if(!s||mode==="off") return fallback(mode==="off"?null:L().noai);
      return s.limits().then(function(lim){
        var opts={signal:ctl.signal,modelTier:"quick",onText:function(o){ if(o.text){ out.className="ul-m a"; render(out,o.text); log.scrollTop=log.scrollHeight; } }};
        var input=[{role:"user",content:RULES()}].concat(turns);
        if(lim&&lim.tools) opts.tools=TOOLS;
        else { var ctx={resources:C.search(q,5),plan:(function(){ try{ var p=C.parsePlan(q); return p?C.plan(p):null; }catch(e){ return null; } })(),glossary:C.define(q)}; input[0]={role:"user",content:RULES()+"\n\nRamani data for this question (use only this for numbers and links):\n"+JSON.stringify(ctx)}; opts.cache=false; }
        return s(input,opts).then(function(r){ finish(r.text); },function(e){
          if(e&&e.code==="cancelled") return finish(e.text||(SW()?"Imesimamishwa.":"Stopped."));
          if(e&&(e.code==="not_granted"||e.code==="sampling_disabled"||e.code==="capability_disabled"||e.code==="not_declared")){ mode="off"; return fallback(L().noai); }
          if(e&&e.code==="refused") return finish(SW()?"Siwezi kusaidia na hilo. Niulize kuhusu uagizaji na zana za Ramani.":"I cannot help with that. Ask me about importing and Ramani's tools.");
          fallback(L().offline);
        });
      });
    }).catch(function(){ fallback(L().offline); });
  }

  // ---------- call back (lands in the BDM queue, then SemaCall)
  function callback(){
    var me=R.people&&R.people.me&&R.people.me(), l=L();
    var send=function(name,phone){ if(R.send) R.send("callback_request",{name:name,phone:phone,question:lastQ.slice(0,300),page:page,source:"uliza_ramani",marketing_consent:true,language:lang()}); bubble("a",l.cbDone); track("uliza_callback",{page:page}); };
    if(me&&me.phone){ send(me.name||"",me.phone); return; }
    var f=document.createElement("form"); f.className="ul-cb"; f.noValidate=true;
    f.innerHTML='<b></b><input class="n" autocomplete="name"><input class="p" type="tel" inputmode="tel" placeholder="+255 7xx xxx xxx"><label><input type="checkbox" class="ok"><span></span></label><span class="e" style="color:var(--warn,#b5432c);font-size:12.5px"></span><button type="submit"></button>';
    f.querySelector("b").textContent=l.cbT; f.querySelector(".n").placeholder=l.cbName; f.querySelector(".n").setAttribute("aria-label",l.cbName); f.querySelector(".p").setAttribute("aria-label",l.cbPhone); f.querySelector("label span").textContent=l.cbOk; f.querySelector("button").textContent=l.cbGo;
    if(me&&me.name) f.querySelector(".n").value=me.name;
    f.addEventListener("submit",function(e){ e.preventDefault(); var n=f.querySelector(".n").value.trim(), p=f.querySelector(".p").value.replace(/[\s()-]/g,"");
      if(!n||!/^(\+?255|0)[67]\d{8}$/.test(p)||!f.querySelector(".ok").checked){ f.querySelector(".e").textContent=l.cbErr; return; } f.remove(); send(n,p); });
    log.appendChild(f); log.scrollTop=log.scrollHeight; f.querySelector(".n").focus();
  }

  var opened=false;
  function open(){ panel.hidden=false; fab.hidden=true; if(!opened){ opened=true; bubble("a",L().hi); chips(); } setTimeout(function(){ box.focus(); },50); track("uliza_opened",{page:page}); sampler(); }
  function close(){ panel.hidden=true; fab.hidden=false; fab.focus(); }
  fab.addEventListener("click",open);
  panel.querySelector(".x").addEventListener("click",close);
  panel.addEventListener("keydown",function(e){ if(e.key==="Escape") close(); });
  panel.querySelector(".cb").addEventListener("click",callback);
  form.addEventListener("submit",function(e){ e.preventDefault(); if(busy){ if(ctl) ctl.abort(); return; } ask(box.value); });
  box.addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event("submit",{cancelable:true})); } });
  window.addEventListener("rg-lang",labels);
  window.UlizaRamani={open:open,ask:function(q){ open(); ask(q); }};
  labels();
  try{ if(/[?&]uliza=1/.test(location.search)) open(); }catch(e){}
})();

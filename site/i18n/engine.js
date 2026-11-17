(function(){
  if(window.RG_I18N) return;
  var KEY="rg_lang", lang=null;
  try{ lang=localStorage.getItem(KEY); }catch(e){}
  if(lang!=="sw"&&lang!=="en") lang=((navigator.language||"").toLowerCase().indexOf("sw")===0)?"sw":"en";
  var D=window.RG_SW||{}, RX=(window.RG_SW_RX||[]).map(function(p){ return [new RegExp("^"+p[0]+"$"),p[1]]; });
  var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEXTAREA:1,CODE:1,PRE:1};
  var nodes=new Set(), meta=new WeakMap(), ATTR=["placeholder","aria-label","title"];
  function tr(s){
    var k=s.replace(/\s+/g," ").trim(); if(!k||!/[A-Za-z]/.test(k)) return null;
    if(Object.prototype.hasOwnProperty.call(D,k)) return D[k];
    for(var i=0;i<RX.length;i++){ if(RX[i][0].test(k)) return k.replace(RX[i][0],RX[i][1]); }
    return null;
  }
  function blocked(el){ for(var p=el;p&&p.nodeType===1;p=p.parentNode){ if(SKIP[p.tagName]||p.hasAttribute("data-noi18n")||p.isContentEditable) return true; } return false; }
  function doText(n){
    var m=meta.get(n), cur=n.nodeValue;
    if(lang==="sw"){
      if(m&&cur===m.sw) return;
      if(!n.parentNode||blocked(n.parentNode)) return;
      var t=tr(cur); if(t==null){ if(m) meta.delete(n); return; }
      var v=cur.match(/^\s*/)[0]+t+cur.match(/\s*$/)[0];
      var p=n.parentNode; if(p.tagName==="OPTION"&&!p.hasAttribute("value")) p.setAttribute("value",p.textContent);
      meta.set(n,{en:cur,sw:v}); nodes.add(n); n.nodeValue=v;
    } else if(m&&cur===m.sw){ n.nodeValue=m.en; }
  }
  function doAttrs(el){
    if(blocked(el)) return;
    var m=meta.get(el)||{};
    ATTR.concat(el.tagName==="INPUT"&&/^(button|submit)$/i.test(el.type)?["value"]:[]).forEach(function(a){
      if(!el.hasAttribute(a)) return; var cur=el.getAttribute(a), r=m[a];
      if(lang==="sw"){ if(r&&cur===r.sw) return; var t=tr(cur); if(t==null) return; m[a]={en:cur,sw:t}; el.setAttribute(a,t); nodes.add(el); }
      else if(r&&cur===r.sw){ el.setAttribute(a,r.en); }
    });
    meta.set(el,m);
  }
  function walk(root){
    if(!root) return;
    if(root.nodeType===3){ doText(root); return; }
    if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11) return;
    if(root.nodeType===1){ if(SKIP[root.tagName]) return; doAttrs(root); }
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), n; while((n=w.nextNode())) doText(n);
    if(root.querySelectorAll) root.querySelectorAll("[placeholder],[aria-label],[title],input[type=button],input[type=submit]").forEach(doAttrs);
  }
  function restore(){ nodes.forEach(function(n){ var m=meta.get(n); if(!m) return; if(n.nodeType===3){ if(n.nodeValue===m.sw) n.nodeValue=m.en; } else { ATTR.concat(["value"]).forEach(function(a){ var r=m[a]; if(r&&n.getAttribute(a)===r.sw) n.setAttribute(a,r.en); }); } }); }
  var obs=new MutationObserver(function(list){
    if(lang!=="sw") return;
    list.forEach(function(r){
      if(r.type==="characterData") doText(r.target);
      else if(r.type==="attributes") doAttrs(r.target);
      else r.addedNodes.forEach(walk);
    });
  });
  function label(){ document.querySelectorAll(".rg-lang").forEach(function(b){ b.textContent=lang==="sw"?"EN":"SW"; b.setAttribute("aria-label",lang==="sw"?"Switch to English":"Badilisha kwenda Kiswahili"); b.setAttribute("data-noi18n",""); }); }
  function apply(){ document.documentElement.lang=lang; if(lang==="sw") walk(document.body); else restore(); label(); try{ window.dispatchEvent(new CustomEvent("rg-lang",{detail:lang})); }catch(e){} }
  window.RG_I18N={get lang(){return lang;}, set:function(l){ lang=l==="sw"?"sw":"en"; try{ localStorage.setItem(KEY,lang); }catch(e){} apply(); }, t:tr};
  document.documentElement.lang=lang;
  function start(){
    document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest(".rg-lang"); if(b){ e.preventDefault(); window.RG_I18N.set(lang==="sw"?"en":"sw"); } });
    apply();
    obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTR});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();
})();

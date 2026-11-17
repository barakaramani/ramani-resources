window.RG_CORE=(function(KB){
  function rate(){ try{ var L=(typeof window!=="undefined")&&window.RAMANI_LIVE; if(L&&L.usd&&L.usd.TZS) return L.usd.TZS; }catch(e){} return KB.rate; }
  function norm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
  function words(s){ return norm(s).split(/[^a-z0-9]+/).filter(Boolean); }
  function toks(s){ return words(s).filter(function(t){ return t.length>2&&KB.stop.indexOf(t)<0; }); }
  function expand(q){ return words(q).map(function(w){ return KB.syn[w]?w+" "+KB.syn[w]:w; }).join(" "); }
  function pick(map,text){ var w=" "+words(text).join(" ")+" ", best=null, n=0;
    Object.keys(map).forEach(function(k){ var c=0; map[k].split(" ").forEach(function(x){ if(w.indexOf(" "+x+" ")>=0) c++; }); if(c>n){ n=c; best=k; } }); return best; }
  function search(q,n){
    var t=toks(expand(q)); if(!t.length) return [];
    return KB.res.map(function(r){ var ti=norm(r[5]+" "+r[6]), de=norm(r[7]+" "+r[8]), kw=norm(r[9]+" "+r[2]+" "+r[3]), s=0;
        t.forEach(function(x){ if(ti.indexOf(x)>=0) s+=3; if(kw.indexOf(x)>=0) s+=2; if(de.indexOf(x)>=0) s+=1; }); return [s,r]; })
      .filter(function(x){ return x[0]>0; }).sort(function(a,b){ return b[0]-a[0]; }).slice(0,n||5)
      .map(function(x){ var r=x[1]; return {title:r[5],title_sw:r[6],url:r[1],about:r[7],about_sw:r[8],type:r[3],stage:r[2]}; });
  }
  function money(text){
    var s=norm(text).replace(/(\d),(?=\d{3})/g,"$1"), m, K=function(x){ return x?1000:1; };
    if((m=s.match(/(?:usd|\$|dola|dollars?)\s*elfu\s*([0-9]+(?:\.[0-9]+)?)/))) return +m[1]*1000;
    if((m=s.match(/(?:usd|\$|dola|dollars?)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:(k|elfu)\b)?/))) return +m[1]*K(m[2]);
    if((m=s.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:(k|elfu)\b)?\s*(?:usd|\$|dola|dollars?)\b/))) return +m[1]*K(m[2]);
    if((m=s.match(/\b(?:milioni|million)\s*([0-9]+(?:\.[0-9]+)?)/))||(m=s.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:m|milioni|million)\b/))) return Math.round(+m[1]*1e6/rate());
    if((m=s.match(/(?:tzs|tsh|shilingi)\s*([0-9]+(?:\.[0-9]+)?)/))||(m=s.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:tzs|tsh|shilingi)\b/))) return Math.round(+m[1]/rate());
    return 0;
  }
  function parsePlan(text){ var usd=money(text), cat=pick(KB.goods,text); if(!usd||!cat) return null; return {goods:cat,origin:pick(KB.orig,text)||"cn",value_usd:usd,region:pick(KB.reg,text)||"dar"}; }
  function plan(p){
    var P=KB.plan, cat=String(p.goods||"household"), from=String(p.origin||"cn"), to=String(p.region||"dar"), g=Math.max(0,+p.value_usd||0);
    if(!P.CAT[cat]) cat=pick(KB.goods,cat)||"household"; if(!P.FROM[from]) from=pick(KB.orig,from)||"cn"; if(!P.TO[to]) to=pick(KB.reg,to)||"dar";
    var c=P.CAT[cat], f=P.FROM[from], t=P.TO[to], R=rate();
    if(!g) throw new Error("value_usd is needed, for example 15000");
    var cbm=g/c[1], mode, freight, port, n=1;
    if(cbm<=15){ mode="shared load (LCL)"; freight=Math.max(1,cbm)*f[2]; port=1200000+cbm*60000; }
    else if(cbm<=28){ mode="one 20ft container"; freight=f[3]; port=2750000; }
    else { n=Math.ceil(cbm/58); mode=n+" x 40ft container"; freight=f[4]*n; port=3500000*n; }
    var road=cbm<=15?Math.max(t[2],t[1]*cbm/28):t[1]*(cbm<=28?0.85:1)*n;
    var ins=(g+freight)*0.005, cif=(g+freight+ins)*R, duty=cif*c[0]/100, vat=(cif+duty)*0.18, goodsT=g*R;
    var net=goodsT+freight*R+ins*R+duty+port+road, days=7+f[1]+3+(cbm<=15?10:5)+f[0]+7+t[0];
    return {goods:cat,origin:from,region:to,value_usd:g,usd_tzs_rate:Math.round(R),shipping:mode,cubic_metres:Math.round(cbm*10)/10,freight_usd:Math.round(freight),
      duty_band_percent:c[0],duty_tzs:Math.round(duty),import_vat_tzs:Math.round(vat),port_and_agent_tzs:Math.round(port),transport_tzs:Math.round(road),
      landed_cost_tzs_excluding_vat_claimed_back:Math.round(net),landed_cost_multiple_of_goods:Math.round(net/goodsT*100)/100,deposit_30_percent_tzs:Math.round(goodsT*0.3),
      days_from_order_to_shop:days,permits:permits(cat).map(function(x){return x.agency;}),
      url:"import-plan-generator.html?cat="+cat+"&from="+from+"&usd="+g+"&to="+to,
      note:"Estimates from recent freight and port charges. Duty uses the usual EAC band for these goods; the exact rate depends on the HS code."};
  }
  function permits(cat){ var P=KB.plan; if(!P.PERM[cat]){ var k=pick(KB.goods,cat); cat=k||"household"; } var g=({household:"general",elec:"elec",build:"build",textile:"textile",food:"food",cosm:"cosm",med:"med",agri:"agri",mach:"general",parts:"general",furn:"general"})[cat]||"general";
    return (P.PERM[g]||P.PERM.general).map(function(x){ return {agency:x[0],en:x[1],sw:x[2]}; }); }
  function define(word){ var w=norm(word).trim(); if(!w) return [];
    var hits=KB.gl.filter(function(g){ return norm(g[0])===w||norm(g[1])===w; }); if(!hits.length) hits=KB.gl.filter(function(g){ return norm(g[0]+" "+g[1]).indexOf(w)>=0||w.indexOf(norm(g[0]))>=0&&g[0].length>2; });
    return hits.slice(0,3).map(function(g){ return {word:g[0],also:g[1],meaning_en:g[3],maana_sw:g[4],url:"glossary.html"}; }); }
  // One MQL score per person, from everything they did. 50 or more is an MQL.
  function mqlScore(subs){
    var s=0, why=[], seen={}, dl=0, val=0;
    function add(p,r){ s+=p; why.push(r+" (+"+p+")"); }
    (subs||[]).forEach(function(x){ var d=x.data||{}, t=x.type;
      if((t==="readiness_score"||(t==="finance_interest"&&d.score!=null))&&!seen.rs){ seen.rs=1; add(Math.round((+d.score||0)*0.4),"Readiness score "+(d.score||0)); var q=(d.answers||{}).q7||""; if(/20,000 to 100,000|Over USD 100,000/.test(q)) val=Math.max(val,20000); else if(/5,000 to 20,000/.test(q)) val=Math.max(val,5000); }
      if(t==="import_plan") val=Math.max(val,+d.value_usd||0);
      if(t==="importer_survey"&&/20,000|100,000/.test(d.value||"")) val=Math.max(val,20000);
      if((t==="finance_interest"||t==="callback_request")&&!seen.fi){ seen.fi=1; add(25,t==="finance_interest"?"Asked to talk about finance":"Asked a BDM to call"); }
      if(t==="import_plan"&&!seen.pl){ seen.pl=1; add(10,"Made an import plan"); }
      if(t==="importer_survey"&&!seen.sv){ seen.sv=1; add(10,"Answered the importer survey"); }
      if(t==="academy_certificate"){ add(8,"Earned an Academy certificate"); }
      if(t==="community_join"&&!seen.cj){ seen.cj=1; add(8,"Joined Biashara Tanzania"); }
      if(t==="meetup_rsvp"&&!seen.mt){ seen.mt=1; add(6,"Booked a meetup seat"); }
      if(t==="tool_lead"&&!seen.tl){ seen.tl=1; add(5,"Used the free tools"); }
      if((t==="download"||t==="download_notify")&&dl<3){ dl++; add(3,"Downloaded "+(d.item||"a resource")); }
      if(t==="newsletter"&&!seen.nl){ seen.nl=1; add(2,"Newsletter"); }
    });
    if(val>=20000) add(20,"Order size about USD "+Math.round(val).toLocaleString("en-US")); else if(val>=5000) add(12,"Order size about USD "+Math.round(val).toLocaleString("en-US"));
    s=Math.min(100,s); return {score:s,mql:s>=50,reasons:why};
  }
  return {search:search,plan:plan,parsePlan:parsePlan,permits:permits,define:define,mqlScore:mqlScore,money:money,goods:function(t){return pick(KB.goods,t);}};
})(window.RG_KB);

const fs=require('fs'),path=require('path');
const med=a=>{a=a.filter(x=>x!=null).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};
const V=(r,n)=>r.audits[n]&&r.audits[n].numericValue;
function load(f){f=f.replace(/\.json$/,'');for(const e of ['.report.json','.json']){if(fs.existsSync(f+e))return JSON.parse(fs.readFileSync(f+e));}return null;}
function heroStats(r){const na=r.audits['network-requests'];let heroKB=0,heroN=0,logoKB=0,imgKB=0,imgN=0;
  for(const i of (na?.details?.items||[])){const u=i.url;const kb=(i.transferSize||0)/1024;
    if(/\/hero\/slide/i.test(u)){heroKB+=kb;heroN++;}
    if(/\/logo\.(png|webp)/i.test(u))logoKB+=kb;
    if(/image/i.test(i.mimeType||'')||/\.(jpg|jpeg|png|webp|avif)/i.test(u)){imgKB+=kb;imgN++;}
  }
  return {heroKB:Math.round(heroKB),heroN,logoKB:Math.round(logoKB),imgKB:Math.round(imgKB),imgN};}
function medHome(dir){const out={};for(const mode of ['mobile','desktop']){const perf=[],lcp=[],cls=[],fcp=[],tbt=[],si=[],kb=[],req=[];let hs=null;
  for(let p=1;p<=3;p++){const r=load(path.join(dir,`home_${mode}_${p}`));if(!r)continue;perf.push(Math.round(r.categories.performance.score*100));lcp.push(V(r,'largest-contentful-paint'));cls.push(V(r,'cumulative-layout-shift'));fcp.push(V(r,'first-contentful-paint'));tbt.push(V(r,'total-blocking-time'));si.push(V(r,'speed-index'));const na=r.audits['network-requests'];let b=0,c=0;for(const i of(na?.details?.items||[])){b+=i.transferSize||0;c++;}kb.push(Math.round(b/1024));req.push(c);if(p===1)hs=heroStats(r);}
  out[mode]={perf:med(perf),lcp:med(lcp),cls:med(cls),fcp:med(fcp),tbt:med(tbt),si:med(si),kb:med(kb),req:med(req),hero:hs};}
  return out;}
const before=medHome('performance-audit/lighthouse/before');
const after=medHome('performance-audit/lighthouse/after-local');
console.log('=== BEFORE (prod) home ==='); console.log(JSON.stringify(before,null,1));
console.log('=== AFTER (local) home ==='); console.log(JSON.stringify(after,null,1));
// screenshots finales
for(const [tag,dir,file] of [['before','performance-audit/lighthouse/before','home_desktop_1'],['after','performance-audit/lighthouse/after-local','home_desktop_1']]){
  const r=load(path.join(dir,file));const d=r?.audits?.['final-screenshot']?.details?.data;
  if(d&&d.startsWith('data:image')){const b64=d.split(',')[1];fs.writeFileSync(`performance-audit/screenshots/${tag}/home_desktop_lighthouse.jpg`,Buffer.from(b64,'base64'));console.log('screenshot',tag,'ok');}
}
fs.writeFileSync('performance-audit/lighthouse/_compare.json',JSON.stringify({before,after},null,2));

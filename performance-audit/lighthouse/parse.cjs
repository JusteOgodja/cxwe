const fs=require('fs'), path=require('path');
const dir=process.argv[2];
const routes=['home','catalog','product','quote'], modes=['mobile','desktop'];
const med=a=>{a=a.filter(x=>x!=null).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};
function val(r,n){return r.audits[n]&&r.audits[n].numericValue;}
function netKB(r){const na=r.audits['network-requests'];if(!na||!na.details)return[null,null];let b=0,c=0;for(const i of na.details.items){b+=i.transferSize||0;c++;}return[Math.round(b/1024),c];}
function imgKB(r){const na=r.audits['network-requests'];if(!na||!na.details)return null;let b=0;for(const i of na.details.items){if(/image/i.test(i.mimeType||'')||/\.(jpg|jpeg|png|webp|avif|gif)/i.test(i.url))b+=i.transferSize||0;}return Math.round(b/1024);}
const rows=[];
for(const route of routes)for(const mode of modes){
  const perf=[],fcp=[],lcp=[],cls=[],tbt=[],ttfb=[],si=[],kb=[],req=[],img=[];let lcpEl='n/a';
  for(let p=1;p<=3;p++){const f=path.join(dir,`${route}_${mode}_${p}.report.json`);if(!fs.existsSync(f)){const alt=path.join(dir,`${route}_${mode}_${p}.json`);if(!fs.existsSync(alt))continue;var r=JSON.parse(fs.readFileSync(alt));}else var r=JSON.parse(fs.readFileSync(f));
    perf.push(Math.round(r.categories.performance.score*100));fcp.push(val(r,'first-contentful-paint'));lcp.push(val(r,'largest-contentful-paint'));cls.push(val(r,'cumulative-layout-shift'));tbt.push(val(r,'total-blocking-time'));ttfb.push(val(r,'server-response-time'));si.push(val(r,'speed-index'));const[k,c]=netKB(r);kb.push(k);req.push(c);img.push(imgKB(r));const el=r.audits['largest-contentful-paint-element'];if(el&&el.details&&el.details.items&&el.details.items[0]&&el.details.items[0].items&&el.details.items[0].items[0])lcpEl=el.details.items[0].items[0].node?.nodeLabel?.slice(0,40)||lcpEl;
  }
  rows.push({route,mode,perf:med(perf),fcp:med(fcp),lcp:med(lcp),cls:med(cls),tbt:med(tbt),ttfb:med(ttfb),si:med(si),kb:med(kb),req:med(req),img:med(img),lcpEl});
}
// markdown
let out=`| Route | Mode | Perf | FCP (ms) | LCP (ms) | CLS | TBT (ms) | Speed Index (ms) | TTFB (ms) | Poids (Ko) | Requêtes | Images (Ko) |\n|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|\n`;
for(const r of rows)out+=`| ${r.route} | ${r.mode} | ${r.perf} | ${Math.round(r.fcp)} | ${Math.round(r.lcp)} | ${r.cls?.toFixed(3)} | ${Math.round(r.tbt)} | ${Math.round(r.si)} | ${Math.round(r.ttfb)} | ${r.kb} | ${r.req} | ${r.img} |\n`;
console.log(out);
fs.writeFileSync(path.join(dir,'_parsed.json'),JSON.stringify(rows,null,2));

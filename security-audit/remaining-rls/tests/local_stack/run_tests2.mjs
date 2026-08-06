// Phase-2 real-JWT harness (LOCAL Supabase). Covers buyer_profiles isolation,
// RPC EXECUTE per role, anon grant whitelist, and regressions (brands, is_admin).
// Local demo keys (issuer supabase-demo) — public, not production secrets.

const API = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const USERS = {
  A:     { email: 'usera@synthetic.test', password: 'Passw0rd!A' },
  B:     { email: 'userb@synthetic.test', password: 'Passw0rd!B' },
  admin: { email: 'admin@synthetic.test', password: 'Passw0rd!X' },
};
async function adminCreate(u){const r=await fetch(`${API}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:u.password,email_confirm:true})});if(!r.ok&&r.status!==422)throw new Error(`create ${u.email}: ${r.status} ${await r.text()}`);}
async function login(u){const r=await fetch(`${API}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:u.password})});const j=await r.json();if(!j.access_token)throw new Error(`login ${u.email}: ${JSON.stringify(j)}`);return {token:j.access_token, uid:j.user.id};}
async function rest(token,method,path,body,prefer){const h={apikey:ANON,Authorization:`Bearer ${token||ANON}`};if(body!==undefined)h['Content-Type']='application/json';if(prefer)h['Prefer']=prefer;const r=await fetch(`${API}/rest/v1/${path}`,{method,headers:h,body:body!==undefined?JSON.stringify(body):undefined});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,data:d};}
async function rpc(token,name,args){const h={apikey:ANON,Authorization:`Bearer ${token||ANON}`,'Content-Type':'application/json'};const r=await fetch(`${API}/rest/v1/rpc/${name}`,{method:'POST',headers:h,body:JSON.stringify(args||{})});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,data:d};}
const S=(r)=>`${r.status}${(r.data&&r.data.code)?'/'+r.data.code:(Array.isArray(r.data)?`(${r.data.length})`:'')}`;
const ok=(r)=>r.status>=200&&r.status<300;

async function main(){
  for(const k of Object.keys(USERS)) await adminCreate(USERS[k]);
  const A=await login(USERS.A), B=await login(USERS.B), admin=await login(USERS.admin);

  // seed buyer_profiles owned by A and B (via service_role, bypass RLS)
  await rest(SERVICE,'POST','buyer_profiles',{user_id:A.uid,full_name:'Alice',company_name:'ACo',country:'MA'},'return=minimal');
  await rest(SERVICE,'POST','buyer_profiles',{user_id:B.uid,full_name:'Bob',company_name:'BCo',country:'FR'},'return=minimal');

  console.log('\n===== buyer_profiles =====');
  console.log('anon   SELECT:', S(await rest(null,'GET','buyer_profiles?select=id')), ' INSERT:', S(await rest(null,'POST','buyer_profiles',{user_id:A.uid},'return=minimal')));
  console.log('A insert own:', S(await rest(A.token,'POST','buyer_profiles',{user_id:A.uid,full_name:'A2'},'return=minimal')));
  console.log('A insert as B (forge):', S(await rest(A.token,'POST','buyer_profiles',{user_id:B.uid,full_name:'forge'},'return=minimal')), '(expect blocked)');
  console.log('A select own count:', S(await rest(A.token,'GET',`buyer_profiles?select=id&user_id=eq.${A.uid}`)));
  console.log('A read B row:', S(await rest(A.token,'GET',`buyer_profiles?select=id&user_id=eq.${B.uid}`)), '(expect 0)');
  console.log('A select ALL:', S(await rest(A.token,'GET','buyer_profiles?select=id')), '(expect only own)');
  console.log('B read A row:', S(await rest(B.token,'GET',`buyer_profiles?select=id&user_id=eq.${A.uid}`)), '(expect 0)');
  console.log('admin select ALL:', S(await rest(admin.token,'GET','buyer_profiles?select=id')), '(expect all)');

  console.log('\n===== RPC EXECUTE (per role) =====');
  const rpcs=[['get_quality_stats',{}],['get_products_with_issues',{p_limit:5}],['count_brands_no_active_products',{}],['count_categories_no_active_products',{}],['search_products',{p_query:''}],['list_source_sites',{}],['refresh_product_counts',{}]];
  console.log('name'.padEnd(34),'| anon        | authA       | admin');
  for(const [n,a] of rpcs){
    const ra=await rpc(null,n,a), rb=await rpc(A.token,n,a), rc=await rpc(admin.token,n,a);
    console.log(n.padEnd(34),'|',S(ra).padEnd(11),'|',S(rb).padEnd(11),'|',S(rc));
  }

  console.log('\n===== anon grants (whitelist) =====');
  console.log('anon INSERT quote_requests:', S(await rest(null,'POST','quote_requests',{company_name:'X',email:'z@z.z'},'return=minimal')), '(expect 201)');
  console.log('anon INSERT collaboration_requests:', S(await rest(null,'POST','collaboration_requests',{company:'X',email:'z@z.z'},'return=minimal')), '(expect 201)');
  console.log('anon INSERT products:', S(await rest(null,'POST','products',{name:'hack'},'return=minimal')), '(expect blocked)');
  console.log('anon UPDATE products:', S(await rest(null,'PATCH','products?is_active=eq.true',{name:'x'},'return=minimal')), '(expect blocked)');
  console.log('anon DELETE categories:', S(await rest(null,'DELETE','categories?is_active=eq.true','return=minimal')), '(expect blocked)');
  console.log('anon SELECT products:', S(await rest(null,'GET','products?select=id&limit=1')), '(expect 200 public)');
  console.log('anon SELECT categories:', S(await rest(null,'GET','categories?select=id&limit=1')), '(expect 200 public)');
  console.log('anon SELECT buyer_profiles:', S(await rest(null,'GET','buyer_profiles?select=id&limit=1')), '(expect blocked)');
  console.log('anon SELECT quote_requests:', S(await rest(null,'GET','quote_requests?select=id&limit=1')), '(expect blocked/0)');

  console.log('\n===== regressions =====');
  console.log('anon SELECT brands active:', S(await rest(null,'GET','brands?select=id&is_active=eq.true')), '(expect 200)');
  console.log('anon exec is_admin:', S(await rpc(null,'is_admin',{})), '(expect blocked)');
  console.log('ordinary A exec is_admin:', S(await rpc(A.token,'is_admin',{})), '/ value=', (await rpc(A.token,'is_admin',{})).data, '(expect false)');
  console.log('admin exec is_admin value=', (await rpc(admin.token,'is_admin',{})).data, '(expect true)');
  console.log('A insert category (ordinary):', S(await rest(A.token,'POST','categories',{name:'x'},'return=minimal')), '(expect blocked)');
  console.log('admin insert category:', S(await rest(admin.token,'POST','categories',{name:'adminadd'},'return=minimal')), '(expect 201)');
}
main().catch(e=>{console.error('FATAL',e);process.exit(1);});

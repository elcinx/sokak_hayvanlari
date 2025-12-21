// Basit smoke testi. Sunucu 3000'de çalışıyor varsayılır.
// Auth gerektiren endpointlerde token kullanılmıyor; sadece public GET'ler.
const checks = [
  { url:"http://localhost:3000/", expect:200 },
  { url:"http://localhost:3000/auth/login", expect:200 },
  { url:"http://localhost:3000/health", expect:200 },
  { url:"http://localhost:3000/api/metrics/summary", expect:200 },
  { url:"http://localhost:3000/api/feeds", expect:200 },
];

async function main(){
  let ok=true;
  for (const c of checks){
    try{
      const res = await fetch(c.url);
      const status = res.status;
      const pass = status === c.expect;
      console.log(c.url, status, pass ? "OK":"FAIL");
      if (!pass) ok=false;
    }catch(e){
      ok=false;
      console.error(c.url, "FAILED", e.message);
    }
  }
  if (!ok){
    console.error("Smoke checks failed");
    process.exit(1);
  }
}

main();

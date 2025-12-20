// Basit smoke testi. Sunucu 3000'de çalışıyor varsayılır.
// Auth gerektiren endpointlerde token kullanılmıyor; sadece public GET'ler.
const urls = [
  "http://localhost:3000/api/metrics/summary",
  "http://localhost:3000/api/feeds",
  "http://localhost:3000/api/feeds/heatmap",
  "http://localhost:3000/api/feeds/points-summary",
  "http://localhost:3000/api/leaderboard/weekly",
  "http://localhost:3000/api/gallery",
  "http://localhost:3000/health"
];

async function main(){
  for (const u of urls){
    try{
      const res = await fetch(u);
      console.log(u, res.status);
    }catch(e){
      console.error(u, "FAILED", e.message);
    }
  }
}

main();

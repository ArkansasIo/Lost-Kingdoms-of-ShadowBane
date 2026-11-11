const fs=require('fs'),vm=require('vm');
let src='';for(const f of ['data_rules','data_world','gen'])src+=fs.readFileSync('src/'+f+'.js','utf8').replace(/'use strict';/g,'');
vm.runInThisContext(src.replace(/^const /gm,'var ').replace(/^let /gm,'var '));
const IW=1592, IH=988;
// every zone, including the expansion worlds with their own painted maps (world: 0 = Valendria, else the expansion number)
const zones=ZONES.map(z=>{const m=buildZone(z);const [nx,ny]=zonePin(z);const reg=REGIONS.find(r=>r.id===z.region);
  const bosses=m.bosses.map(b=>{const B=BOSS_BY_ID[b.id];return {name:B.name,lvl:B.lvl,cat:B.cat,mechs:B.mechs||[],title:B.title||null}});
  const sq=z.town?[]:sideQuests(z).map(q=>({name:q.name,text:q.text,xp:q.xp,gold:q.gold}));
  return {id:z.id,name:z.name,region:z.region,regionName:reg.name,place:(REGION_PINS[z.region]||[])[2],continent:continentOf(z),world:worldOf(z),sub:z.sub,biome:z.biome,lvl:z.lvl,town:!!z.town,act:reg.act||0,exp:reg.exp||0,
    x:Math.round((nx+0.012)*IW),y:Math.round((ny+0.016)*IH),
    dungeon:m.poi.dungeon?(DUNGEONS.find(d=>d.id===m.poi.dungeon.id)||{}).name:null, raid:m.poi.raid?(RAIDS.find(d=>d.id===m.poi.raid.id)||{}).name:null,
    waypoint:!!m.poi.waypoint, herb:z.town?null:HERB_BY_BIOME[z.biome], areas:m.areas.map(a=>a.name), exits:Object.values(m.exits).map(e=>e.to), bosses, quests:sq}});
const edges=[];const seen=new Set();
for(const z of zones)for(const t of z.exits){if(!zones.find(q=>q.id===t))continue;const k=[z.id,t].sort().join('|');if(seen.has(k))continue;seen.add(k);const o=zones.find(q=>q.id===t);edges.push({a:z.id,b:t,sea:o.continent!==z.continent,...(o.world!==z.world?{voyage:true}:{})})}
// harbour ship routes from the capital to each expansion
EXPANSIONS.filter(x=>!x.world).forEach(x=>{edges.push({a:'ardenhold_s1',b:`${x.id}_0`,sea:true,ship:true})});
const regions=REGIONS.map(r=>({id:r.id,world:r.exp&&EXPANSIONS.find(x=>x.n===r.exp).world?r.exp:0,name:r.name,biome:r.biome,lvl:r.lvl,act:r.act||0,exp:r.exp||0,desc:r.desc,place:(REGION_PINS[r.id]||[])[2],
  dungeon:(DUNGEONS.find(d=>d.zone===r.id)||{}).name||null, raid:(RAIDS.find(d=>d.zone===r.id)||{}).name||null,
  arc:(BOSSES.find(b=>b.cat==='arc'&&b.where&&ZONE_BY_ID[b.where]&&ZONE_BY_ID[b.where].region===r.id)||{}).name||null,
  chapters:CHAPTERS.map((c,i)=>({n:i+1,act:c[0],title:c[1],line:c[3]})).filter(c=>c.act===r.act&&r.act)}));
const worlds=[{n:0,name:'VALENDRIA',lvl:[1,720],desc:'The base game and expansions 1-5.'},...EXPANSIONS.filter(x=>x.world).map(x=>({n:x.n,name:worldName(x.n),lvl:x.lvl,desc:x.desc}))];
const out={zones,edges,regions,worlds,acts:ACTS,expansions:EXPANSIONS.map(x=>({n:x.n,name:x.name,lvl:x.lvl,desc:x.desc,raid:x.raid,world:!!x.world,zones:ZONES.filter(z=>z.exp===x.n).map(z=>z.name)})),build:BUILD,counts:{zones:ZONES.length,bosses:BOSSES.length,bestiary:BESTIARY.length}};
fs.writeFileSync(process.argv[2],JSON.stringify(out));
console.log(zones.length,'zones in',worlds.length,'worlds,',edges.length,'edges',edges.filter(e=>e.sea).length,'sea');

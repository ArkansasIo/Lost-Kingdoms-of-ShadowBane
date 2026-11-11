const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'assets');
const DIST_DIR = path.join(ROOT, 'dist');
const ORDER = ['data_rules', 'jobs_data', 'data_world', 'gen', 'creatures', 'rooms', 'engine', 'audio64', 'video64', 'rules', 'combat', 'mmorpg/systems/pvp', 'systems', 'rank-system', 'art', 'art_gallery', 'scenes_menu', 'hd_character_art', 'scenes_world', 'npc_art', 'inventory', 'items', 'gems', 'runes', 'boss_rewards', 'boss_progression', 'easter_eggs', 'secret_world', 'gem_ui', 'rune_ui', 'armory', 'trinkets', 'profperks', 'materials', 'companions', 'arts', 'netlocal', 'realm_social', 'market', 'heirlooms', 'mmo_loop', 'keystones', 'dread', 'polish', 'durability', 'guild_prog', 'world_quests', 'loadouts', 'jobs', 'necro_army', 'towns', 'npc_ai', 'ui_dark', 'ui_mmo', 'battlebg', 'asset_pack', 'pack_index', 'pack_art', 'mount_data', 'mounts', 'tnl_systems', 'tnl_extras', 'guild_war', 'extras', 'aspects_data', 'd4_gear', 'totems', 'awakening', 'guide', 'chatwow', 'admin', 'chatbox', 'chatframe', 'identity', 'main', 'player_hud', 'debug'];

const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const clientFile = name => name === 'main' ? 'client/main.js' : `src/${name}.js`;
const readInlineObject = (html, name) => {
  const match = html && html.match(new RegExp(`window\\.${name}=(\\{[\\s\\S]*?\\});</script>`));
  return match ? JSON.parse(match[1]) : null;
};
const previousBuildPath = path.join(DIST_DIR, 'gbquest.html');
const previousBuild = fs.existsSync(previousBuildPath) ? fs.readFileSync(previousBuildPath, 'utf8') : '';
const assets = readInlineObject(previousBuild, 'GB_ASSETS') || {};
const previousNesIndex = readInlineObject(previousBuild, 'NES_INDEX');
const previousCitadelAssets = readInlineObject(previousBuild, 'GBQ_CITADEL_ASSETS') || {};

fs.mkdirSync(ASSET_DIR, { recursive: true });
const files = fs.readdirSync(ASSET_DIR)
  .filter(file => file.endsWith('.png') && !file.startsWith('device_mockup') && !file.startsWith('bg_patterns'))
  .sort();
for (const file of files) {
  const name = file.slice(0, -4);
  assets[name] = 'data:image/png;base64,' + fs.readFileSync(path.join(ASSET_DIR, file)).toString('base64');
}
const names = Object.keys(assets).sort();
if (!names.length) throw new Error('No local PNGs or embedded assets found; cannot build the game.');
const orderedAssets = Object.fromEntries(names.map(name => [name, assets[name]]));
const nesPath = path.join(ASSET_DIR, 'nes_index.json');
const nesIndex = fs.existsSync(nesPath) ? JSON.parse(fs.readFileSync(nesPath, 'utf8')) : previousNesIndex;
if (!nesIndex) throw new Error('NES index missing from assets/nes_index.json and previous bundled build.');
const nes = '<script>window.NES_INDEX=' + JSON.stringify(nesIndex) + ';</script>\n';
const gbAssets = '<script>window.GB_ASSETS=' + JSON.stringify(orderedAssets) + ';</script>\n';
fs.writeFileSync(path.join(ASSET_DIR, 'index.json'), JSON.stringify(names));

const hd64Files = fs.readdirSync(path.join(ROOT, 'assets_hd64')).filter(file => file.endsWith('.png')).sort();
const hd64Atlases = Object.fromEntries(hd64Files.map(file => [file.slice(0, -4), 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets_hd64', file)).toString('base64')]));
const hd64Indexes = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'assets_hd64')).filter(file => file.endsWith('.json')).map(file => [file.slice(0, -5), JSON.parse(fs.readFileSync(path.join(ROOT, 'assets_hd64', file), 'utf8'))]));
const hd64 = '<script>window.GBQ_HD64_ATLASES=' + JSON.stringify(hd64Atlases) + ';window.GBQ_HD64_INDEXES=' + JSON.stringify(hd64Indexes) + ';</script>\n';
const citadelFiles = [];
function walkCitadel(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkCitadel(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      citadelFiles.push([rel, 'data:image/svg+xml;base64,' + fs.readFileSync(full).toString('base64')]);
    }
  }
}
walkCitadel(path.join(ROOT, 'assets_citadel'));
const citadelAssets = { ...previousCitadelAssets, ...Object.fromEntries(citadelFiles) };
const citadel = '<script>window.GBQ_CITADEL_ASSETS=' + JSON.stringify(citadelAssets) + ';</script>\n';
const assetUrl = name => {
  if (assets[name]) return assets[name];
  const file = path.join(ASSET_DIR, name + '.png');
  if (fs.existsSync(file)) return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  throw new Error(`Required shell artwork ${name}.png is absent from local and embedded assets.`);
};
const themePokemon = rd('client/theme-pokemon.css');
const themeShadows = rd('client/theme-shadows.css')
  .replaceAll('url("GBQ_MASTER_CATALOG")', `url("${assetUrl('gbq_master_catalog')}")`)
  .replaceAll('url("GBQ_UI_MOCKUP")', `url("${assetUrl('gbq_ui_mockup_catalog')}")`);
const shell = rd('client/shell.html')
  .replace('<link rel="stylesheet" href="theme-citadel.css">', '<style>\n' + rd('client/theme-citadel.css') + '\n' + themeShadows + '\n</style>')
  .replace('<link rel="stylesheet" href="client/player-hud.css">', '<style>\n' + rd('client/player-hud.css') + '\n</style>')
  .replace('<link rel="stylesheet" href="client/theme-pokemon.css">', '<style>\n' + themePokemon + '\n</style>');

const sourceCatalogAvailable = files.length > 1 && fs.existsSync(nesPath) && fs.existsSync(path.join(ASSET_DIR, 'gbq_master_catalog.png'));
let dev;
if (sourceCatalogAvailable) {
  dev = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    + shell.replace('<aside', '</head><body class="theme-shadows theme-pokemon">\n<aside') + '\n' + nes + '<script>fetch("dist/atlas.html").then(r => r.text()).then(t => window.ATLAS_HTML = t).catch(() => {});</script>\n'
    + ORDER.map(name => `<script src="${clientFile(name)}"></script>\n`).join('') + '</body></html>\n';
} else {
  dev = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="refresh" content="0; url=dist/gbquest.html"><title>Lost Kingdoms of Shadowbane Chronicles</title></head><body>'
    + '<p>Open <a href="dist/gbquest.html">the self-contained game build</a>.</p><script>location.replace("dist/gbquest.html");</script></body></html>\n';
}
fs.writeFileSync(path.join(ROOT, 'index.html'), dev);

fs.mkdirSync(DIST_DIR, { recursive: true });
const atlas = '<script>window.ATLAS_HTML=' + JSON.stringify(rd('dist/atlas.html')).replace(/<\//g, '<\\/') + ';</script>\n';
const single = '<!doctype html>\n<html lang="en"><head>\n' + shell.replace('<aside', '</head><body class="theme-shadows theme-pokemon">\n<aside')
  + '\n' + gbAssets + nes + atlas + hd64 + citadel + ORDER.map(name => `<script>\n${rd(clientFile(name))}\n</script>\n`).join('') + '\n</body></html>\n';
fs.writeFileSync(path.join(DIST_DIR, 'gbquest.html'), single);

const fsHtml = rd('client/fullscreen.html');
let full = single.replace('<title>Lost Kingdoms of Shadowbane Chronicles</title>', '<title>Lost Kingdoms of Shadowbane Chronicles Full Screen</title>')
  .replace('</style>', '</style>\n' + fsHtml.split('<div class="fsbar"')[0]);
full = full.replace('<section class="chat"', '<div class="fsbar"' + fsHtml.split('<div class="fsbar"')[1] + '\n<section class="chat"');
fs.writeFileSync(path.join(DIST_DIR, 'gbquest-fullscreen.html'), full);

console.log(`Built index.html + dist/gbquest.html (${Math.round(single.length / 1024)} KB, ${names.length} assets${sourceCatalogAvailable ? '' : ' (source images recovered from prior bundle)'})`);

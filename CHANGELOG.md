# Changelog

All notable changes to Lost Kingdom of Shadowbane Chronicles. Versions follow `MAJOR.MINOR.PATCH`; builds are dated `BYYYY.MM.DD`.

## Unreleased

### Added
- **Realm guilds** (`backend/guilds.cjs`, SETTINGS > ACCOUNT > REALM GUILD on a realm server): guilds kept by the server, so every member sees the same roster on any device. Ranks (leader, officer, member, recruit), invitations, removals, a message of the day and a shared **guild bank** (3 tabs of 20 items plus a gold vault) with daily withdrawal limits per rank. See [docs/SERVER.md](docs/SERVER.md).
- **Group finder** (`backend/groupfinder.cjs`, SETTINGS > ACCOUNT > GROUP FINDER): queue as tank, healer or damage for a trial (3), dungeon (5) or raid (10) and get matched with real players within 15 levels, with a 60-second ready check. The AI-filled ACTIVITY FINDER is unchanged.
- **MySQL / MariaDB export** (`npm run sql`, `tools/export_sql.cjs`): `data/sql/schema.sql` and `data/sql/seed.sql` with 27 catalogue tables (id, number, name and the full record for every class, spell, item, zone, creature, boss, chapter and more) and the realm tables; `--realm` turns a realm.json into INSERTs. See [docs/DATABASE.md](docs/DATABASE.md).
- **Atlas world switcher**: the atlas now shows all 154 zones; a WORLD picker moves between Valendria and the eight expansion worlds on their own maps, and the route planner follows voyages between worlds.
- **ADVENTURE** (MAIN MENU > ADVENTURE, `src/tnl_extras.js`): **DUNGEON TOKENS** (10 max, one refills every 2 hours; a dungeon clear spends one for a bonus chest, a trait stone and dungeon marks, spent in the MARKS SHOP), a daily **CONTRACTS** board (three factions, hold three, paid in contract coins for the COIN SHOP), **GEAR TRAITS** (three per item, ranks 1-5, unlock/upgrade with trait stones or extract one from a bag item; BOSS SLAYER adds boss damage), a **CODEX** (monster-family and dungeon pages with permanent bonuses) and timed **FIELD EVENTS** (every 30 minutes in a zone near your level).
- **DREAD DUNGEONS** (MAIN MENU > DREAD DUNGEONS, `src/dread.js`): **DREAD SIGILS** (tier 1-100 dungeon runs with a boon and 1-3 banes; drop from dungeon clears, craft from powder), **THE PIT** (timed tiered climb, tiers 1-150, pays pit shards), a **SHARD EXCHANGE** (pit shards to masterwork scrap for the OCCULTIST) and the **ENDLESS HORDE** (ten scaling waves in the open world with boons and an aether chest).
- **TOTEMS** (`src/totems.js`): a 15th weapon family. Five one-handed elemental totems (FLAME, FROST, STORM, EARTH, SPIRIT) any class can wield; each adapts to the wielder's role. Passive: tanks get resist, HP and element stats; DPS get damage and elemental damage; healers get healing. **PLANT TOTEM** (bonus action, once per battle, twice with LEGENDARY+ totems) has 15 element x role effects: tank temp HP and guard auras, DPS elemental pulses and debuffs, healer party heals and buffs. AI companions plant on their first turn; totems drop as normal loot.
- **AWAKENING** (MAIN MENU > AWAKENING, `src/awakening.js`): post-cap evolution for all 27 classes. Five class tiers (levels 60/150/270/420/600, paid in gold) add class substats, a once-per-battle **awakened ultimate** (tier I) and a battle-start buff (tier III, longer at V). **TALENT / SPELL / ABILITY** tracks (ranks 0-10, bought with awakening points) boost learned talents, spell power, DC and slots, and crit, class resources and active-skill uses per battle. **GOD TALENTS** (tier III+): four pantheons (WAR, ARCANA, LIFE, SHADOW) of five ranks bought with divinity points; only one rank-5 god capstone may be held. Points reset for gold.

### Changed
- **Dungeon floors**: every room on the main path now has a doorway; doors only sit in real doorways (walls on both sides), so none float in wide corridors or open rooms; wall torches, signs and shelves only hang on visible wall faces (no more torches in the void on tower floors); stairs always have a free tile beside them. Stepping onto the UP stairs or the EXIT now asks right away (no need to face them and press A), and leaving an instance never drops you inside a wall or water.
- **Menus and sub-pages**: the CHARACTER page's CHAR, BAG and GEAR tabs now show different previews (stats; the first 15 bag items; the 14 equipment slots) with the right A-button hint. Selected rows no longer hide text drawn in the highlight colour (MOUNTS, BESTIARY, ACHIEVEMENTS and others). Fixed text overflowing in SPELLBOOK (and its '?' separators), PROFESSIONS, SOCIAL, HEIRLOOMS and the BAG tooltip. Characters the pixel font lacks (like the middle dot, dashes and stars) now draw as their plain look-alikes instead of '?'.
- **No floating text by default**: the on-screen chat lines, chat bubbles and other players' name tags start off (name tags still show for adjacent players and hostile PvP targets). Turn them back on in SETTINGS > CHAT SETTINGS (SCREEN CHAT, CHAT BUBBLES, NAME TAGS). With bubbles off, NPC greetings go to the chat log.
- **Spell levels 1-9 now span levels 1-720**: a full caster first casts spell levels 2-9 at levels 12, 46, 102, 181, 282, 406, 552 and 720 (was 3-17); slots, half casters and pact magic follow the same curve. Heroes above level 20 may lose high spell levels until they reach the new unlock levels. See docs/LEVEL_1_TO_720.md.
- The chat panel now starts closed. Press **C** or the **CHAT** button to open it; SETTINGS > CHAT SETTINGS turns chat off completely.

### Added
- **HD64 6,000 asset pack**: `tools/gen_pack6000_hd.py` on a new renderer (`tools/hd64_engine.py`) draws all 6,000 assets in 18 categories as shaded 64x64 pixel art (lit height-field shapes, hue-shifted ramps, rock chunks with glowing cracks, emissive glows, outlines), all unique and deterministic, with monsters and bosses grouped by bestiary family. The Summer port packs them into atlases, shows monsters and bosses with their family's art (SETTINGS > MONSTER ART) and adds an ART GALLERY. See docs/ASSET_PACK_6000.md.
- **Summer Engine (Godot 4) port prototype** in `summer-prototype/` at 640x576 (HD 4x): title, race and class creation, every zone and town with NPCs and exits, encounters, 5e turn-based battle with spells and level-ups, inn, vendor, menu and save/load, plus gear: class starting kits, weapon and armour drops by rarity, a vendor ARMS list and SELL, and GEAR & BAG pages that drive AC and attack rolls. Also all 38 dungeons: 3 themed floors each with visible monster packs, a hidden cache and a floor boss guarding the stairs, plus a clear bonus. Stage 4 adds item affixes and the 164 aspects working in battle (with conditions, buffs and barriers), job abilities and support jobs, the 50-chapter story with arc bosses and a goal tracker, crafting from monster materials, stable mounts, and a CHARACTER page. Stage 5 adds accessories in 12 more slots, gems and sockets, tempering and masterwork, world bosses, gathering nodes, all 17 raids (with raid mounts) and the 6 trials. Stage 6 adds side quests, fishing, cooking and consumables, relics and artifacts with curators, aspect extract/imprint, dungeon doors and hidden traps, and flight on flying mounts. Stage 7 adds talents, companions with bonds, guilds with perks, conquest (boonstones, castle siege, tax), the arena with honor gear, daily bounties, homes and the bank, waypoint travel, the Spire and difficulty 1-9. Stage 8 connects the port to the realm server: accounts, live presence (Godot and browser players see each other), chat, the trading hub and the leaderboard, with no server changes. Stage 9 adds realm parties both ways (host or join, with the browser's srv_* battle messages) and war-mode duels. Stage 10 adds the chip music and SFX (rendered from the browser's own song and sound data), a SETTINGS page with volumes and five UI themes, the necromancer's army of up to 9 with the Book of the Dead and RAISE DEAD, wandering NPCs, and HP tracking for joined party players. `tools/export_godot.cjs` exports all game data (36 tables, 154 zones, 5,077 sprites) and art from the built browser game. The browser game is unchanged. See [docs/SUMMER_PORT.md](docs/SUMMER_PORT.md).
- **ADVENTURER'S GUIDE** (MAIN MENU > GUIDE): an in-game encyclopedia of every system in 13 topics: basics, all 27 classes and jobs (role, hit die, saves, casting, subclasses, job abilities), all 15 races, spells (the 1-720 spell-level curve and every school), combat, gear, an ASPECT CODEX browser (all 164 aspects by category, with the ones you have saved marked), world, content, guilds and conquest, progression, NPCs and settings. Numbers are read from the live data.
- **Systems design document**: [docs/SYSTEMS_DESIGN.md](docs/SYSTEMS_DESIGN.md) describes the architecture, extension pattern, every system with its numbers and files, the damage pipeline, the aspect effect engine, content loops and open questions.
- **164 legendary aspects** (`src/aspects_data.js`), covering every family of action-RPG legendary power with original names and our own elements, conditions and buffs: conditional damage (low-HP, full-HP, elites, crowds, crits, first hit, your own HP, physical or spell hits), ten elemental BRANDs, FANGs (bonus damage), BURSTs (kill explosions), ARCs (chains) and WARDs (resistance); twelve debuffs to inflict and to exploit (HUNTER) plus six SHELLs that curse attackers; nine buffs gained on kill (REAPER), at battle start (HERALD), on hit (SURGE) or rewarding you while active (FURY); barriers, damage reduction, reflection, lifesteal and sixteen passive-stat aspects. Text is generated from each aspect's rules, and the OCCULTIST codex holds all of them. The original sixteen aspects are unchanged.
- **Action-RPG gear effects** (`src/d4_gear.js`, in the style of Diablo IV):
  - **Legendary aspects**: legendary, mythic, ancestral and divine items roll one of 16 aspects with its own value: EXECUTIONER, FIRST STRIKE, ELITE SLAYER, STORMSHARD (lucky-hit chain lightning), GLACIAL (frostbite), BLOODLETTER (bleed), VAMPIRIC (lucky-hit heal), CORPSEBURST (kills explode), BLOODLUST, BULWARK (opening barrier), UNBROKEN, BRAMBLES (reflect), WINDSTRIKE (opening haste), FORTUNE, SAGE and WARLORD. They fire in battle and show in the item text.
  - **Greater affixes**: each affix has a 6% chance to roll 1.5x (ancestral and divine items always get one).
  - **OCCULTIST** (MAIN MENU): EXTRACT an aspect into your CODEX OF POWER (the best value is kept), IMPRINT a codex aspect onto any rare-or-better item, TEMPER up to 2 extra affix lines (OFFENSIVE, DEFENSIVE or UTILITY recipes), and MASTERWORK items through 12 ranks (+5% affixes per rank; ranks 4, 8 and 12 also boost one affix by 25%).
- **CRIMSON UI theme** (MU-style; SETTINGS > UI THEME): black stone panels with blood-red frames, gold trim and corner studs, red window title bars, bigger HP and MP orbs, and your map coordinates under the minimap. Uses the 8-BIT MMO layout (unit frame, party frames, START menu over the map).
- **Gem loot and the GEM CUTTER**: battles drop socket gems (2% per foe, 10% elites, 35% bosses; tier from the foe's level). MERCHANT > GEM CUTTER sells tier 1-3 gems of every type and cuts three of a tier into one of the next.
- **Minimap**: click it to switch between a close and a wide view; double-click opens the world map.
- **HIGH CONTRAST palette** (white, yellow, blue, black) for colour-blind players.
- **Guild conquest** (MAIN MENU > CONQUEST, needs a guild): every wild region has a **boonstone** held by an AI guild. CHALLENGE it (two waves of defenders, then the STONE WARDEN) to claim it for your guild: +10% XP and gold from foes in that region and a daily tax. AI guilds counterattack your stones every 30 minutes; DEFEND within 20 minutes or lose them. With 3 stones your guild can **besiege ARDENHOLD KEEP** (GATE, COURTYARD, CASTLE LORD) for a realm-wide castle buff (+5% damage, +5% resist all, +10% XP), a bigger daily tax and the CASTLE LORD title; AI sieges come every 2 hours. Taxes build up for up to 7 days.
- **Throne-style world systems** (`src/tnl_systems.js`), new MAIN MENU entries MASTERY, AMITOI and MORPH:
  - **Weapon mastery**: nine weapon families level 1-30 from battles won with them equipped; each level adds that family's bonuses while wielded, with bigger ADEPT, EXPERT and MASTER specialization steps at 10, 20 and 30.
  - **Amitoi expeditions**: send small companion spirits on real-time trips (15 min, 1 h, 4 h) to zones you have visited for gold, materials and sometimes gear; they level 1-10, and you can adopt up to four. A toast tells you when one is back.
  - **Day and night**: at night (game clock) foes are 15% tougher and give 25% more XP and gold, NOCTURNAL elites appear, the screen darkens, and the HUD shows a sun or moon.
  - **Morph**: WOLF FORM (level 5) runs like a fast mount; SWIM FORM (level 10) crosses water.
- **NPC AI engine** (`src/npc_ai.js`): townsfolk and service NPCs now live in town. Each has a stable personality, a home tile and a leash (service NPCs stay within a tile of their counter; fixtures like boards never move). A utility AI picks WORK, WANDER, SOCIALIZE, GREET, SHELTER, SLEEP, RETURN or IDLE from the game clock (dawn, day, evening, night), rain and how near the hero is. NPCs turn to face you, greet you by name, remember how often you have talked (stranger, regular, old friend), react to high-level heroes and some classes, and walk with proper facing frames.
- **Necromancer army of the dead** (up to 9): skeletal warriors, skeletal mages and a golem rise at the start of every battle (2 at level 1, 9 by level 28; a necromancer support job raises 3). MAIN MENU > BOOK OF DEAD picks a variant per type (warriors SKIRMISHER/DEFENDER/REAPER, mages SHADOW/COLD/BONE, golem BONE/BLOOD/IRON) or SACRIFICES the type for crit, damage or HP and resist. RAISE DEAD (once per battle) brings the fallen back. The army stands in ranks between your party and the foes.
- **WoW-style windows** (8-BIT MMO theme): full-screen pages get a title bar with the page name, gold and a close button. The CHARACTER page is now a paper doll: 7 slot icons down each side and stats in the middle (the old slot list overlapped).
- **Handheld-style menus** (8-BIT MMO theme): the START menu is now a right-hand list over the map with 7 roomy rows, a triangle cursor, a hero card (portrait, level, HP, gold) and a one-line help box; every pop-up choice list uses the same rows and cursor.
- **8-BIT MMO UI theme** (new default; SETTINGS > UI THEME cycles 8-BIT MMO, CLASSIC, SANCTUM, DIABLO IV): handheld-RPG panels with a rounded double border; a unit frame top left (portrait, level, HP, MP, XP) with party frames under it; a square minimap top right with a SAFE/PVE/PVP/INST tag; a bottom hotbar (four combat arts and potions) between a red HP orb and a blue MP orb; zone banners and toasts moved to the middle of the screen; on-screen chat trimmed to two lines.
- **PIXEL PACKS art mode** (SETTINGS > ART: CLASSIC, NES, PIXEL PACKS; PIXEL PACKS is the new default): six pixel-art packs redraw world objects and town buildings in every biome, the dungeon theme, 18 townsfolk roles, a third of the monsters in matching families, and every gear tier icon (weapons, shields, armour, helmets, boots, rings, gems, wands, keys, coins, books, potions). See [docs/ART_PACKS.md](docs/ART_PACKS.md).
- **Asset packs**: two reference sheets are sliced into 686 sprites (`assets_pack/`, `tools/slice_assetpack.py`), installed as `assets/ap_*` and `assets/au_*` and in the 64-bit atlases. In game: **SETTINGS > BATTLE BG** now cycles CLEAN, PAINTED and **SCENES** (painted city, wilderness, dungeon and boss-fight backdrops); potions, food, scrolls, books, keys and coins use the new item icons; the gem socket forge shows gem icons.
- **More pack art in game**: item cells have an ornate border tinted by rarity; about half of each beast, humanoid, undead, dragon, fiend, ooze and golem subtype (172 of 700 bestiary entries, plus some dragon and fiend bosses) use the pack's monster art; talking to a townsperson shows a face portrait beside the dialogue box (stable per NPC).
- **Jobs and races** (MAIN MENU > JOBS): 11 new jobs (RONIN, SHINOBI, BLADEDANCER, WYRMLANCER, CORSAIR, BEASTCALLER, PUPPETEER, DREADKNIGHT, VOIDHUNTER, SCALESAGE, STORMCALLER) with job abilities; per-job levels with job change in town; a support job at half level from level 18; 6 new races (HORNFOLK, FELINAR, PIPKIN, LUNARI, WOLFKIN, STARKIN); monster jobs (HEXER, GUARDIAN, ARCHER, BRUTE, MENDER). The creation screen now shows classes 9 per row and scrolls the race list. See [docs/JOBS_AND_RACES.md](docs/JOBS_AND_RACES.md).
- **Realm audit log** (`audit.log`): a hash-chained, append-only record of sign-ins (including failures and throttling), registrations, password changes, staff actions, denied staff access, cloud saves and marketplace trades. Each entry records the account, IP, outcome and request ID. The control plane's **Audit log** tab can filter, verify and export it.
- **Realm debug log** (`debug.log`): a leveled server log that records every 500 with its stack trace, slow requests and storage failures. Every request is logged at `debug`. Every response carries `X-Request-Id`. Root and admin can view it, search it and change its level in the new **Debug log** tab.
- See [backend/README.md](backend/README.md#audit-and-debug-logs).
- **Heirlooms** (MENU > HEIRLOOMS): **LANTERNBORN HEIRLOOMS**, a set that belongs to the account rather than one hero. The jewellery, trinkets and merchant purchase are described below.
  - **Who can use it:** once a piece is bought, every hero in every save slot can summon and equip it from level 1. **SUMMON FULL SET** equips all pieces and moves replaced gear to the bag.
  - **Scaling:** item level follows the wearer's level from 1 to 720. Heirlooms are +1 at level 1, rising to +3 by level 481. Their stats stay below epic drops of the same level.
  - **Class fit:** the chest matches the hero's heaviest armour (plate, mail, jerkin or robe). The weapon comes in six styles (blade, mace, staff, bow, dagger, knuckles); each class gets a suggested style, and the style can be changed at any time.
  - **Set bonus:** 2 pieces give +10% XP; 4 add +10% XP, resistance and level-scaled HP; 6 add damage and healing; 9 add XP, gold find, magic find and crit. The amulet and cloak each add a fixed +5% XP.
  - **Soulbound:** heirlooms can't be listed on the auction house, traded or salvaged, and they sell for 0 G. Each hero holds one copy of each piece, and a lost or returned piece can be summoned again.
  - **Storage:** the collection is kept in this browser's storage, so it is shared by every save slot on the device.

- **Earrings slot and two trinket slots** (paper doll: the column beside the portrait). New earring bases (earrings, ear cuff, drop earrings) and eight trinket types drop as loot. Each trinket gives its wearer a buff when a battle starts, lasting longer at rare and legendary; the effect is logged in combat chat.
- **Heirloom jewellery, trinkets and vendor:** LANTERNBORN HEIRLOOMS grows to 14 pieces with two rings, earrings and two trinkets (war horn and lucky coin), plus 12- and 14-piece set bonuses.
  - **Buying:** pieces are bought once per account at any merchant (**MERCHANT > HEIRLOOMS**): 750 G to 2,500 G each, or 17,400 G for the whole set. Every hero on the account can then summon them for free.
  - **Existing collections:** the nine pieces unlocked by the first heirloom release stay unlocked.
  - **Bonus cap:** the built-in save, initiative and accuracy bonuses of all heirloom pieces combined are capped at +1 to +3, rising with level.

- **Challenges** (MENU > CHALLENGES): daily and weekly **bounty board**, **weekly vault** (choose 1 of up to 3 items, unlocked by 1/4/8 dungeon clears), **login streak** (7-day reward cycle) and a quarterly **season pass** (50 tiers, season titles, legendary trinket at tier 50). Progress is counted from the hero's existing statistics.
- **Keystones** (CHALLENGES > KEYSTONES): Mythic+-style timed dungeon runs.
  - **Scaling and affixes:** foes gain +8% HP and damage per key level, plus the week's affixes.
  - **Timer:** shown in the field's top-left corner.
  - **Results:** a timed run upgrades the key by +1 to +3 and earns a bonus chest. A late, failed or abandoned run drops the key a level.
  - **Rotation:** the key moves to a new dungeon after every run.
- **Rested XP** from time away and long rests doubles XP until spent; a **wardrobe** (MENU > WARDROBE) collects appearances for transmog; **gear score** is shown on the paper doll.

- **WoW-style chat:**
  - **Layout:** the panel is docked bottom-left above the action bar, see-through, with WoW-shaped tabs.
  - **Tabs:** GENERAL, COMBAT LOG, LOOT, WHISPERS, WORLD and GUILD by default. You can add, rename and delete tabs and choose each tab's channels; the active tab is remembered.
  - **Channel switches:** world chat (1. General), Trade, Local Defense, LFG, joined channels, adventurer chatter, or all chat. A muted channel is neither shown nor sendable.
  - **Where to set them:** **SETTINGS > CHAT SETTINGS** (in game), the panel's ⚙ menu, `/chatoff`, `/chaton`, `/leave 1-4` and `/join general`.

- **Admin account from your own account:**
  - **In game:** on a realm with no admin, **ONLINE > ACCOUNT > CLAIM REALM ADMIN** makes your account root. This only works from the server's own computer, never through a proxy, and only once.
  - **Command line:** `npm run admin -- create|promote|demote|list` manages staff accounts while the server is stopped.
  - **Developer mode:** root and admin accounts get it automatically. The account screen shows your role and an **ADMIN CONTROL** entry.

- **Durability and repair:** gear wears in battle and on death, broken gear gives no stats, REPAIR ALL at merchants and repair kits. **Crafting quality** rolls Standard, Fine, Superior or Masterwork (up to +35%) by skill.
- **Guild progression:** guild XP and 25 levels, 11 perks, a shared guild bank (3 tabs plus a gold vault), weekly guild quests and a guild log.
- **World quests:** 4 daily quests near your level, a daily rare elite per zone with epic loot, and 4-hour zone invasions with a chest for 15 invader kills.
- **Loadouts:** dual specialization (level 10, 500 G), 5 saved equipment sets and pinned action-bar order per spec.

- **New NPC art:** 43 role-specific townsfolk sprites (tools/gen_npcs.py).
  - **Variety:** each role has its own outfit, headwear, facial hair and held prop: merchant, banker, innkeeper, guards, smiths, oracle, harbormaster, chef, miner, enchanter, every profession trainer, and townsfolk.
  - **Animation:** walk frames in three directions and an idle blink.
  - **Realm Stone:** now a glowing crystal.
  - **Matching:** every service NPC and trainer uses its role sprite in the pixel field and in 64-bit mode.

### Fixed
- Server errors were returned as "Server error." without being logged anywhere.
- A request body of `null`, an array or a bare value crashed routes with a 500; it now returns 400.
- A failed write of `realm.json` threw inside a timer and could stop the server; it is now logged and retried.
- The in-game GM console's **AUDIT LOG** showed the oldest of the last 100 entries instead of the newest.

## 2.1.1 — B2026.11.01

### Added
- **Debug panel** (F9, SETTINGS > DEBUG PANEL, or `#debug`), with:
  - live state, pause and frame stepping, game speed
  - god mode, levels, gold, loot, warp, reveal map, waypoints
  - no encounters, collision view, time of day
  - battle win/lose, mode toggles, state copy, self-check, error log
- **Automated sweep** (`tests/sweep.py`, `npm run sweep`): plays every class, zone, menu, service, instance, render mode, save slot and audio engine, plus random-input monkey runs, with state and screen-text invariants. See [docs/DEBUGGING.md](docs/DEBUGGING.md).

### Fixed
- Holding a direction into a door or NPC kept re-opening its menu.
- The standalone HTML files had no viewport meta, so on phones the full-screen build's touch pad sat off-screen.
- Instances whose definition had no `lvl` spawned `NaN`-stat monsters.

### Performance
- 64-bit video frame time is down from about 13 ms to about 4 ms.

## 2.1.0 — B2026.11.01

### Added
- **Atlas of Valendria** (`dist/atlas.html`): an interactive SVG map over the painted world map, with:
  - 90 zones, 101 roads and 42 sea lanes
  - dungeon, raid, boss and waypoint icons
  - search, layer toggles and a level-band filter
  - details for every zone: roads, instances, bosses and mechanics, side quests, herbs, story chapters
  - a route planner
  - phone layout
- The atlas is **embedded in the game**: the ATLAS button or the M key opens it, with a "you are here" marker, visited and unknown zones, and SHOW ON GAME MAP.
- **Roads and sea lanes on the in-game world map**: gold once both ends are visited.
- **Full-screen window build** (`dist/gbquest-fullscreen.html`): aspect-locked LCD, 1:1 pixel scaling, full-screen toggle (F), overlay touch pad, overlay chat (C).
- **64-bit audio engine** (`src/audio64.js`):
  - stereo, reverb, echo and compressor
  - 13 synthesized instruments and a 7-piece drum kit
  - all 24 tracks re-arranged with A/B sections
  - every SFX upgraded, 36 hand-layered versions, 8 new 64-bit-only sounds
- **64-bit video mode** (`src/video64.js`): Scale4x smoothing at 640×576, full colour, a day/night cycle, dynamic lights, bloom, vignette and camera pulses.
- **Engine systems**: `Events` bus, `Tween` with easing, `Cam`, game `Clock`, `Profiler` overlay (F3).
- **64-bit asset atlases** (`assets_hd64/`, `tools/gen_hd64.py`): 2,236 sprites at 4× with smoothing, light ramp, rim light and outline.
- **Documentation**:
  - GDD, architecture, UML (11 diagrams), audio, graphics, multiplayer, build and controls docs
  - generated story, character, content and world references (`tools/gen_docs.cjs`)
  - CONTRIBUTING and this changelog

### Changed
- The framebuffer is now off-screen, and `present()` shows it on the LCD, which makes post-processing possible.
- The settings list scrolls. Left and right change values without moving the cursor.
- The sound test shows the active engine and switches it with START.

## 2.0.0 — B2026.11.01
- 5e-style rules with original lore; 9 species, 12 classes and 24 subclasses; levels 1–720
- 90 zones, 400 creatures, 350 bosses, 22 dungeons, 9 raids, 6 trials, a 100-floor tower, 5 expansions, 9 difficulty tiers
- 12 acts and 50 chapters, side quests, professions, auction house, guilds, reputation, arena, achievements
- 1-, 4- and 12-player modes, live presence and chat, built-in host server, realm leaderboard
- GBC colour, 103 SFX and 24 tracks, Game Boy pixel tiles, the VALENDRIA world map, the NES-style art pack

## 1.0.0
- The original single-file Game Boy RPG (kept in `legacy/`).

- **Paper-doll gear preview:** equipped head, neck, cloak, chest, hands, weapon, shield, waist, legs, feet, artifact and relic appearances now add small icon markers over the central portrait. Markers use the existing item-icon/transmog resolver; gameplay item stats and slot selection are unchanged. Pure slot-selection tests added.

- **World avatar equipment indicators:** world-map character portraits composite small head, main-hand, chest and off-hand icons through the existing transmog-aware item icon resolver. This is a compact visual indicator, not full-body animated equipment rendering.

- **Animated world equipment overlays:** player and follower walkers composite head, main-hand, chest and off-hand item icons over directional two-frame walking sprites, following the current movement animation frame and retaining left/right mirroring and ghost palette handling. HD64 full-body PNG layer loading remains separate and not yet integrated.

- **World HD frame presenter:** connected asynchronous HD idle/walk frame preparation to player and follower world rendering, with stale-result protection, request deduplication, pixel-crisp 24×24 output and classic-renderer fallback. Requires deployed `assets_hd64/` assets; ghost and combat-specific animation states remain on the classic path.
 Per-character async presenter caches prevent player/follower frame requests from invalidating one another.

- **HD frame cache:** Added a bounded per-character LRU cache for prepared animation frames, reusing prior frames on animation loops and deduplicating in-flight work.

- **Battle HD animation integration:** Connected party battle sprites to HD attack, cast, hit, death and idle frames with timed action poses and classic-sprite fallback.

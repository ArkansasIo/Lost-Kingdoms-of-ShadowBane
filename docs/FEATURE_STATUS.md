# Feature status

What is in the game today, what is still missing, and the trade-offs of building each missing piece. Last updated on the `feature/realm-guilds-groupfinder-sql-atlas` branch (November 2026).

## In the game

| Area | What exists |
|---|---|
| Core | 160×144 browser engine, 64-bit video mode, chip and 64-bit audio, desktop build, debug panel, bug sweep and 166 tests |
| Rules | d20 / 5e-style attributes, saves, proficiency, 16 classes with subclasses, species, backgrounds, feats, levels 1-720 with paragon |
| Combat | turn-based and realtime modes, 36 combat arts (physical and casting), tier powers, companions with stances, clean battle scenes |
| World | Valendria (base game + expansions 1-5) and 8 expansion worlds with their own maps: 154 zones, dungeons, raids, tower, trials, world bosses, weather and waypoints |
| Creatures | 400 bestiary creatures, plus 300 evolution-line creatures across the 14 creature types |
| Gear | 12 equipment slots, rarity 1-9, 23 gear tiers, 4 armour classes with sets, 14 weapon subclasses, named items, loot tables, stash |
| Economy | 18 professions with perk trees, 90 raw materials, 207 tiered blueprints, trainers in every settlement, curator, auction house, direct trade |
| Social / online | offline, page room and realm server modes, accounts, cloud saves, chat, PvP, leaderboard; **realm guilds** with ranks and a shared server-side guild bank; a **group finder** that matches real players by role with ready checks ([SERVER](SERVER.md)) |
| Collection | 120 mounts, pets, titles, achievements, reputation, housing |
| UI | SANCTUM dark UI with life/resource orbs, atlas with a world switcher for all 9 maps, expansion maps, character creator |
| Accessibility | remappable keys (SETTINGS > KEY BINDINGS), HIGH CONTRAST colour-blind-safe palette, text speed, brightness and contrast |
| Data | MySQL / MariaDB schema and seed data for every catalogue, plus realm tables and a realm.json migration ([DATABASE](DATABASE.md)) |

## Not built yet

| Feature | Pros | Cons |
|---|---|---|
| **Story cinematics** (prologue and campaign) | Gives the campaign weight; reuses the portraits and maps | Script writing per chapter; small screen limits how much fits |
| **Realm server on MySQL** (the schema exists; the server still writes realm.json) | Scales past one process; real queries and backups | Async storage layer for every route; deployment needs a database |
| **Class and subclass redesign** (more SRD-style subclasses) | Build variety; matches 5e expectations | Big balance surface; needs new spells and features per subclass |
| **Higher-detail item and monster art** | The biggest visual upgrade, since the NES art is the weakest asset | Large volume (1,000+ sprites); quality varies when generated procedurally |
| **Server-authoritative trading and combat** | Stops cheating in shared realms | Rewrites trust-on-client systems; more server code to host |
| **Guild halls and guild raids** (realm guilds and banks are built) | Long-term social glue | Hall maps and raid lockouts need shared server state |
| **Group finder into the instance** (players are matched; they still start the dungeon as a party by hand) | One click from queue to dungeon | Needs the host-server battle flow to start an instance for a matched group |
| **Seasonal content and battle pass** | Reasons to return; endgame loop | Ongoing content cost; must avoid pay-to-win |
| **Voice and music per expansion** | Each world feels distinct | 32+ new tracks to compose and store |
| **Localization** (other languages) | Reaches more players | Every string needs extracting; the 6×9 font is ASCII only |
| **Text scaling** (key bindings and a high-contrast palette exist) | More players can read the game | Hard on a fixed 160×144 screen |

**Legal note:** before any public or commercial release, check the "Shadowbane" trademark and keep the SRD 5.2 attribution in the credits.

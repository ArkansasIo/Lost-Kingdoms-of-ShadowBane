# Database: MySQL schema and seed data

The game's catalogues (classes, spells, items, zones, creatures, bosses, story and more) can be loaded into MySQL 8.0+ or MariaDB 10.6+ for a realm server, admin tools or analytics. The files are generated from the browser game's own data, which stays the source of truth.

```sh
npm run sql                       # writes data/sql/schema.sql and data/sql/seed.sql
mysql -u root -p -e "CREATE DATABASE gbquest CHARACTER SET utf8mb4"
mysql -u root -p gbquest < data/sql/schema.sql
mysql -u root -p gbquest < data/sql/seed.sql
```

`tools/export_sql.cjs` reads `src/data_rules.js`, `jobs_data.js`, `data_world.js`, `gen.js` and `creatures.js` directly in Node (no browser or build needed). Re-run it after changing game data and commit the two files with the change; never edit them by hand.

## Catalogue tables

Every catalogue table has the same core columns:

| Column | Meaning |
|---|---|
| `id` | the game's string id, as saves and the server use it (primary key) |
| `num` | a 1-based number in catalogue order; stable while catalogues only grow at the end |
| `name` | the display name |
| `data` | the full record as JSON, so nothing the game knows is lost |

Typed columns are added where they are worth filtering on, with foreign keys where the game links records:

| Table | Rows | Extra columns |
|---|---|---|
| `classes` | 27 | `hit_die`, `primary_ability`, `role`, `caster` |
| `species`, `backgrounds`, `skills`, `feats` | 15, 6, 18, 6 | `gold` (backgrounds), `ability` (skills) |
| `spells` | 74 | `school`, `spell_level`, `damage_type` |
| `weapons`, `armors`, `wondrous_items`, `items` | 17, 11, 102, 37 | damage, armour class, slot, type, price, cost |
| `rarities`, `substats` | 6, 21 | `color`; `unit`, `max_value` |
| `biomes`, `expansions`, `regions`, `zones` | 9, 13, 52, 154 | level ranges; `regions.biome_id`, `zones.region_id`, `zones.biome_id` |
| `dungeons`, `raids`, `trials` | 38, 17, 6 | `zone_id`, `level` |
| `creature_families`, `creatures`, `bosses` | 14, 700, 350 | `creatures.family_id`, `combat_role`, `creature_rank`; `bosses.category`, `level`, `family_id` |
| `factions`, `achievements`, `recipes` | 5, 38, 14 | `description`; `profession`, `skill`, `makes` |
| `acts`, `chapters` | 12, 50 | `acts.zone_id`, `chapters.act_id`, `goal` |

`schema_info` holds the schema version and the game version the seed came from.

```sql
-- every boss of level 100+ in the undead family, with its zone
SELECT b.num, b.name, b.level, JSON_VALUE(b.data, '$.where') AS zone
FROM bosses b WHERE b.family_id = 'undead' AND b.level >= 100 ORDER BY b.level;
```

## Realm tables

`schema.sql` also creates the tables a database-backed realm server would use, mirroring what `backend/server.cjs` keeps in `server/data/realm.json` today: `accounts`, `characters` (cloud save slots), `friendships`, `guilds`, `guild_members`, `guild_bank_items`, `market_listings` and `leaderboard`. The realm server still runs on `realm.json`; these tables are the target for a move to MySQL.

To copy a running realm into them:

```sh
npm run sql -- --realm server/data/realm.json   # also writes data/sql/realm.sql
mysql -u root -p gbquest < data/sql/realm.sql
```

`realm.sql` contains the accounts' scrypt password hashes. Treat it like `realm.json`: it is git-ignored and must not be shared. Rows that point at deleted accounts are left out. Sessions and invite codes are not exported; players sign in again.

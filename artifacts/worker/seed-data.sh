#!/bin/bash
# Seeds reference data for the 10 new features into D1 (idempotent — uses INSERT OR IGNORE).
set -e
cd "$(dirname "$0")"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:?}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?}"
DB="bigbull-rns-db"

exec_sql() {
  echo "==> $1" | head -c 200
  echo ""
  npx wrangler d1 execute "$DB" --command "$1" --remote
}

# Sensitivity presets: device class × gyroscope. values_json holds full sensitivity map.
exec_sql "INSERT OR IGNORE INTO ff_sensitivity_presets (id, label, ram_gb, gyroscope_on, values_json) VALUES
 ('ram2-gyro-off','2GB · No Gyroscope','2',0,'{\"general\":55,\"red_dot\":48,\"scope_2x\":38,\"scope_4x\":32,\"awm\":22,\"free_look\":60}'),
 ('ram2-gyro-on','2GB · Gyroscope ON','2',1,'{\"general\":75,\"red_dot\":70,\"scope_2x\":60,\"scope_4x\":50,\"awm\":35,\"free_look\":80}'),
 ('ram3-gyro-off','3GB · No Gyroscope','3',0,'{\"general\":58,\"red_dot\":52,\"scope_2x\":42,\"scope_4x\":35,\"awm\":25,\"free_look\":63}'),
 ('ram3-gyro-on','3GB · Gyroscope ON','3',1,'{\"general\":80,\"red_dot\":75,\"scope_2x\":65,\"scope_4x\":55,\"awm\":38,\"free_look\":85}'),
 ('ram4-gyro-off','4GB · No Gyroscope','4',0,'{\"general\":62,\"red_dot\":56,\"scope_2x\":46,\"scope_4x\":38,\"awm\":28,\"free_look\":66}'),
 ('ram4-gyro-on','4GB · Gyroscope ON','4',1,'{\"general\":85,\"red_dot\":80,\"scope_2x\":70,\"scope_4x\":60,\"awm\":42,\"free_look\":90}'),
 ('ram6-gyro-off','6GB · No Gyroscope','6',0,'{\"general\":68,\"red_dot\":62,\"scope_2x\":52,\"scope_4x\":44,\"awm\":32,\"free_look\":70}'),
 ('ram6-gyro-on','6GB · Gyroscope ON','6',1,'{\"general\":92,\"red_dot\":88,\"scope_2x\":78,\"scope_4x\":68,\"awm\":48,\"free_look\":95}'),
 ('ram8-gyro-off','8GB+ · No Gyroscope','8',0,'{\"general\":72,\"red_dot\":66,\"scope_2x\":56,\"scope_4x\":48,\"awm\":36,\"free_look\":74}'),
 ('ram8-gyro-on','8GB+ · Gyroscope ON','8',1,'{\"general\":98,\"red_dot\":95,\"scope_2x\":85,\"scope_4x\":75,\"awm\":52,\"free_look\":100}')";

exec_sql "INSERT OR IGNORE INTO ff_headshot_tips (id, tier_min, tier_max, tier_label, tips_json) VALUES
 (1,0,24,'Rookie','{\"rating\":\"Building your foundation\",\"tips\":[\"Play Deathmatch 20 min daily for aim\",\"Keep sensitivity between 45-65 (no gyro)\",\"Use 3-finger claw when comfortable\",\"Focus on chest-level crosshair placement first\"]}'),
 (2,25,44,'Casual','{\"rating\":\"Consistent fighter\",\"tips\":[\"Add gyroscope for spray control (+15 headshot % over time)\",\"Pre-aim doorways and common angles\",\"Drag headshot at close range, tap at mid range\"]}'),
 (3,45,64,'Competitive','{\"rating\":\"Solid marksman\",\"tips\":[\"Sensitivity fine-tune: adjust only ±3 points weekly\",\"Learn flick + drag combos per weapon\",\"Record your gameplay and review deaths\"]}'),
 (4,65,79,'Pro','{\"rating\":\"Advanced shooter\",\"tips\":[\"Device-specific RAM preset from Sensitivity Finder\",\"Master peek + one-tap headshot\",\"Keep K/D training in Clash Squad ranked\"]}'),
 (5,80,89,'Elite','{\"rating\":\"Top-tier player\",\"tips\":[\"Muscle memory is built — avoid changing sensitivity\",\"Practice quick-scoping AWM/M82B\",\"Warm up 10 min before ranked pushes\"]}'),
 (6,90,99,'Legend','{\"rating\":\"Headshot machine\",\"tips\":[\"Only tweak free-look, leave combat values alone\",\"Mentor others — consistency is your edge\",\"Stream or post clips to analyze further\"]}')";

exec_sql "INSERT OR IGNORE INTO ff_news (id, title, body, tag, source_url, published_at, posted_at) VALUES
 (1,'Free Fire OB Update — New Balance Changes','The latest OB patch adjusts weapon recoil, fixes emote glitches, and introduces a new ranked season reward track. Check the official Garena patch notes for full details.','Patch Notes','https://ff.garena.com',datetime('now','-2 days'),datetime('now','-2 days')),
 (2,'Diamond Royale: New Bundle Alert','A limited-time bundle just landed in Diamond Royale — grab it before the rotation ends this weekend.','Events','https://ff.garena.com',datetime('now','-4 days'),datetime('now','-4 days')),
 (3,'Ranked Season Reset — Rank Up Tips','New season means rank reset. Push your rank early in the week when queues are faster; play CS for safe rank points.','Ranked','https://ff.garena.com',datetime('now','-6 days'),datetime('now','-6 days')),
 (4,'Weekly Event: Login Rewards','Log in daily this week for free gold, evolution weapon shards, and character fragments.','Events','https://ff.garena.com',datetime('now','-8 days'),datetime('now','-8 days')),
 (5,'RNS BIGBULL VIP Hub Milestone','VIP Hub passed a new member milestone — thank you to all lifetime VIP members for the support!','Community','',datetime('now'),datetime('now'))";

exec_sql "INSERT OR IGNORE INTO ff_uid_cache (uid, name, level, region, fetched_at) VALUES ('0','__placeholder__','0','','1970-01-01T00:00:00Z')";

exec_sql "INSERT OR IGNORE INTO bio_templates (id, category, text) VALUES
 (1,'gamer','🎮 Gamer by blood | Free Fire addict 🔥 | Level grinder 💪 | Headshot machine 🎯'),
 (2,'gamer','⚔️ Born to win | FF squad leader 🏆 | Booyah is my middle name'),
 (3,'gamer','🕹️ Controls = passion, Headshots = profession | FF since day one'),
 (4,'gamer','🔥 Rusher from birth | One tap = one kill | Rank: Grandmaster ⚡'),
 (5,'gamer','💥 Gaming mode: ALWAYS ON | FF family > everything'),
 (6,'attitude','😎 Attitude is not a crime | Walk alone if you have to | Wolf vibes 🐺'),
 (7,'attitude','👑 King of my own world | Don''t need permission to shine'),
 (8,'attitude','🦁 I don''t compete, I dominate | Silence is my loudest reply'),
 (9,'attitude','⚡ Rules? I make them | Respect is earned, not given'),
 (10,'attitude','😤 Made from struggle, not comfort | Watch me win'),
 (11,'sad','💔 Smiling outside, broken inside | Sometimes silence speaks'),
 (12,'sad','🌧️ Lost in my own thoughts | Trying to stay strong'),
 (13,'sad','🥀 Not okay, but pretending | Time heals, slowly'),
 (14,'sad','🌑 Tired of explaining myself | Some battles are fought alone'),
 (15,'sad','🖤 Heart full of memories, eyes full of stories'),
 (16,'love','❤️ Loving someone who feels like home | Forever kind 🌸'),
 (17,'love','💫 You are my favorite notification | Love > everything'),
 (18,'love','🌹 Heart belongs to one | Romantic soul with gamer fingers'),
 (19,'love','✨ Together is my favorite place to be | Love in every line'),
 (20,'love','💕 Smiling because of you | My person, my peace'),
 (21,'funny','😂 Professional overthinker | Part-time legend | Full-time meme'),
 (22,'funny','🍕 Will work for pizza | Loading... 99% personality not found'),
 (23,'funny','🤪 Officially ridiculous | Certified drama queen/king'),
 (24,'funny','😜 I''m not lazy, I''m on energy saving mode')";

exec_sql "INSERT OR IGNORE INTO vip_guide_cards (tool_id, title, steps_json, tips_json) VALUES
 ('ffallinone','FF All-in-One Tool','[\"Tap the FF All-in-One card in VIP Hub\",\"Enter your Free Fire UID on the partner site\",\"Choose the service you want (likes, level, etc.)\",\"Confirm and wait for processing\"]','[\"Your UID must be correct — check it in-game\",\"Processing can take a few minutes during peak hours\",\"If it fails, try again after 10 minutes\"]'),
 ('bio','Bio Tool','[\"Open the Bio Tool from the main dashboard\",\"Pick a template or write your own bio\",\"Tap Preview to see how it looks\",\"Tap Copy and paste it into Instagram/WhatsApp\"]','[\"Keep your bio under 150 characters for Instagram\",\"Gamer templates are ready to use with one tap\"]'),
 ('ffbind','FF UID Binding','[\"Open FF Bind from VIP Hub\",\"Enter your Free Fire UID\",\"Confirm the binding on the partner site\",\"Wait for the success message\"]','[\"Bind once — it stays linked to your UID\",\"Use your in-game UID, not IGN\"]'),
 ('ffemote','FF Emotes','[\"Choose an emote from the VIP Hub list\",\"Enter your UID when prompted\",\"Confirm on the partner site\",\"Emote arrives in your game vault\"]','[\"Not all emotes are available every day — check back\",\"Vault space is limited in-game\"]'),
 ('fflikes','FF Likes','[\"Open FF Likes from VIP Hub\",\"Enter your UID and post link if asked\",\"Choose like count\",\"Confirm and wait\"]','[\"Likes arrive gradually — normal and safe\",\"Do not spam the request button\"]'),
 ('gift','FF Gift Tool','[\"Open the Gift tool in VIP Hub\",\"Enter your UID\",\"Select the gift option\",\"Confirm on the partner page\"]','[\"Gifts depend on partner availability\",\"Check the tool status is Online first\"]'),
 ('glory','FF Glory','[\"Open Glory from VIP Hub\",\"Sign in on the partner portal if asked\",\"Follow the on-screen steps\",\"Collect your result in-game\"]','[\"Use the same device you play on\",\"Keep your session active until done\"]'),
 ('reseller','Reseller Panel','[\"Open Reseller from VIP Hub\",\"Log in with your reseller credentials\",\"Place orders from the dashboard\",\"Track status under History\"]','[\"Balance is managed by the panel admin\",\"Orders process in queue order\"])';

echo "SEED COMPLETE"

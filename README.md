# Live CFB Scores — Stream Deck Plugin

![Live CFB Scores in action](assets/LiveCFBScoresThumbnail.png)

A Stream Deck plugin that shows live college football scores directly on your keys. Two actions: **Live CFB Scores** tracks one FBS team per key, and **Live CFB Scoreboard** fills your keys with this week's Top 25, a conference, or all of FBS. Keys update automatically every 30 seconds.

![Live CFB Scores Plugin](https://img.shields.io/badge/Stream%20Deck-Plugin-blue) ![Version](https://img.shields.io/badge/version-1.1.0-green) [![Elgato Marketplace](https://img.shields.io/badge/Elgato-Marketplace-black)](https://marketplace.elgato.com/product/live-cfb-scores-62e13b96-083e-4ed7-9cc6-78560a6f648c)

---

## Features

- **Live scores** — shows away score, home score, quarter, and game clock while a game is in progress
- **Possession indicator** — the team with the ball is shown in brown, turning orange if they're in the red zone
- **Two-minute timeout** — the clock turns red during the final 2:00 of the 2nd and 4th quarters
- **Top 25 rankings** — ranked teams show a small rank before their abbreviation, like ESPN's scoreboard (turn it off with "Show Top 25 rankings" in the settings panel)
- **Pre-game** — shows the matchup (e.g. `MRSH @ UGA`) and scheduled kickoff day/time ("TBD" until the network sets it)
- **Final scores** — shows the final score with a "Final" label, including OT/2OT labeling for overtime games
- **Score-change flash** — when a team scores, the key blinks in that team's primary color, then shows a short card with the team and the play (e.g. KC / TD +6, then XP +1 when the kick is good)
- **End-of-game fireworks** — a short celebratory animation in the winning team's colors plays when the game ends
- **Gamecast shortcut** — press any key to open that game directly in ESPN Gamecast (the box score once the game is final), or a custom link of your choice (e.g. your regional sports network) once the game actually starts
- **Off-week shortcut** — if your team has no game scheduled, pressing the key opens that team's full schedule on ESPN instead
- **No-flicker updates** — keys only redraw when the display actually changes
- **Multi-key support** — add as many team keys as you want, each refreshes independently
- **Custom background color** — set a per-key background color and opacity in the settings panel, handy for telling teams apart at a glance across multiple keys
- **Live CFB Scoreboard action** — a second action that lays out the week: pick the Top 25, any FBS conference, or all of FBS, and each key becomes one game, in kickoff order or by ranking. Different pages can show different boards (SEC on one, Big Ten on another), and each board can have its own background color
- **All 136 FBS teams** across all 11 conferences (SEC, Big Ten, ACC, Big 12, American, Mountain West, Conference USA, MAC, Sun Belt, Pac-12, and Independents)

---

## Recent Updates

**v1.1.0.0**
- New: **Live CFB Scoreboard** action — drag it onto as many keys as you like and they fill with this week's games, one game per key. Pick what each board shows: the **Top 25**, any **FBS conference** (ACC, American, Big 12, Big Ten, Conference USA, MAC, Mountain West, Pac-12, SEC, Sun Belt, FBS Independents), or **All FBS**. The dropdown shows the most keys each one can need
- Each board remembers its own choice, so an SEC page, a Big Ten page and a Top 25 page can all live in one profile. Boards with different settings can share a page, too
- Order by kickoff time or by ranking, fill top-to-bottom or left-to-right, optionally send finals to the end, and give each board its own background color
- Same keys as the team action: possession and red zone, score flash with TD/XP/FG/SAF/2PT cards, fireworks at the final. More games than keys: the last key shows "+N more"; extra keys show "No Game". Both open ESPN's scoreboard for that board. The week moves on Monday at 3:00 AM ET, same as the team keys
- New: **Top 25 rankings** on both actions — a small rank before ranked teams' abbreviations. On by default; turn it off with "Show Top 25 rankings" in the settings panel
- Pregame keys show "TBD" when the network hasn't set the kickoff time yet (instead of a midnight placeholder), on both actions
- Final games now open ESPN's box score instead of Gamecast, on both actions
- Bye weeks now show `BYE WEEK` for the whole off week (Monday 3:00 AM ET to Monday 3:00 AM ET). Before, the key jumped ahead to the next game a week early

**v1.0.18.0**
- Score flash is now 5 solid blinks of the scoring team's color with no text, so it reads at a glance even on light team colors
- New: right after the flash, a 3-second card shows the scoring team and the play — TD +6, FG +3, SAF +2 (TD +7 / TD +8 if the try lands in the same update)
- New: when the extra point or two-point try comes in after a touchdown, a quick 2-second XP +1 / 2PT +2 card shows (no blinks)
- Overtime from the 3rd period on (alternating two-point tries) shows 2PT +2 for each successful try
- Settings help text now says "key" instead of "button"

**v1.0.17.0**
- Pregame key shows just the time on game day ("7:30 PM"); the weekday only appears for games later in the week
- Score lines size up to 18pt to match the other plugins, stepping down only when a line is too wide

**v1.0.16.0**
- Custom Link now stays active through weather/lightning delays instead of dropping back to Gamecast until play resumes
- Fixed a background refresh that could keep running after a key was removed or you switched pages/profiles mid-update
- Settings: "Key Press Opens" default now reads "ESPN Gamecast (free)", matching the other plugins
- Custom Link URLs are also tidied up by the plugin itself (spaces trimmed, https:// added if missing, non-web links ignored) — a backstop for links saved before the settings panel started doing this
- Turned off Node debug mode for release builds

**v1.0.15.0**
- Added a "Custom Link" option to Key Press Opens (matching Live MLB Scores) — enter any URL, such as your regional sports network's live-game page, and the key opens ESPN Gamecast until the game actually starts, then switches to your link. Keeps opening it for 30 minutes after the final whistle for post-game coverage, then reverts to Gamecast. Falls back to Gamecast if the field is left blank.

**v1.0.14.0**
- Fixed every key showing `Err`: ESPN changed its scoreboard API to reject the multi-day `dates=<range>` query this plugin used to pull a team's window in one request — even a single-day range now gets a flat HTTP 400. Rebuilt the same coverage (last week's final, this week, next week) from up to three requests scoped to `week` + `seasontype` instead, the one query shape ESPN still accepts, merged into one event list and cached for 20 seconds so multiple keys share the same fetch instead of multiplying requests.

**v1.0.13.0**
- Code cleanup pass: removed an unused variable in the settings panel and corrected several stale code comments left over from earlier changes (including one that still said the "hold the final" cutoff was Tuesday instead of Monday). No behavior changes.

**v1.0.12.0**
- The search box in settings no longer shows the tracked team's name when you reopen a configured key — it stays empty (ready for a new search) since the "Tracking:" banner below it already shows the current team, and the two were just duplicating each other.
- Fixed the Conference/Team dropdowns sometimes not reflecting the tracked team when reopening a configured key's settings — they could end up synced against the temporary fallback list before ESPN's live list finished loading. They now re-sync once the live list is in.

**v1.0.11.0**
- Team data is now pulled live from ESPN instead of a bundled static list. The settings panel's search/dropdown fetches ESPN's full FBS standings on load for the current list of all 136 teams and conferences (falling back to a bundled list only if that fetch fails), and each key's abbreviation, name, and color now come directly from that game's own live scoreboard data rather than a separate lookup table.

**v1.0.10.0**
- Narrowed the schedule look-back from 10 days to 7 — a new CFB week starts Monday 3am ET, so there's nothing useful further back than the prior week's final, which the hold-final rule already stops showing at that same boundary anyway. Look-ahead stays at 10 days.

**v1.0.9.0**
- Added a custom background color option in the settings panel: toggle it on, pick a color, and adjust its opacity. Useful for telling teams apart at a glance when you've got several keys configured. Off by default — keys keep the original plain black background unless you turn it on. Applies to the normal score display; the score-flash and end-of-game fireworks animations still use their own colors on top of it.

**v1.0.8.0**
- Moved the "hold the final" cutoff from Tuesday to Monday at 3:00 AM ET — so a final score now holds through the whole weekend and Monday morning, instead of getting bumped to next week's preview before you've even sat down at your desk

**v1.0.7.0**
- Final scores now hold through the following Tuesday at 3:00 AM ET instead of getting replaced by next week's matchup the moment it becomes visible in the schedule window
- Added a "BYE WEEK" state — a team with no game in the current window (while other teams do have games) now shows this instead of the generic "No Game"

**v1.0.6.0**
- Keys now refresh every 15 seconds (instead of 30) during the two-minute timeout of the 2nd and 4th quarters, so a score or clock-management play is less likely to be missed between polls. Falls back to the normal 30-second cadence the moment the quarter ends.

**v1.0.5.0**
- Fixed the possession indicator briefly flashing to white during live games — ESPN's possession/red-zone data occasionally goes blank for a single poll (e.g. during an extra point attempt), and the key now holds onto the last known possession for that specific game instead of reading the gap as "nobody has the ball." Halftime is excluded, since the ball genuinely belongs to no one then.

**v1.0.4.0**
- Fixed the live score line's possession color occasionally drifting off-center on real hardware — the abbreviation and score now render as a single centered text element instead of two separately positioned ones, so the device's own renderer handles the centering instead of relying on an estimated glyph-width table

**v1.0.3.0**
- Fixed keys showing "Err" for every team — ESPN started rejecting the plugin's request headers with a 403 page instead of returning score data; requests now use a real browser-style header set (User-Agent, Accept, Accept-Encoding) with matching gzip/brotli response decoding

**v1.0.2.0**
- Replaced the plugin icon with properly sized 256×256 / 512×512 (high-DPI) variants per Elgato's Marketplace icon spec
- Moved the red zone indicator off the clock and onto the possessing team's abbreviation, which now turns orange when they're in the red zone (instead of the clock line changing color)
- Added a two-minute timeout indicator — the clock turns red during the final 2:00 of the 2nd and 4th quarters
- Lightened the possession color from a darker sienna to a more legible tan-brown
- Tuned live/final score line sizing to two fixed sizes (17pt for 2-3 letter abbreviations, 16pt for 4-letter ones) instead of always shrinking dynamically, with an automatic fallback for the handful of especially wide abbreviation/score combinations that would otherwise run too wide for the key
- Fixed a sizing bug where the space between the abbreviation and score was measured as nearly a full letter wide, shrinking the font a point smaller than necessary in most games

**v1.0.1.0**
- Added an off-week shortcut — pressing a key with no game scheduled now opens that team's schedule on ESPN instead of just refreshing
- Rebuilt the settings panel with a search box (type a team or location name for instant results) alongside the existing conference/team browse dropdowns
- Fixed a centering inconsistency in the live score line caused by an inaccurate character-width estimate; text now measures against real Helvetica glyph widths
- Added `flashing` state cleanup on key removal to prevent a rare stuck-flash edge case

**v1.0.0.0**
- Initial release — live scores, possession indicator, red zone highlighting, pre-game/final states, score-change flash, end-of-game fireworks, Gamecast shortcut, and all 136 FBS teams across 11 conferences

---

## Requirements

- [Elgato Stream Deck](https://www.elgato.com/stream-deck) hardware
- [Stream Deck software](https://www.elgato.com/downloads) version 6.9 or later (Mac or Windows)
- No account or API key required — the plugin uses ESPN's free public scoreboard API

---

## Installation

**Elgato Marketplace (recommended)**

1. Open **[Live CFB Scores on the Elgato Marketplace](https://marketplace.elgato.com/product/live-cfb-scores-62e13b96-083e-4ed7-9cc6-78560a6f648c)** and install it from there
2. The plugin will appear in the Stream Deck action picker under **Live CFB Scores**

**Manual install**

1. Download the latest **`Live CFB Scores.streamDeckPlugin`** from the [Releases](../../releases) page
2. Double-click the file — Stream Deck will install it automatically

---

## Setup

1. Drag the **Live CFB Scores** action onto any key
2. In the settings panel on the right, find your team by typing into the search box or by picking a conference and then a team from the dropdowns
3. Choose what happens when you press the key:
   - **ESPN Gamecast (default)** — opens the game's live Gamecast page
   - **Custom Link** — opens any URL you enter, such as your regional sports network's live-game page
4. That's it — the key will load your team's current or upcoming game within a few seconds and refresh every 30 seconds from there

**Scoreboard:**

1. Drag the **Live CFB Scoreboard** action onto as many keys as you want
2. In the settings panel, pick what the board shows: Top 25, a conference, or All FBS. Each option lists the most keys it can need (e.g. "SEC (up to 16 keys)"); most weeks need fewer
3. Optionally choose the order (kickoff or ranking), fill direction, finals last, rankings on/off, and a background color. Changes apply to the whole board the key is part of

> **Note:** If Custom Link is selected but the game hasn't started yet, pressing the key opens Gamecast instead — a Custom Link with no URL entered behaves the same way. After the final whistle, the key keeps opening your custom link for 30 minutes to cover post-game coverage, then automatically switches to ESPN's box score.

---

## What the Key Shows

![Live CFB Scores key states](assets/button-states.png)

**Before the game:**
```
MRSH @ UGA
 Sat 7:30 PM
```

**Live game:**
```
MRSH   7
UGA   45
Q4 2:13
```
The team with the ball is colored brown (orange in the red zone); the clock turns red during the two-minute timeout.

**Final score:**
```
MRSH   7
UGA   45
 Final
```

**Bye week:**
```
 UGA
BYE WEEK
```
Shown for the whole off week: from the Monday 3:00 AM ET after the team's last game until the Monday 3:00 AM ET that starts the week of its next game. Pressing the key opens that team's schedule on ESPN.

**No game found:**
```
 UGA
No Game
```
Shown before the season starts or after it ends. Also opens that team's schedule on ESPN when pressed.

**Ranked teams:**

Ranked teams show their Top 25 rank in small gray type before the abbreviation (e.g. `2 UGA 20`). Turn it off with "Show Top 25 rankings" in the settings panel.

---

## The Scoreboard

![Live CFB Scoreboard showing the Top 25](assets/LiveCFBScoreboardInAction.png)

Each **Live CFB Scoreboard** key is one game from this week, in kickoff order (or by ranking). The keys look and act just like the team keys above: rankings, possession and red zone colors, two-minute timeout, the score flash and play card, and fireworks at the final.

- **What to show:** Top 25, any FBS conference, or All FBS. Conference boards include their teams' non-conference games
- **Key counts:** the dropdown shows the most keys each choice can need (Top 25: up to 25, Big Ten: up to 18, SEC: up to 16, and so on). More games than keys: the last key shows `+N more`. More keys than games: the extra keys show `No Game`. Pressing either opens ESPN's scoreboard for that board
- **Order:** kickoff time (default) or ranking (the game with the highest-ranked team first)
- **Fill order:** top-to-bottom (default) or left-to-right
- **Finals last:** optionally move finished games to the end
- **Week change:** the board keeps this week up until Monday 3:00 AM ET, then moves to next week
- **Multiple boards:** each key remembers its own settings, so different pages can show different boards. Boards can share a page too: give each one its own background color to tell them apart. A settings change applies to the whole board the key is part of. New Scoreboard keys start on the Top 25
- **Multiple Stream Decks:** each deck (including a Virtual Stream Deck or Stream Deck Mobile) gets its own boards

![An SEC board, a Big Ten board and a Top 25 board on one Stream Deck XL page](assets/LiveCFBScoreboardConferences.png)

---

## How It Works

The plugin polls [ESPN's public college football scoreboard API](https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard) once every 30 seconds per key (down to every 15 seconds during the two-minute timeout of the 2nd and 4th quarters). No API key or account is required. The plugin is fully self-contained — it uses only Node.js built-in modules and requires no external dependencies. Each team's abbreviation, name, and color are read directly from that response, so there's no separate team database to keep in sync with ESPN.

Because FBS teams play roughly once per week rather than daily, the plugin queries a rolling 17-day window (seven days back, ten days ahead) and picks the most relevant game for your team: a game in progress takes priority over an upcoming game, which takes priority over last week's final — so the key holds onto a result until the next game appears on the schedule (through the following Monday, 3:00 AM ET, if it finished before then).

Scoreboard keys reuse that same window: every board on every deck, whatever it shows, is filled from the one shared fetch (conference boards just filter it by each team's conference), so adding boards doesn't add requests to ESPN.

The settings panel's team picker works the same way — it fetches ESPN's full FBS standings once when opened to build its searchable list of all 136 teams, since a single scoreboard poll only ever contains teams that have games in the current window. If that fetch fails, the picker falls back to a bundled list so it's never empty.

---

## Uninstalling

Open Stream Deck → Preferences → Plugins, select **Live CFB Scores**, and click the **−** key.

---

## Contributing

Bug reports and feature requests are welcome — open an [Issue](../../issues) to get started.

---

## Disclaimer

This plugin is not affiliated with, endorsed by, or sponsored by the NCAA, ESPN, or any conference or institution. All data is sourced from ESPN's public scoreboard API and is subject to ESPN's terms of use. This plugin is intended for individual, personal, non-commercial use only.

---

## Credits

Created by **T.J. Lauerman aka ThatSportsGamer**

Created with Claude Cowork by Anthropic

Data provided by [ESPN](https://www.espn.com/college-football/)

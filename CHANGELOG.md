# Changelog

Full version history for Live CFB Scores, newest first. The [README](README.md) lists the three most recent updates.

**v1.1.1.0**
- Pregame keys are easier to read: the teams stack on two lines (away team on top, "@ home" below, with a small "@") and the day and time get their own lines. On game day the day line goes away and the start time is shown larger. Same on team keys and Scoreboard keys
- Games a week or more out show the date on the day line ("Sat 10/24"), with the time underneath
- Fixed: a game six and a half days away could show its date instead of its weekday
- Postponed and delayed games use the same stacked layout

**v1.1.0.0**
- New: **Live CFB Scoreboard** action — drag it onto as many keys as you like and they fill with this week's games, one game per key. Pick what each board shows: the **Top 25**, any **FBS conference** (ACC, American, Big 12, Big Ten, Conference USA, MAC, Mountain West, Pac-12, SEC, Sun Belt, FBS Independents), or **All FBS**. The dropdown shows the most keys each one can need
- Each board remembers its own choice, so an SEC page, a Big Ten page and a Top 25 page can all live in one profile. Boards with different settings can share a page, too
- Order by kickoff time or by ranking, fill top-to-bottom or left-to-right, optionally send finals to the end, and give each board its own background color
- Same keys as the team action: possession and red zone, score flash with TD/XP/FG/SAF/2PT cards, fireworks at the final. More games than keys: the last key shows "+N more"; extra keys show "No Game". Both open ESPN's scoreboard for that board. The week moves on Monday at 3:00 AM ET, same as the team keys
- Pregame keys show "TBD" when the network hasn't set the kickoff time yet (instead of a midnight placeholder), on both actions
- Final games now open ESPN's box score instead of Gamecast, on both actions
- Bye weeks now show `BYE WEEK` for the whole off week (Monday 3:00 AM ET to Monday 3:00 AM ET). Before, the key jumped ahead to the next game a week early
- Neutral-site games (Texas–Oklahoma in Dallas, bowls, the CFP) show `TEX vs OU` instead of `@`, on both actions

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

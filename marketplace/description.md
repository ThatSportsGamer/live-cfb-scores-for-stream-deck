# Marketplace Listing Draft — Live CFB Scores

## Name
Live CFB Scores

## Short tagline (optional, if Marketplace supports one)
Live college football scores on every button.

## Overview

Shows live college football scores on your Stream Deck.

Each button tracks one FBS team — see the current score, quarter, clock, and possession at a glance.

**Setup**

1. Drag the **Live CFB Scores** action onto any button
2. In the settings panel on the right, search for your team or browse by conference
3. (Optional) Turn on a custom background color and opacity so buttons for different teams are easy to tell apart
4. That's it. The button will load your team's current or upcoming game within a few seconds and refresh every 30 seconds from there — 15 seconds during the two-minute timeout of the 2nd or 4th quarter.

**Note:** Pressing the button opens the game in ESPN Gamecast, or your team's schedule on ESPN if there's no game, including bye weeks.

**How It Works**

The plugin polls ESPN's public college football scoreboard API once every 30 seconds per button — 15 seconds during the two-minute timeout of the 2nd or 4th quarter, so a fast-moving late-game sequence isn't missed between refreshes. No API key or account is required. The plugin is fully self-contained — it uses only Node.js built-in modules and requires no external dependencies. Team names, abbreviations, and colors are pulled live from ESPN rather than a bundled list, so the button and the settings panel's team picker (covering all 136 FBS teams across 11 conferences) always match what ESPN itself is showing. Because FBS teams play roughly once a week, the plugin always shows the most relevant game for your team: live beats upcoming beats last week's final. A final score holds steady through the following Monday at 3:00 AM ET instead of flipping to the next matchup as soon as it's scheduled — so it's still there when you sit down at your desk Monday morning — and BYE WEEK shows automatically on a team's off week.

**Disclaimer**

This plugin is not affiliated with, endorsed by, or sponsored by the NCAA, ESPN, or any conference or institution. All data is sourced from ESPN's public scoreboard API and is subject to ESPN's terms of use. This plugin is intended for individual, personal, non-commercial use only.

## Tags / keywords to include
college football, CFB, NCAA football, football scores, live scores, sports, ESPN, scoreboard, FBS, SEC, Big Ten, ACC, Big 12

## Release notes for this submission (v1.0.13.0)
- Live scores, possession indicator, red-zone highlighting, score-change flash, and end-of-game fireworks
- Custom key background color and opacity, set per button in the settings panel — makes it easy to tell teams apart across multiple buttons
- Adaptive refresh: polls every 15 seconds during the two-minute timeout of the 2nd/4th quarter instead of 30, so late-game scoring plays aren't missed
- BYE WEEK detection for teams with no game that week
- Final score holds steady through the following Monday at 3:00 AM ET instead of flipping to the next matchup as soon as it's scheduled
- Team data (names, abbreviations, colors, and the settings panel's search list) pulled live from ESPN instead of a bundled list
- Search or browse-by-conference team picker covering all 136 FBS teams across 11 conferences
- ESPN Gamecast shortcut, with a fallback to your team's schedule when there's no game
- Fixed possession indicator briefly flashing blank around scoring plays
- Fixed an ESPN edge-network issue that could show an `Err` state
- Centered, correctly-spaced live score lines on real hardware

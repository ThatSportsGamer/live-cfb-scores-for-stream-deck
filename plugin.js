/**
 * CFB Scores — Stream Deck Plugin
 * Uses Node.js built-in modules only (net, https, crypto).
 * No npm packages required.
 */

'use strict';

const net    = require('net');
const https  = require('https');
const crypto = require('crypto');
const events = require('events');
const path   = require('path');
const fs     = require('fs');

// ── Logging ───────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'plugin.log');
try { fs.writeFileSync(LOG_FILE, `=== CFB Plugin ${new Date().toISOString()} ===\nNode: ${process.version}\nArgs: ${process.argv.slice(2).join(' ')}\n`); } catch (e) { /* ignore */ }

function log(...args) {
    const ts   = new Date().toISOString().slice(11, 19);
    const line = `[${ts}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
    try { fs.appendFileSync(LOG_FILE, line); } catch (e) { /* ignore */ }
}

process.on('uncaughtException',  err => log('CRASH:', err.stack || err.message));
process.on('unhandledRejection', err => log('UNHANDLED:', String(err)));

// ── TEST MODE (dev only) ────────────────────────────────────────────────────
// Set to a date string (e.g. '2026-09-01') to make the plugin think "today" is
// that date, so the rolling window picks up a future/past week's games for
// testing and screenshots. MUST be set back to null before shipping a release.
const DEBUG_ANCHOR_DATE = null;
if (DEBUG_ANCHOR_DATE) log('*** TEST MODE: pretending today is ' + DEBUG_ANCHOR_DATE + ' ***');

// Keyed by teamId — skips the ESPN fetch for that team only and renders the
// fixed game/state below instead, on whatever button that team is assigned
// to. Every other team keeps hitting the real API as normal, so you can put
// a different test scenario on each button at the same time (handy for
// lining up Marketplace screenshots without waiting for real games).
// A value of `null` forces that team's button into the "No Game" / off-week
// state. MUST be set back to {} before shipping a release.
// Example — five buttons, five different states at once:
// const DEBUG_FAKE_GAMES = {
//     // Pre-game — assign this to Alabama (333)
//     '333': {
//         state: 'preview', matchup: 'ALA @ UGA', eventId: 'debug-preview',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '333', homeId: '61', awayAbbr: 'ALA', homeAbbr: 'UGA',
//         time: 'Sat 7:30 PM',
//     },
//     // Live, with possession + a normal (gold) clock line — assign to Georgia (61)
//     '61': {
//         state: 'live', matchup: 'MRSH @ UGA', eventId: 'debug-live',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '276', homeId: '61', awayAbbr: 'MRSH', homeAbbr: 'UGA',
//         awayScore: 7, homeScore: 21, period: 3, clock: '8:42',
//         statusName: 'STATUS_IN_PROGRESS', possession: '61', isRedZone: false,
//     },
//     // Live, in the red zone (orange-red clock line) — assign to Ohio State (194)
//     '194': {
//         state: 'live', matchup: 'PSU @ OSU', eventId: 'debug-redzone',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '213', homeId: '194', awayAbbr: 'PSU', homeAbbr: 'OSU',
//         awayScore: 14, homeScore: 17, period: 4, clock: '0:48',
//         statusName: 'STATUS_IN_PROGRESS', possession: '194', isRedZone: true,
//     },
//     // Final, with OT label — assign to Michigan (130)
//     '130': {
//         state: 'final', matchup: 'MICH @ WIS', eventId: 'debug-final',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '130', homeId: '275', awayAbbr: 'MICH', homeAbbr: 'WIS',
//         awayScore: 27, homeScore: 24, period: 5,
//     },
//     // Off week / no game — assign to Texas (251)
//     '251': null,
// };
// Previously used to line up the four-button Marketplace screenshot —
// uncomment and reassign these teams to buttons any time you need to
// reproduce that shot or test a similar spread of states at once.
// const DEBUG_FAKE_GAMES = {
//     // Finished game, final score — assign this to Florida State (52)
//     '52': {
//         state: 'final', matchup: 'CLEM @ FSU', eventId: 'debug-final',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '228', homeId: '52', awayAbbr: 'CLEM', homeAbbr: 'FSU',
//         awayScore: 17, homeScore: 20, period: 4,
//     },
//     // Early game, 0-7, 8:24 left in the 1st, in the red zone — assign to LSU (99)
//     '99': {
//         state: 'live', matchup: 'OU @ LSU', eventId: 'debug-early',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '201', homeId: '99', awayAbbr: 'OU', homeAbbr: 'LSU',
//         awayScore: 0, homeScore: 7, period: 1, clock: '8:24',
//         statusName: 'STATUS_IN_PROGRESS', possession: '99', isRedZone: true,
//     },
//     // Mid game, realistic score, under 2:00 left in the 1st half — assign to Tennessee (2633)
//     '2633': {
//         state: 'live', matchup: 'MISS @ TENN', eventId: 'debug-midgame',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '145', homeId: '2633', awayAbbr: 'MISS', homeAbbr: 'TENN',
//         awayScore: 10, homeScore: 13, period: 2, clock: '1:47',
//         statusName: 'STATUS_IN_PROGRESS', possession: '2633', isRedZone: false,
//     },
//     // Pre-game, kicks off at 7:45 PM — assign to USC (30)
//     '30': {
//         state: 'preview', matchup: 'ORE @ USC', eventId: 'debug-preview745',
//         link: 'https://www.espn.com/college-football/',
//         awayId: '2483', homeId: '30', awayAbbr: 'ORE', homeAbbr: 'USC',
//         time: 'Sat 7:45 PM',
//     },
// };
const DEBUG_FAKE_GAMES = {};
if (Object.keys(DEBUG_FAKE_GAMES).length) log('*** TEST MODE: returning fake games for ' + Object.keys(DEBUG_FAKE_GAMES).join(', ') + ' ***');

// ── Parse Stream Deck launch arguments ────────────────────────────────────────
let sdPort, pluginUUID, registerEvent;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-port')          sdPort        = argv[i + 1];
    if (argv[i] === '-pluginUUID')    pluginUUID    = argv[i + 1];
    if (argv[i] === '-registerEvent') registerEvent = argv[i + 1];
}

log('port=' + sdPort + ' uuid=' + pluginUUID + ' event=' + registerEvent);

if (!sdPort || !pluginUUID || !registerEvent) {
    log('ERROR: Missing required args. Stream Deck may not have launched this plugin correctly.');
    process.exit(1);
}

// ── Minimal WebSocket client (no external deps) ───────────────────────────────
class SimpleWS extends events.EventEmitter {
    constructor(port, host) {
        super();
        this.readyState  = 0; // CONNECTING
        this._buf        = Buffer.alloc(0);
        this._handshaked = false;

        this._sock = net.createConnection(parseInt(port, 10), host || '127.0.0.1');

        this._sock.on('connect', () => {
            log('TCP connected, sending WS upgrade...');
            const key = crypto.randomBytes(16).toString('base64');
            this._sock.write([
                'GET / HTTP/1.1',
                `Host: 127.0.0.1:${port}`,
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Key: ${key}`,
                'Sec-WebSocket-Version: 13',
                '', '',
            ].join('\r\n'));
        });

        this._sock.on('data',  chunk => this._onData(chunk));
        this._sock.on('error', err   => { log('TCP error:', err.message); this.emit('error', err); });
        this._sock.on('close', ()    => { this.readyState = 3; log('TCP closed'); this.emit('close'); });
    }

    _onData(chunk) {
        this._buf = Buffer.concat([this._buf, chunk]);

        if (!this._handshaked) {
            let end = -1;
            for (let i = 0; i <= this._buf.length - 4; i++) {
                if (this._buf[i]===13 && this._buf[i+1]===10 &&
                    this._buf[i+2]===13 && this._buf[i+3]===10) { end = i + 4; break; }
            }
            if (end === -1) return;

            const header = this._buf.slice(0, end).toString('ascii');
            log('HTTP response:', header.split('\r\n')[0]);

            if (!header.includes('101')) {
                log('WS upgrade failed!');
                this.emit('error', new Error('WebSocket upgrade rejected'));
                return;
            }

            this._handshaked = true;
            this.readyState  = 1; // OPEN
            this._buf        = this._buf.slice(end);
            log('WS handshake OK');
            this.emit('open');
        }

        this._parseFrames();
    }

    _parseFrames() {
        while (this._buf.length >= 2) {
            const b0       = this._buf[0];
            const b1       = this._buf[1];
            const opcode   = b0 & 0x0f;
            const isMasked = !!(b1 & 0x80);
            let   plen     = b1 & 0x7f;
            let   offset   = 2;

            if (plen === 126) {
                if (this._buf.length < 4) return;
                plen = this._buf.readUInt16BE(2); offset = 4;
            } else if (plen === 127) {
                if (this._buf.length < 10) return;
                plen = Number(this._buf.readBigUInt64BE(2)); offset = 10;
            }

            const maskLen = isMasked ? 4 : 0;
            const total   = offset + maskLen + plen;
            if (this._buf.length < total) return;

            let payload = Buffer.from(this._buf.slice(offset + maskLen, total));
            if (isMasked) {
                const mask = this._buf.slice(offset, offset + 4);
                for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            }
            this._buf = this._buf.slice(total);

            if      (opcode === 0x1) this.emit('message', payload.toString('utf8'));
            else if (opcode === 0x8) { this.readyState = 3; log('WS close frame'); this.emit('close'); return; }
            else if (opcode === 0x9) this._sendFrame(0x8a, payload); // pong — must echo ping payload per RFC 6455
        }
    }

    send(str) {
        if (this.readyState !== 1) { log('WARN: send() called but WS not open (state=' + this.readyState + ')'); return; }
        this._sendFrame(0x81, Buffer.from(String(str), 'utf8'));
    }

    // Write one WebSocket frame. Client frames must be masked per RFC 6455.
    _sendFrame(opcode, payload) {
        const len  = payload.length;
        const mask = crypto.randomBytes(4);
        let   hdr;

        if (len < 126) {
            hdr = Buffer.alloc(6);
            hdr[0] = opcode; hdr[1] = 0x80 | len;
            mask.copy(hdr, 2);
        } else if (len < 65536) {
            hdr = Buffer.alloc(8);
            hdr[0] = opcode; hdr[1] = 0x80 | 126;
            hdr.writeUInt16BE(len, 2);
            mask.copy(hdr, 4);
        } else {
            log('WS: payload too large (' + len + ' bytes)'); return;
        }

        const masked = Buffer.alloc(len);
        for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
        this._sock.write(Buffer.concat([hdr, masked]));
    }
}

// ── Plugin state ──────────────────────────────────────────────────────────────
const instances     = new Map(); // context -> { teamId, teamAbbr }
const prevScores    = new Map(); // context -> { awayScore, homeScore }
const prevState     = new Map(); // context -> last known game state string
const flashing       = new Set(); // contexts mid-flash animation
const refreshing     = new Set(); // contexts mid-async refresh
const lastRender      = new Map(); // context -> JSON key of last rendered lines
const currentGame     = new Map(); // context -> parsed game object | null
const refreshTimers   = new Map(); // context -> intervalId (staggered per-button timers)

// ── Connect to Stream Deck ────────────────────────────────────────────────────
log('Connecting to Stream Deck on port', sdPort);
const ws = new SimpleWS(sdPort);

ws.on('open', () => {
    log('WS open — registering plugin');
    ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
});

ws.on('message', raw => {
    let ev;
    try { ev = JSON.parse(raw); } catch (e) { log('Bad JSON:', e.message); return; }
    log('← SD event:', ev.event, ev.context ? ev.context.slice(0, 8) : '');
    try { handleEvent(ev); } catch (e) { log('handleEvent crash:', e.stack || e.message); }
});

ws.on('error', err => log('WS error:', err.message));
ws.on('close', ()  => {
    log('WS closed — exiting so Stream Deck can restart');
    setTimeout(() => process.exit(0), 2000);
});

// ── Stream Deck event handler ─────────────────────────────────────────────────
function handleEvent({ event, context, payload }) {
    switch (event) {

        case 'willAppear':
            instances.set(context, (payload && payload.settings) || {});
            log('willAppear — settings:', instances.get(context));
            if (refreshTimers.has(context)) clearInterval(refreshTimers.get(context));
            refreshTimers.set(context, setInterval(() => refreshButton(context), 30_000));
            refreshButton(context);
            break;

        case 'willDisappear':
            instances.delete(context);
            prevScores.delete(context);
            prevState.delete(context);
            lastRender.delete(context);
            currentGame.delete(context);
            refreshing.delete(context);
            flashing.delete(context);
            if (refreshTimers.has(context)) {
                clearInterval(refreshTimers.get(context));
                refreshTimers.delete(context);
            }
            break;

        case 'didReceiveSettings':
            instances.set(context, (payload && payload.settings) || {});
            log('didReceiveSettings:', instances.get(context));
            lastRender.delete(context); // force redraw with new settings
            refreshButton(context);
            break;

        case 'keyUp': {
            const game = currentGame.get(context);
            if (game && game.link) {
                log('keyUp — opening URL:', game.link);
                ws.send(JSON.stringify({ event: 'openUrl', payload: { url: game.link } }));
            } else {
                const cfg    = instances.get(context) || {};
                const teamId = cfg.teamId;
                if (teamId) {
                    const scheduleUrl = 'https://www.espn.com/college-football/team/schedule/_/id/' + teamId;
                    log('keyUp — no game, opening schedule:', scheduleUrl);
                    ws.send(JSON.stringify({ event: 'openUrl', payload: { url: scheduleUrl } }));
                } else {
                    log('keyUp — no game, no teamId, refreshing');
                    lastRender.delete(context);
                    refreshButton(context);
                }
            }
            break;
        }

        case 'sendToPlugin':
            if (payload && payload.settings) {
                instances.set(context, payload.settings);
                lastRender.delete(context);
                refreshButton(context);
            }
            break;
    }
}

// ── Refresh one button ────────────────────────────────────────────────────────
async function refreshButton(context) {
    if (refreshing.has(context)) { log('Refresh already in progress, skipping'); return; }
    if (flashing.has(context))   { log('Flash in progress, skipping refresh'); return; }

    const cfg = instances.get(context);
    if (!cfg || !cfg.teamId) {
        setButton(context, ['Select A', 'Team In', 'Settings']);
        return;
    }

    refreshing.add(context);
    log('Refreshing', cfg.teamAbbr || cfg.teamId);
    try {
        const game = await fetchTeamGame(cfg.teamId);
        currentGame.set(context, game || null);

        // Detect live → final transition and play fireworks
        const prevGameState = prevState.get(context);
        prevState.set(context, game ? game.state : null);
        if (prevGameState === 'live' && game && game.state === 'final') {
            const winnerIsHome = game.homeScore >= game.awayScore;
            const winnerId     = winnerIsHome ? game.homeId : game.awayId;
            log('Game over — fireworks for', teamName(winnerId));
            refreshing.delete(context);
            playFireworks(context, teamName(winnerId), teamColor(winnerId)).catch(e => log('fireworks error:', e.message));
            return;
        }

        const lines   = buildLines(game, cfg);
        const spacing = lines.some(l => typeof l === 'object') ? 1.2 : 1.4;
        log('→', JSON.stringify(lines));

        // Detect score change on live games and flash in the scoring team's color
        const prev = prevScores.get(context);
        if (game && game.state === 'live') {
            prevScores.set(context, { awayScore: game.awayScore, homeScore: game.homeScore });
            if (prev) {
                const awayScored = game.awayScore > prev.awayScore;
                const homeScored = game.homeScore > prev.homeScore;
                if (awayScored || homeScored) {
                    const color = (awayScored && homeScored) ? '#FFFFFF'
                        : awayScored ? teamColor(game.awayId)
                                     : teamColor(game.homeId);
                    log('Score change — flashing', color);
                    refreshing.delete(context);
                    flashButton(context, color, lines, spacing).catch(e => log('flashButton error:', e.message));
                    return;
                }
            }
        } else {
            prevScores.delete(context);
        }

        setButton(context, lines, spacing);
    } catch (err) {
        log('Fetch error:', err.message);
        setButton(context, [cfg.teamAbbr || 'CFB', 'Err']);
    } finally {
        refreshing.delete(context);
    }
}

// ── Text sizing helper — shrink font until the line fits the button width ─────
// Uses the same real glyph-width table as the centering math (see textWidthPx
// below) instead of a flat per-char estimate, so wide abbreviations like
// "WMU" or "MTSU" get sized just as precisely as narrow ones like "LSU".
function fitFs(text, maxFs) {
    let fs = maxFs;
    while (fs > 9 && textWidthPx(text, fs) > 64) fs--;
    return fs;
}

// ── Fixed size tiers for the live/final score lines ────────────────────────
// Every abbreviation in TEAMS is 2-4 characters, so two fixed sizes cover the
// whole roster: 17pt for 2-3 letter abbrs, 16pt for the wider 4-letter ones.
// A handful of unusually wide 3-letter abbrs (MEM, HAW, WYO, WKU, WMU) can
// still run wide at 17pt once paired with a double-digit score, so fitFs()
// is used as a per-game fallback — it only shrinks further for the specific
// combos that actually need it, rather than shrinking every game.
function baseTierFs(abbr) {
    return abbr.length >= 4 ? 16 : 17;
}

// Real Helvetica-Bold glyph widths (per 1000 em units, from the standard AFM
// metrics) — used only where we anchor two separately-colored text segments
// on a shared boundary point (see makeImage). A flat "every char is 0.6em"
// estimate treats e.g. "UGA" and "ALA" as equal width, but U/G are notably
// wider than L — that mismatch is what made the two team lines look
// inconsistently centered against each other on real hardware. Digits are
// all the same width in Helvetica (tabular figures), so scores were never
// the issue. This table only needs to cover what can actually appear here:
// A-Z (abbreviations) and 0-9 (scores).
const GLYPH_WIDTH_1000 = {
    A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
    J: 556, K: 722, L: 611, M: 889, N: 722, O: 778, P: 667, Q: 778, R: 722,
    S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
    '&': 778, '-': 333, // covers the two non-alpha abbrs in TEAMS: TA&M, M-OH
    ' ': 278, // real Helvetica-Bold space width — was falling back to the 600
              // generic default (nearly a full capital letter wide), which made
              // fitFs() overestimate "ABBR SCORE" and shrink the font a point
              // smaller than it needed to for most matchups.
};
function textWidthPx(str, fs) {
    let units = 0;
    for (const ch of str) units += GLYPH_WIDTH_1000[ch] !== undefined ? GLYPH_WIDTH_1000[ch] : 600;
    return units * fs / 1000;
}

// ── Quarter / overtime label ──────────────────────────────────────────────────
function periodLabel(period) {
    if (period >= 1 && period <= 4) return 'Q' + period;
    const ot = period - 4;
    return ot <= 1 ? 'OT' : ot + 'OT';
}

// Parses ESPN's "M:SS" display clock into total seconds — returns null for
// anything that doesn't match (e.g. an empty string during a status change).
function parseClockSeconds(clockStr) {
    if (!clockStr) return null;
    const m = /^(\d+):(\d{2})$/.exec(clockStr.trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// ── Build button display lines ────────────────────────────────────────────────
function buildLines(game, cfg) {
    const abbr = cfg.teamAbbr || 'CFB';
    if (!game) return [abbr, 'No Game'];

    if (game.state === 'preview') return [game.matchup, game.time];
    if (game.state === 'ppd')     return [game.matchup, { text: 'PPD',   fs: 16, color: '#E74C3C' }];
    if (game.state === 'delay')   return [game.matchup, { text: 'DELAY', fs: 14, color: '#3498DB' }];

    if (game.state === 'live') {
        const awayBall  = !!game.possession && game.possession === String(game.awayId);
        const homeBall  = !!game.possession && game.possession === String(game.homeId);
        const awayPlain = game.awayAbbr + ' ' + game.awayScore;
        const homePlain = game.homeAbbr + ' ' + game.homeScore;
        const ceiling   = Math.min(baseTierFs(game.awayAbbr), baseTierFs(game.homeAbbr));
        // No extra safety margin needed here — the parts-based split below uses
        // an explicit GAP of fs*0.28 between the two anchored text elements,
        // which is close enough to the real Helvetica-Bold space width (0.278em)
        // that the plain "ABBR SCORE" width check fitFs() does is already an
        // accurate stand-in for the split rendering.
        const fs = Math.min(fitFs(awayPlain, ceiling), fitFs(homePlain, ceiling));

        // Possession shown by coloring just the team abbreviation \u2014 the score
        // stays white. Text content never changes length based on possession,
        // so both lines stay naturally aligned with no shifting. Three states
        // on the same element: white (no ball) -> brown (has ball) -> orange
        // (has ball AND in the red zone). Red zone can only ever apply to
        // whichever team currently has the ball, so this is a strict upgrade
        // of the possession signal, not a conflicting second one.
        const POSSESSION_BROWN   = '#C08552';
        const POSSESSION_REDZONE = '#FF4500';
        const possessionColor = hasBall => hasBall
            ? (game.isRedZone ? POSSESSION_REDZONE : POSSESSION_BROWN)
            : 'white';
        // No leading space on the score part — SVG text elements can trim
        // leading whitespace, which silently ate the gap on real hardware.
        // The visual gap is now an explicit pixel offset in makeImage instead.
        const awayLine = { fs, parts: [
            { text: game.awayAbbr,            color: possessionColor(awayBall) },
            { text: String(game.awayScore),   color: 'white' },
        ] };
        const homeLine = { fs, parts: [
            { text: game.homeAbbr,            color: possessionColor(homeBall) },
            { text: String(game.homeScore),   color: 'white' },
        ] };

        // The clock line no longer tracks red zone (moved onto the possessing
        // team's abbreviation above) — it only ever shows the two-minute timeout.
        let clockText, clockColor;
        if (game.statusName === 'STATUS_HALFTIME') {
            clockText  = 'Halftime';
            clockColor = '#FFD700';
        } else if (game.statusName === 'STATUS_END_PERIOD') {
            clockText  = 'End ' + periodLabel(game.period);
            clockColor = '#FFD700';
        } else {
            clockText = (game.clock || '') + ' ' + periodLabel(game.period);
            // Two-minute timeout — pure red. Only applies at the end of the 2nd
            // and 4th quarters (the real two-minute timeout), not every period.
            const secondsLeft = parseClockSeconds(game.clock);
            const isTwoMinTimeout = (game.period === 2 || game.period === 4) &&
                secondsLeft !== null && secondsLeft <= 120;
            clockColor = isTwoMinTimeout ? '#FF0000' : '#FFD700';
        }

        return [
            awayLine,
            homeLine,
            { text: clockText, fs: 11, color: clockColor },
        ];
    }

    if (game.state === 'final') {
        const awayText = game.awayAbbr + ' ' + game.awayScore;
        const homeText = game.homeAbbr + ' ' + game.homeScore;
        const ceiling   = Math.min(baseTierFs(game.awayAbbr), baseTierFs(game.homeAbbr));
        const fs        = Math.min(fitFs(awayText, ceiling), fitFs(homeText, ceiling));
        const ot        = game.period > 4 ? game.period - 4 : 0;
        const label     = ot === 0 ? 'Final' : (ot === 1 ? 'Final/OT' : 'Final/' + ot + 'OT');
        return [
            { text: awayText, fs },
            { text: homeText, fs },
            { text: label, fs: 12, color: '#FFD700' },
        ];
    }

    return [abbr, '---'];
}

// ── Team data (abbr, full name, school short name, primary color) ─────────────
// Source: ESPN college-football API, FBS teams (groups=80), 11 conferences, 136 teams
const TEAMS = {
    // Southeastern Conference (SEC)
    '333': { abbr: 'ALA', name: 'Alabama Crimson Tide', short: 'Alabama', color: '#9E1B32' },
    '8': { abbr: 'ARK', name: 'Arkansas Razorbacks', short: 'Arkansas', color: '#A32136' },
    '2': { abbr: 'AUB', name: 'Auburn Tigers', short: 'Auburn', color: '#002B5C' },
    '57': { abbr: 'FLA', name: 'Florida Gators', short: 'Florida', color: '#0021A5' },
    '61': { abbr: 'UGA', name: 'Georgia Bulldogs', short: 'Georgia', color: '#BA0C2F' },
    '96': { abbr: 'UK', name: 'Kentucky Wildcats', short: 'Kentucky', color: '#0033A0' },
    '99': { abbr: 'LSU', name: 'LSU Tigers', short: 'LSU', color: '#461D76' },
    '344': { abbr: 'MSST', name: 'Mississippi State Bulldogs', short: 'Mississippi St', color: '#5D1725' },
    '142': { abbr: 'MIZ', name: 'Missouri Tigers', short: 'Missouri', color: '#F1B82D' },
    '201': { abbr: 'OU', name: 'Oklahoma Sooners', short: 'Oklahoma', color: '#990000' },
    '145': { abbr: 'MISS', name: 'Ole Miss Rebels', short: 'Ole Miss', color: '#13294B' },
    '2579': { abbr: 'SC', name: 'South Carolina Gamecocks', short: 'South Carolina', color: '#73000A' },
    '2633': { abbr: 'TENN', name: 'Tennessee Volunteers', short: 'Tennessee', color: '#FF8200' },
    '251': { abbr: 'TEX', name: 'Texas Longhorns', short: 'Texas', color: '#AF5C37' },
    '245': { abbr: 'TA&M', name: 'Texas A&M Aggies', short: 'Texas A&M', color: '#500000' },
    '238': { abbr: 'VAN', name: 'Vanderbilt Commodores', short: 'Vanderbilt', color: '#CFAE70' },
    // Big Ten Conference (Big Ten)
    '356': { abbr: 'ILL', name: 'Illinois Fighting Illini', short: 'Illinois', color: '#FF5F05' },
    '84': { abbr: 'IU', name: 'Indiana Hoosiers', short: 'Indiana', color: '#970310' },
    '2294': { abbr: 'IOWA', name: 'Iowa Hawkeyes', short: 'Iowa', color: '#231F20' },
    '120': { abbr: 'MD', name: 'Maryland Terrapins', short: 'Maryland', color: '#CE1126' },
    '130': { abbr: 'MICH', name: 'Michigan Wolverines', short: 'Michigan', color: '#00274C' },
    '127': { abbr: 'MSU', name: 'Michigan State Spartans', short: 'Michigan St', color: '#173F35' },
    '135': { abbr: 'MINN', name: 'Minnesota Golden Gophers', short: 'Minnesota', color: '#5E0A2F' },
    '158': { abbr: 'NEB', name: 'Nebraska Cornhuskers', short: 'Nebraska', color: '#E31937' },
    '77': { abbr: 'NU', name: 'Northwestern Wildcats', short: 'Northwestern', color: '#492F92' },
    '194': { abbr: 'OSU', name: 'Ohio State Buckeyes', short: 'Ohio State', color: '#BA0C2F' },
    '2483': { abbr: 'ORE', name: 'Oregon Ducks', short: 'Oregon', color: '#00934B' },
    '213': { abbr: 'PSU', name: 'Penn State Nittany Lions', short: 'Penn State', color: '#061440' },
    '2509': { abbr: 'PUR', name: 'Purdue Boilermakers', short: 'Purdue', color: '#CEB888' },
    '164': { abbr: 'RUTG', name: 'Rutgers Scarlet Knights', short: 'Rutgers', color: '#CE0E2D' },
    '26': { abbr: 'UCLA', name: 'UCLA Bruins', short: 'UCLA', color: '#2774AE' },
    '30': { abbr: 'USC', name: 'USC Trojans', short: 'USC', color: '#9D2235' },
    '264': { abbr: 'WASH', name: 'Washington Huskies', short: 'Washington', color: '#33006F' },
    '275': { abbr: 'WIS', name: 'Wisconsin Badgers', short: 'Wisconsin', color: '#A00000' },
    // Atlantic Coast Conference (ACC)
    '103': { abbr: 'BC', name: 'Boston College Eagles', short: 'Boston College', color: '#8C2232' },
    '25': { abbr: 'CAL', name: 'California Golden Bears', short: 'California', color: '#041E42' },
    '228': { abbr: 'CLEM', name: 'Clemson Tigers', short: 'Clemson', color: '#F56600' },
    '150': { abbr: 'DUKE', name: 'Duke Blue Devils', short: 'Duke', color: '#00539B' },
    '52': { abbr: 'FSU', name: 'Florida State Seminoles', short: 'Florida St', color: '#782F40' },
    '59': { abbr: 'GT', name: 'Georgia Tech Yellow Jackets', short: 'Georgia Tech', color: '#B3A369' },
    '97': { abbr: 'LOU', name: 'Louisville Cardinals', short: 'Louisville', color: '#C9001F' },
    '2390': { abbr: 'MIA', name: 'Miami Hurricanes', short: 'Miami', color: '#F47423' },
    '152': { abbr: 'NCSU', name: 'NC State Wolfpack', short: 'NC State', color: '#CC0000' },
    '153': { abbr: 'UNC', name: 'North Carolina Tar Heels', short: 'North Carolina', color: '#7BAFD4' },
    '221': { abbr: 'PITT', name: 'Pittsburgh Panthers', short: 'Pitt', color: '#003594' },
    '2567': { abbr: 'SMU', name: 'SMU Mustangs', short: 'SMU', color: '#A80000' },
    '24': { abbr: 'STAN', name: 'Stanford Cardinal', short: 'Stanford', color: '#8C1515' },
    '183': { abbr: 'SYR', name: 'Syracuse Orange', short: 'Syracuse', color: '#000E54' },
    '258': { abbr: 'UVA', name: 'Virginia Cavaliers', short: 'Virginia', color: '#232D4B' },
    '259': { abbr: 'VT', name: 'Virginia Tech Hokies', short: 'Virginia Tech', color: '#6A2C3E' },
    '154': { abbr: 'WAKE', name: 'Wake Forest Demon Deacons', short: 'Wake Forest', color: '#CEB888' },
    // Big 12 Conference (Big 12)
    '12': { abbr: 'ARIZ', name: 'Arizona Wildcats', short: 'Arizona', color: '#CC0033' },
    '9': { abbr: 'ASU', name: 'Arizona State Sun Devils', short: 'Arizona St', color: '#FFC627' },
    '252': { abbr: 'BYU', name: 'BYU Cougars', short: 'BYU', color: '#0047BA' },
    '239': { abbr: 'BAY', name: 'Baylor Bears', short: 'Baylor', color: '#154734' },
    '2132': { abbr: 'CIN', name: 'Cincinnati Bearcats', short: 'Cincinnati', color: '#E00122' },
    '38': { abbr: 'COLO', name: 'Colorado Buffaloes', short: 'Colorado', color: '#CFB87C' },
    '248': { abbr: 'HOU', name: 'Houston Cougars', short: 'Houston', color: '#C8102E' },
    '66': { abbr: 'ISU', name: 'Iowa State Cyclones', short: 'Iowa State', color: '#AE192D' },
    '2305': { abbr: 'KU', name: 'Kansas Jayhawks', short: 'Kansas', color: '#0051BA' },
    '2306': { abbr: 'KSU', name: 'Kansas State Wildcats', short: 'Kansas St', color: '#330A57' },
    '197': { abbr: 'OKST', name: 'Oklahoma State Cowboys', short: 'Oklahoma St', color: '#FE5C00' },
    '2628': { abbr: 'TCU', name: 'TCU Horned Frogs', short: 'TCU', color: '#4D1979' },
    '2641': { abbr: 'TTU', name: 'Texas Tech Red Raiders', short: 'Texas Tech', color: '#DA291C' },
    '2116': { abbr: 'UCF', name: 'UCF Knights', short: 'UCF', color: '#B4A169' },
    '254': { abbr: 'UTAH', name: 'Utah Utes', short: 'Utah', color: '#BE0000' },
    '277': { abbr: 'WVU', name: 'West Virginia Mountaineers', short: 'West Virginia', color: '#EAAA00' },
    // American Conference (American)
    '349': { abbr: 'ARMY', name: 'Army Black Knights', short: 'Army', color: '#D3BC8D' },
    '2429': { abbr: 'CLT', name: 'Charlotte 49ers', short: 'Charlotte', color: '#005035' },
    '151': { abbr: 'ECU', name: 'East Carolina Pirates', short: 'East Carolina', color: '#582C83' },
    '2226': { abbr: 'FAU', name: 'Florida Atlantic Owls', short: 'FAU', color: '#003366' },
    '235': { abbr: 'MEM', name: 'Memphis Tigers', short: 'Memphis', color: '#004991' },
    '2426': { abbr: 'NAVY', name: 'Navy Midshipmen', short: 'Navy', color: '#00225B' },
    '249': { abbr: 'UNT', name: 'North Texas Mean Green', short: 'North Texas', color: '#068F33' },
    '242': { abbr: 'RICE', name: 'Rice Owls', short: 'Rice', color: '#00205B' },
    '58': { abbr: 'USF', name: 'South Florida Bulls', short: 'South Florida', color: '#006747' },
    '218': { abbr: 'TEM', name: 'Temple Owls', short: 'Temple', color: '#A41E35' },
    '2655': { abbr: 'TULN', name: 'Tulane Green Wave', short: 'Tulane', color: '#006747' },
    '202': { abbr: 'TLSA', name: 'Tulsa Golden Hurricane', short: 'Tulsa', color: '#003595' },
    '5': { abbr: 'UAB', name: 'UAB Blazers', short: 'UAB', color: '#1A5632' },
    '2636': { abbr: 'UTSA', name: 'UTSA Roadrunners', short: 'UTSA', color: '#0C2340' },
    // Mountain West Conference (Mountain West)
    '2005': { abbr: 'AF', name: 'Air Force Falcons', short: 'Air Force', color: '#003594' },
    '68': { abbr: 'BOIS', name: 'Boise State Broncos', short: 'Boise St', color: '#0033A0' },
    '36': { abbr: 'CSU', name: 'Colorado State Rams', short: 'Colorado St', color: '#004C23' },
    '278': { abbr: 'FRES', name: 'Fresno State Bulldogs', short: 'Fresno St', color: '#B1102B' },
    '62': { abbr: 'HAW', name: 'Hawai\'i Rainbow Warriors', short: 'Hawai\'i', color: '#005737' },
    '2440': { abbr: 'NEV', name: 'Nevada Wolf Pack', short: 'Nevada', color: '#041E42' },
    '167': { abbr: 'UNM', name: 'New Mexico Lobos', short: 'New Mexico', color: '#BA0C2F' },
    '21': { abbr: 'SDSU', name: 'San Diego State Aztecs', short: 'San Diego St', color: '#A6192E' },
    '23': { abbr: 'SJSU', name: 'San José State Spartans', short: 'San José St', color: '#0038A8' },
    '2439': { abbr: 'UNLV', name: 'UNLV Rebels', short: 'UNLV', color: '#CF0A2C' },
    '328': { abbr: 'USU', name: 'Utah State Aggies', short: 'Utah State', color: '#0F2439' },
    '2751': { abbr: 'WYO', name: 'Wyoming Cowboys', short: 'Wyoming', color: '#492F24' },
    // Conference USA (Conference USA)
    '48': { abbr: 'DEL', name: 'Delaware Blue Hens', short: 'Delaware', color: '#00539F' },
    '2229': { abbr: 'FIU', name: 'Florida International Panthers', short: 'FIU', color: '#091F3F' },
    '55': { abbr: 'JXST', name: 'Jacksonville State Gamecocks', short: 'Jax State', color: '#CC0000' },
    '338': { abbr: 'KENN', name: 'Kennesaw State Owls', short: 'Kennesaw St', color: '#FDBB30' },
    '2335': { abbr: 'LIB', name: 'Liberty Flames', short: 'Liberty', color: '#0A254E' },
    '2348': { abbr: 'LT', name: 'Louisiana Tech Bulldogs', short: 'Louisiana Tech', color: '#003087' },
    '2393': { abbr: 'MTSU', name: 'Middle Tennessee Blue Raiders', short: 'MTSU', color: '#036EB7' },
    '2623': { abbr: 'MOST', name: 'Missouri State Bears', short: 'Missouri St', color: '#5E0009' },
    '166': { abbr: 'NMSU', name: 'New Mexico State Aggies', short: 'New Mexico St', color: '#7E141B' },
    '2534': { abbr: 'SHSU', name: 'Sam Houston Bearkats', short: 'Sam Houston', color: '#F56423' },
    '2638': { abbr: 'UTEP', name: 'UTEP Miners', short: 'UTEP', color: '#FF8200' },
    '98': { abbr: 'WKU', name: 'Western Kentucky Hilltoppers', short: 'Western KY', color: '#E13A3E' },
    // Mid-American Conference (MAC)
    '2006': { abbr: 'AKR', name: 'Akron Zips', short: 'Akron', color: '#041E42' },
    '2050': { abbr: 'BALL', name: 'Ball State Cardinals', short: 'Ball State', color: '#BA0C2F' },
    '189': { abbr: 'BGSU', name: 'Bowling Green Falcons', short: 'Bowling Green', color: '#FD5000' },
    '2084': { abbr: 'BUF', name: 'Buffalo Bulls', short: 'Buffalo', color: '#005BBB' },
    '2117': { abbr: 'CMU', name: 'Central Michigan Chippewas', short: 'C Michigan', color: '#4C0027' },
    '2199': { abbr: 'EMU', name: 'Eastern Michigan Eagles', short: 'E Michigan', color: '#006938' },
    '2309': { abbr: 'KENT', name: 'Kent State Golden Flashes', short: 'Kent State', color: '#002664' },
    '193': { abbr: 'M-OH', name: 'Miami (OH) RedHawks', short: 'Miami OH', color: '#C41230' },
    '2459': { abbr: 'NIU', name: 'Northern Illinois Huskies', short: 'N Illinois', color: '#C8102E' },
    '195': { abbr: 'OHIO', name: 'Ohio Bobcats', short: 'Ohio', color: '#154734' },
    '2649': { abbr: 'TOL', name: 'Toledo Rockets', short: 'Toledo', color: '#0B2240' },
    '113': { abbr: 'MASS', name: 'Massachusetts Minutemen', short: 'UMass', color: '#881C1C' },
    '2711': { abbr: 'WMU', name: 'Western Michigan Broncos', short: 'W Michigan', color: '#532E1F' },
    // Sun Belt Conference (Sun Belt)
    '2026': { abbr: 'APP', name: 'App State Mountaineers', short: 'App State', color: '#FFCD00' },
    '2032': { abbr: 'ARST', name: 'Arkansas State Red Wolves', short: 'Arkansas St', color: '#CC092F' },
    '324': { abbr: 'CCU', name: 'Coastal Carolina Chanticleers', short: 'Coastal', color: '#006F71' },
    '290': { abbr: 'GASO', name: 'Georgia Southern Eagles', short: 'GA Southern', color: '#041E42' },
    '2247': { abbr: 'GAST', name: 'Georgia State Panthers', short: 'Georgia St', color: '#0039A6' },
    '256': { abbr: 'JMU', name: 'James Madison Dukes', short: 'James Madison', color: '#450084' },
    '309': { abbr: 'UL', name: 'Louisiana Ragin\' Cajuns', short: 'Louisiana', color: '#CE181E' },
    '276': { abbr: 'MRSH', name: 'Marshall Thundering Herd', short: 'Marshall', color: '#00B140' },
    '295': { abbr: 'ODU', name: 'Old Dominion Monarchs', short: 'Old Dominion', color: '#003768' },
    '6': { abbr: 'USA', name: 'South Alabama Jaguars', short: 'South Alabama', color: '#00205B' },
    '2572': { abbr: 'USM', name: 'Southern Miss Golden Eagles', short: 'Southern Miss', color: '#FFC72C' },
    '326': { abbr: 'TXST', name: 'Texas State Bobcats', short: 'Texas St', color: '#501214' },
    '2653': { abbr: 'TROY', name: 'Troy Trojans', short: 'Troy', color: '#862633' },
    '2433': { abbr: 'ULM', name: 'UL Monroe Warhawks', short: 'UL Monroe', color: '#840029' },
    // Pac-12 Conference (Pac-12)
    '204': { abbr: 'ORST', name: 'Oregon State Beavers', short: 'Oregon St', color: '#DC4405' },
    '265': { abbr: 'WSU', name: 'Washington State Cougars', short: 'Washington St', color: '#A60F2D' },
    // FBS Independents (Independents)
    '87': { abbr: 'ND', name: 'Notre Dame Fighting Irish', short: 'Notre Dame', color: '#062340' },
    '41': { abbr: 'CONN', name: 'UConn Huskies', short: 'UConn', color: '#0C2340' },
};

const teamAbbr  = id => TEAMS[id]?.abbr  || '???';
const teamColor = id => TEAMS[id]?.color || '#FFFFFF';
const teamName  = id => TEAMS[id]?.short || teamAbbr(id);

// ── ESPN API ──────────────────────────────────────────────────────────────────
function fetchTeamGame(teamId) {
    // hasOwnProperty (not just truthiness) so a `null` entry — used to force the
    // "No Game" state — is honored instead of falling through to the real API.
    if (Object.prototype.hasOwnProperty.call(DEBUG_FAKE_GAMES, teamId)) {
        return Promise.resolve(DEBUG_FAKE_GAMES[teamId]);
    }

    return new Promise((resolve, reject) => {
        const now = DEBUG_ANCHOR_DATE ? new Date(DEBUG_ANCHOR_DATE) : new Date();
        // Don't roll to the next day's slate until 2am — covers late-running games
        if (!DEBUG_ANCHOR_DATE && now.getHours() < 2) now.setDate(now.getDate() - 1);

        const fmt = d => d.getFullYear() +
            String(d.getMonth() + 1).padStart(2, '0') +
            String(d.getDate()).padStart(2, '0');

        // College football plays roughly one game per team per week, not daily —
        // pull a 21-day window (ten days back, ten days ahead) and pick the most
        // relevant game for this team out of it. This comfortably covers a bye
        // week (real-world max gap observed: ~14 days) with margin to spare,
        // while staying well under ESPN's ~200-event default response cap.
        const start = new Date(now); start.setDate(start.getDate() - 10);
        const end   = new Date(now); end.setDate(end.getDate() + 10);

        const url = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard' +
            '?dates=' + fmt(start) + '-' + fmt(end) + '&groups=80';

        const req = https.get(url, { headers: { 'User-Agent': 'StreamDeckCFBScores/1.0' } }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(parseGames(JSON.parse(body), teamId, now)); }
                catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Request timed out')); });
    });
}

// Pick the single most relevant event for this team out of a multi-week scoreboard:
// a game in progress beats an upcoming game, which beats a past final (so the button
// holds last week's result until the next game appears).
function parseGames(data, teamId, now) {
    try {
        const allEvents = data?.events || [];
        if (!allEvents.length) { log('API: no events in range'); return null; }

        const matches = allEvents.filter(e => {
            const comp = e.competitions && e.competitions[0];
            if (!comp || !comp.competitors) return false;
            return comp.competitors.some(c => String(c.team?.id) === String(teamId));
        });
        if (!matches.length) { log('API: no games found for team', teamId); return null; }

        let best = null, bestRank = -1, bestTime = null;
        for (const e of matches) {
            const comp  = e.competitions[0];
            const state = (comp.status || e.status)?.type?.state;
            const time  = new Date(e.date).getTime();
            const rank  = state === 'in' ? 3 : state === 'pre' ? 2 : 1; // post/final = 1

            if (rank > bestRank) {
                best = e; bestRank = rank; bestTime = time;
            } else if (rank === bestRank) {
                if (rank === 2 && time < bestTime) { best = e; bestTime = time; } // soonest upcoming
                if (rank === 1 && time > bestTime) { best = e; bestTime = time; } // most recent final
            }
        }
        return parseEvent(best, now);
    } catch (e) {
        log('parseGames error:', e.message);
        return null;
    }
}

function parseEvent(e, now) {
    const comp   = e.competitions[0];
    const status = comp.status || e.status || {};
    const type   = status.type || {};
    const state  = type.state;       // 'pre' | 'in' | 'post'
    const name   = type.name || '';  // e.g. STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL

    const away = comp.competitors.find(c => c.homeAway === 'away');
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const awayId = away?.team?.id, homeId = home?.team?.id;
    const awayAbbr = teamAbbr(awayId), homeAbbr = teamAbbr(homeId);
    const matchup  = awayAbbr + ' @ ' + homeAbbr;

    const gcLink = (e.links || []).find(l => (l.text || '').toLowerCase() === 'gamecast') || (e.links || [])[0];
    const link   = gcLink?.href || ('https://www.espn.com/college-football/game/_/gameId/' + e.id);

    const base = { matchup, awayId, homeId, awayAbbr, homeAbbr, eventId: e.id, link };

    if (name.includes('POSTPONED') || name.includes('CANCEL')) return { ...base, state: 'ppd' };
    if (/DELAY/.test(name))                                    return { ...base, state: 'delay' };

    if (state === 'pre') {
        return { ...base, state: 'preview', time: fmtTime(e.date, now) };
    }

    const awayScore = parseInt(away?.score, 10) || 0;
    const homeScore = parseInt(home?.score, 10) || 0;
    const period     = status.period || type.period || 1;

    if (state === 'post') {
        return { ...base, state: 'final', awayScore, homeScore, period };
    }

    // Live — pull down/distance/possession info defensively; ESPN omits `situation`
    // for some early-game states, so everything here gracefully degrades to "unknown".
    const sit         = comp.situation || {};
    const possession  = sit.possession != null ? String(sit.possession) : null;

    return {
        ...base,
        state: 'live',
        awayScore, homeScore, period,
        clock:      status.displayClock || '',
        statusName: name,
        possession,
        isRedZone:  !!sit.isRedZone,
    };
}

function fmtTime(iso, now) {
    try {
        const d   = new Date(iso);
        const day = d.toLocaleDateString([], { weekday: 'short' });

        // More than ~6 days out, "Sat" alone is ambiguous (which Saturday?) — show
        // the actual date instead of a time that's still likely to get adjusted anyway.
        if (now) {
            const diffDays = Math.round((d - now) / 86400000);
            if (diffDays >= 7) {
                const date = d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
                return day + ' ' + date;
            }
        }

        const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return day + ' ' + time;
    } catch (e) { return '?:??'; }
}

// ── SVG button renderer ───────────────────────────────────────────────────────
function escXml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Accepts an array of strings (auto-sized) or { text, fs, color } objects (explicit size).
function makeImage(lines, lineSpacing = 1.4, bgColor = 'black') {
    const W = 72, H = 72, PAD = 4, MAX_W = W - PAD * 2;

    const items = lines.map(l => {
        if (typeof l === 'string') {
            let fs = 16;
            while (fs > 8 && l.length * fs * 0.60 > MAX_W) fs--;
            return { text: l, fs };
        }
        return l;
    });

    const lineHeights = items.map(({ fs }) => fs * lineSpacing);
    const totalH      = lineHeights.reduce((a, b) => a + b, 0);
    let   y           = (H - totalH) / 2 + items[0].fs * 0.80;

    // Lines may carry a `parts` array of exactly 2 segments (e.g.
    // [{text:'UGA',color:brown}, {text:' 21',color:white}]) instead of a single
    // `text` string — used for the live-game score lines so the possession
    // indicator can recolor just the team abbreviation while the score stays
    // white. (A single text-anchor="middle" element with multiple colored
    // <tspan>s is unreliable across SVG renderers and was dropped earlier.)
    //
    // The two segments are anchored on either side of one shared boundary
    // point: the left segment is text-anchor="end" at the boundary (its real
    // right edge lands exactly there) and the right segment is
    // text-anchor="start" at the same boundary (its real left edge lands
    // exactly there). Each renderer positions every segment using its own
    // *actual* glyph widths, so the two can never collide — only the
    // boundary's overall placement depends on our width estimate, and any
    // error there just nudges the whole pair slightly off-center instead of
    // causing an overlap. Both lines always use this same approach regardless
    // of who has the ball, so the text's own position never shifts when
    // possession changes.
    const rows = items.map(({ text, fs, color, parts }, i) => {
        if (i > 0) y += lineHeights[i - 1] - items[i - 1].fs * 0.80 + fs * 0.80;

        if (parts && parts.length === 2) {
            const GAP    = fs * 0.28;   // explicit visual gap — not a space character,
                                        // which renderers can trim and silently lose
            // Real per-glyph widths, not a flat per-char estimate — letters like
            // "U"/"G" are meaningfully wider than "L", so a flat estimate made
            // different team abbreviations land at different true visual
            // centers even though they shared the same boundary formula.
            const w0     = textWidthPx(parts[0].text, fs);
            const w1     = textWidthPx(parts[1].text, fs);
            let boundary = 36 - (w0 + w1 + GAP) / 2 + w0;
            // Defensive clamp: if a renderer's actual glyph widths run wider than
            // our estimate, keep the boundary far enough from each edge that the
            // segment anchored there still has reasonable room, rather than
            // letting the estimate alone push it flush against — or past — PAD.
            const PAD_X = 4;
            boundary = Math.max(boundary, PAD_X + w0);
            boundary = Math.min(boundary, (W - PAD_X) - w1 - GAP);
            return (
                `<text x="${boundary.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" fill="${parts[0].color || color || 'white'}" ` +
                `font-family="Helvetica Neue,Arial,sans-serif" font-size="${fs}" font-weight="600">${escXml(parts[0].text)}</text>` +
                `<text x="${(boundary + GAP).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="start" fill="${parts[1].color || color || 'white'}" ` +
                `font-family="Helvetica Neue,Arial,sans-serif" font-size="${fs}" font-weight="600">${escXml(parts[1].text)}</text>`
            );
        }

        return `<text x="36" y="${y.toFixed(1)}" text-anchor="middle" fill="${color || 'white'}" ` +
               `font-family="Helvetica Neue,Arial,sans-serif" font-size="${fs}" font-weight="600">${escXml(text)}</text>`;
    }).join('');

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="144" height="144" overflow="hidden">` +
        `<rect width="${W}" height="${H}" fill="${bgColor}"/>` +
        rows + `</svg>`;

    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function makeFireworks(frame, winnerColor, winnerName) {
    const W = 72, H = 72;
    const cx = 36, cy = 36;
    const COLORS = [winnerColor, '#FFD700', '#FFFFFF'];

    let circles = '';
    // Overlapping burst waves every 4 frames across the full animation
    [0, 4, 8, 12, 16, 20, 24, 28, 32, 36].forEach((startFrame, burstIdx) => {
        const f = frame - startFrame;
        if (f < 0 || f >= 6) return;
        const progress = f / 5;
        const r        = 5 + progress * 28;
        const pSize    = Math.max(0.5, 3.5 - progress * 2.5);
        const opacity  = (1 - progress * 0.65).toFixed(2);
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45 + burstIdx * 22.5) * Math.PI / 180;
            const px    = (cx + r * Math.cos(angle)).toFixed(1);
            const py    = (cy + r * Math.sin(angle)).toFixed(1);
            const color = COLORS[(i + burstIdx) % COLORS.length];
            circles += `<circle cx="${px}" cy="${py}" r="${pSize.toFixed(1)}" fill="${color}" opacity="${opacity}"/>`;
        }
    });

    // Throbbing text — alternates every 2 frames
    const throb   = Math.floor(frame / 2) % 2 === 0;
    const winSize = throb ? 20 : 16;

    // Auto-size team name to fit the button width
    let nameSize = 13;
    while (nameSize > 7 && winnerName.length * nameSize * 0.62 > 62) nameSize--;
    const nameY = throb ? 25 : 27;

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="144" height="144" overflow="hidden">` +
        `<rect width="${W}" height="${H}" fill="black"/>` +
        circles +
        `<text x="36" y="${nameY}" text-anchor="middle" fill="white" ` +
        `font-family="Helvetica Neue,Arial,sans-serif" font-size="${nameSize}" font-weight="700">${escXml(winnerName)}</text>` +
        `<text x="36" y="50" text-anchor="middle" fill="#FFD700" ` +
        `font-family="Helvetica Neue,Arial,sans-serif" font-size="${winSize}" font-weight="800">WIN!</text>` +
        `</svg>`;

    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function playFireworks(context, winnerName, winnerColor) {
    if (flashing.has(context)) return;
    flashing.add(context);
    log('→ fireworks for', winnerName, winnerColor);
    try {
        for (let i = 0; i < 42; i++) {
            const img = makeFireworks(i, winnerColor, winnerName);
            ws.send(JSON.stringify({ event: 'setImage', context, payload: { image: img, target: 0 } }));
            await sleep(120);
        }
    } finally {
        flashing.delete(context);
        lastRender.delete(context);
        refreshButton(context);
    }
}

function setButton(context, lines, lineSpacing, bgColor) {
    const key = JSON.stringify(lines);
    if (!bgColor && lastRender.get(context) === key) return; // skip if unchanged
    if (!bgColor) lastRender.set(context, key);
    ws.send(JSON.stringify({ event: 'setImage', context, payload: { image: makeImage(lines, lineSpacing, bgColor), target: 0 } }));
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function flashButton(context, color, lines, spacing) {
    if (flashing.has(context)) return;
    flashing.add(context);
    log('→ flash', color);
    try {
        for (let i = 0; i < 4; i++) {
            setButton(context, lines, spacing, color);
            await sleep(200);
            setButton(context, lines, spacing, 'black');
            await sleep(200);
        }
    } finally {
        flashing.delete(context);
        setButton(context, lines, spacing, 'black');
    }
}

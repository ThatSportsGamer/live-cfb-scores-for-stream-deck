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
const zlib   = require('zlib');

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
const instances      = new Map(); // context -> { teamId, teamAbbr, bgColor, bgOpacity }
const prevScores     = new Map(); // context -> { awayScore, homeScore }
const prevState      = new Map(); // context -> last known game state string
const flashing        = new Set(); // contexts mid-flash animation
const refreshing      = new Set(); // contexts mid-async refresh
const lastRender      = new Map(); // context -> JSON key of last rendered lines
const currentGame     = new Map(); // context -> parsed game object | null
const refreshTimers   = new Map(); // context -> timeoutId (self-rescheduling; cadence varies, see scheduleNextRefresh)
const lastPossession  = new Map(); // context -> { eventId, possession, isRedZone } — last known-good possession for the current game

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
            if (refreshTimers.has(context)) clearTimeout(refreshTimers.get(context));
            refreshButton(context);
            scheduleNextRefresh(context);
            break;

        case 'willDisappear':
            instances.delete(context);
            prevScores.delete(context);
            prevState.delete(context);
            lastRender.delete(context);
            currentGame.delete(context);
            refreshing.delete(context);
            flashing.delete(context);
            lastPossession.delete(context);
            if (refreshTimers.has(context)) {
                clearTimeout(refreshTimers.get(context));
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
                log('sendToPlugin — settings:', JSON.stringify(payload.settings));
                instances.set(context, payload.settings);
                lastRender.delete(context);
                refreshButton(context);
            }
            break;
    }
}

// ── Adaptive refresh cadence ───────────────────────────────────────────────────
// Polls every 30 seconds normally, but drops to every 15 seconds once the game
// is inside the two-minute timeout window (last 2:00 of the 2nd or 4th
// quarter) — the stretch where a single missed 30-second window can mean
// skipping right past a score or a clock-management play entirely. Falls
// straight back to 30 seconds the moment the quarter ends. Self-rescheduling
// (setTimeout that re-arms itself after each refresh completes) rather than
// a fixed setInterval, since the right delay can only be known after seeing
// the result of the refresh that just happened.
function nextRefreshDelay(context) {
    const game = currentGame.get(context);
    if (game && game.state === 'live' && (game.period === 2 || game.period === 4)) {
        const secondsLeft = parseClockSeconds(game.clock);
        if (secondsLeft !== null && secondsLeft <= 120) return 15_000;
    }
    return 30_000;
}

function scheduleNextRefresh(context) {
    const delay = nextRefreshDelay(context);
    const timer = setTimeout(async () => {
        await refreshButton(context);
        scheduleNextRefresh(context);
    }, delay);
    refreshTimers.set(context, timer);
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
    log('Refreshing', cfg.teamAbbr || cfg.teamId, '— bg:', JSON.stringify(resolveBgColor(cfg)));
    try {
        const game = await fetchTeamGame(cfg.teamId);
        currentGame.set(context, game || null);

        // Detect live → final transition and play fireworks
        const prevGameState = prevState.get(context);
        prevState.set(context, game ? game.state : null);
        if (prevGameState === 'live' && game && game.state === 'final') {
            const winnerIsHome = game.homeScore >= game.awayScore;
            const winnerName   = winnerIsHome ? game.homeName  : game.awayName;
            const winnerColor  = winnerIsHome ? game.homeColor : game.awayColor;
            log('Game over — fireworks for', winnerName);
            refreshing.delete(context);
            playFireworks(context, winnerName, winnerColor).catch(e => log('fireworks error:', e.message));
            return;
        }

        // ESPN's `situation` block (possession/red zone) occasionally goes blank
        // for a single poll right around a scoring play — e.g. during an extra
        // point attempt, right after the touchdown that preceded it — even
        // though the game is still very much live. Without this, that gap
        // reads as "nobody has the ball" and the possession indicator visibly
        // flashes to white and back, which looks like a bug rather than what
        // it is (a brief upstream data gap). So: hold onto the last known-good
        // possession for this specific game (matched by eventId, so a stale
        // value never leaks into a *different* game) and fall back to it only
        // when the fresh fetch came back empty.
        //
        // Halftime is deliberately excluded from that fallback — it's the same
        // "situation is blank" shape as a PAT gap, but the blank stretch can
        // run 15-20 real minutes with genuinely nobody holding the ball, so
        // carrying forward whoever had it before the half would be actively
        // misleading rather than smoothing over a blip. It's cleared here and
        // re-armed naturally once real possession data resumes for the second half.
        if (game && game.state === 'live') {
            if (game.possession != null) {
                lastPossession.set(context, { eventId: game.eventId, possession: game.possession, isRedZone: game.isRedZone });
            } else if (game.statusName !== 'STATUS_HALFTIME') {
                const last = lastPossession.get(context);
                if (last && last.eventId === game.eventId) {
                    game.possession = last.possession;
                    game.isRedZone  = last.isRedZone;
                }
            }
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
                        : awayScored ? game.awayColor
                                     : game.homeColor;
                    log('Score change — flashing', color);
                    refreshing.delete(context);
                    flashButton(context, color, lines, spacing, resolveBgColor(cfg)).catch(e => log('flashButton error:', e.message));
                    return;
                }
            }
        } else {
            prevScores.delete(context);
        }

        setButton(context, lines, spacing, resolveBgColor(cfg));
    } catch (err) {
        log('Fetch error:', err.message);
        setButton(context, [cfg.teamAbbr || 'CFB', 'Err'], undefined, resolveBgColor(cfg));
    } finally {
        refreshing.delete(context);
    }
}

// ── Text sizing helper — shrink font until the line fits the button width ─────
// Uses the real Helvetica glyph-width table (see GLYPH_WIDTH_1000/textWidthPx
// below) instead of a flat per-char estimate, so wide abbreviations like
// "WMU" or "MTSU" get sized just as precisely as narrow ones like "LSU".
function fitFs(text, maxFs) {
    let fs = maxFs;
    while (fs > 9 && textWidthPx(text, fs) > 64) fs--;
    return fs;
}

// ── Fixed size tiers for the live/final score lines ────────────────────────
// Every FBS abbreviation ESPN sends is 2-4 characters, so two fixed sizes
// cover the whole roster: 17pt for 2-3 letter abbrs, 16pt for the wider
// 4-letter ones.
// A handful of unusually wide 3-letter abbrs (MEM, HAW, WYO, WKU, WMU) can
// still run wide at 17pt once paired with a double-digit score, so fitFs()
// is used as a per-game fallback — it only shrinks further for the specific
// combos that actually need it, rather than shrinking every game.
function baseTierFs(abbr) {
    return abbr.length >= 4 ? 16 : 17;
}

// Real Helvetica-Bold glyph widths (per 1000 em units, from the standard AFM
// metrics) — used by fitFs()/textWidthPx() above to decide whether an
// "ABBR SCORE" combo actually fits the button at a given font size. A flat
// "every char is 0.6em" estimate treats e.g. "UGA" and "ALA" as equal width,
// but U/G are notably wider than L, which made fitFs() over- or under-shrink
// some matchups. (Centering itself is handled by the device's own renderer
// via a single text-anchor="middle" element — see makeImage — so this table
// no longer factors into centering, only sizing.) Digits are all the same
// width in Helvetica (tabular figures), so scores were never the issue. This
// table only needs to cover what can actually appear here: A-Z
// (abbreviations) and 0-9 (scores).
const GLYPH_WIDTH_1000 = {
    A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
    J: 556, K: 722, L: 611, M: 889, N: 722, O: 778, P: 667, Q: 778, R: 722,
    S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
    '&': 778, '-': 333, // covers the two non-alpha FBS abbrs: TA&M, M-OH
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
    if (game.state === 'bye') return [abbr, 'BYE WEEK'];

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

// Team abbreviation, short name, and primary color are no longer a
// maintained lookup table here — they're read directly off each event's own
// team objects in parseEvent() below, straight from ESPN's live scoreboard
// response. The property inspector's team picker (property-inspector.html)
// separately fetches ESPN's full FBS standings live on load for its
// searchable list of all 136 teams (which don't all appear on any single
// scoreboard poll), falling back to a bundled static list only if that
// fetch fails.

// ── "Hold the final" cutoff ─────────────────────────────────────────────────
// A finished game keeps winning over an upcoming preview until the next
// Monday, 3:00 AM ET, following that specific final — a fixed weekly rule
// that needs no extra API call, since it's a pure date calculation. Picked
// (rather than matching ESPN's own Tuesday week boundary) so that Monday
// morning — when people are sitting down at their desk for the week — still
// shows last week's final instead of jumping straight to next week's
// still-empty preview. Anchored to the final's own kickoff date rather than
// to "now" so it can't silently re-arm itself forever — recomputing "next
// Monday 3am from right now" on every poll would, the moment one Monday 3am
// passes, immediately resolve to the *following* Monday and never actually
// let the preview take over.
//
// Uses local system time, same assumption as the "don't roll to next day
// until 2am" logic above — this only produces the intended result if the
// host machine's clock is set to US Eastern time.
function nextMonday3amAfter(fromMs) {
    const day       = new Date(fromMs).getDay(); // 0=Sun ... 1=Mon ... 6=Sat
    const daysUntil = (1 - day + 7) % 7;          // 0 if `fromMs` itself falls on a Monday
    const candidate = new Date(fromMs);
    candidate.setDate(candidate.getDate() + daysUntil);
    candidate.setHours(3, 0, 0, 0);
    if (candidate.getTime() <= fromMs) candidate.setDate(candidate.getDate() + 7); // already past this Monday's 3am
    return candidate.getTime();
}

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
        // pull a 17-day window (seven days back, ten days ahead) and pick the
        // most relevant game for this team out of it. Only a week's worth of
        // look-back is needed: a new CFB week starts Monday 3am ET, and by then
        // there's nothing useful further back than the prior week's final (which
        // the hold-final cutoff already stops showing at that same boundary).
        // Look-ahead stays at ten days to comfortably cover a bye week
        // (real-world max gap observed: ~14 days) with margin to spare, while
        // staying well under ESPN's ~200-event default response cap.
        const start = new Date(now); start.setDate(start.getDate() - 7);
        const end   = new Date(now); end.setDate(end.getDate() + 10);

        const url = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard' +
            '?dates=' + fmt(start) + '-' + fmt(end) + '&groups=80';

        // ESPN's edge (Akamai) started rejecting requests that don't look like a
        // real browser — a bare custom User-Agent with no Accept/Accept-Encoding
        // was getting a 403 "Access Denied" HTML page back instead of JSON. A
        // realistic browser header set (including Accept-Encoding, which the
        // response is then actually compressed with) is what gets a real 200.
        const reqHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
        };

        const req = https.get(url, { headers: reqHeaders }, res => {
            if (res.statusCode !== 200) {
                res.resume(); // drain so the socket can be reused/closed cleanly
                reject(new Error('HTTP ' + res.statusCode));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                try {
                    let buf = Buffer.concat(chunks);
                    const enc = res.headers['content-encoding'];
                    if (enc === 'gzip')        buf = zlib.gunzipSync(buf);
                    else if (enc === 'br')     buf = zlib.brotliDecompressSync(buf);
                    else if (enc === 'deflate') buf = zlib.inflateSync(buf);
                    resolve(parseGames(JSON.parse(buf.toString('utf8')), teamId, now));
                } catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Request timed out')); });
    });
}

// Pick the single most relevant event for this team out of a multi-week scoreboard:
// a game in progress beats an upcoming game, which beats a past final (so the button
// holds last week's result until the next game appears) — EXCEPT that a final keeps
// beating an upcoming preview until the following Monday, 3:00 AM ET (see
// nextMonday3amAfter above). Without this, a final score gets replaced by next
// week's matchup the instant the next game is close enough to be visible in the
// rolling window.
function parseGames(data, teamId, now) {
    try {
        const allEvents = data?.events || [];
        if (!allEvents.length) { log('API: no events in range'); return null; }

        const matches = allEvents.filter(e => {
            const comp = e.competitions && e.competitions[0];
            if (!comp || !comp.competitors) return false;
            return comp.competitors.some(c => String(c.team?.id) === String(teamId));
        });
        if (!matches.length) {
            // Other teams have games in this window but this one doesn't — under
            // normal weekly cadence that can't happen (the 17-day rolling window
            // comfortably spans a ~7-day gap between games), so an empty `matches`
            // alongside a non-empty `allEvents` specifically means this team has
            // a bye. (Known limitation: a team done for the year during bowl
            // season while others still play on would also read as empty-matches
            // and get mislabeled BYE WEEK — rare, and only relevant in December.)
            log('API: no games found for team', teamId, '— treating as bye week');
            return { state: 'bye' };
        }

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

        // No game is currently live — check whether this team's most recent
        // final is still inside its hold window (before the next Monday
        // 3am ET that follows it) and, if so, prefer it over an upcoming
        // preview regardless of the rank ordering above.
        if (bestRank !== 3) {
            let recentFinal = null, recentFinalTime = -1;
            for (const e of matches) {
                const comp  = e.competitions[0];
                const state = (comp.status || e.status)?.type?.state;
                if (state !== 'post') continue;
                const time = new Date(e.date).getTime();
                if (time > recentFinalTime) { recentFinal = e; recentFinalTime = time; }
            }
            if (recentFinal && Date.now() < nextMonday3amAfter(recentFinalTime)) best = recentFinal;
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

    // Abbreviation/name/color come straight off this event's own team objects
    // rather than a lookup table — ESPN's scoreboard response already
    // includes them per team on every poll, so this is inherently live data
    // (it updates the moment ESPN's own records do, e.g. a mid-season
    // rebrand) with no extra API call or maintained team list required.
    const awayAbbr  = away?.team?.abbreviation || '???';
    const homeAbbr  = home?.team?.abbreviation || '???';
    const awayName  = away?.team?.shortDisplayName || awayAbbr;
    const homeName  = home?.team?.shortDisplayName || homeAbbr;
    const awayColor = away?.team?.color ? '#' + away.team.color : '#FFFFFF';
    const homeColor = home?.team?.color ? '#' + home.team.color : '#FFFFFF';
    const matchup   = awayAbbr + ' @ ' + homeAbbr;

    const gcLink = (e.links || []).find(l => (l.text || '').toLowerCase() === 'gamecast') || (e.links || [])[0];
    const link   = gcLink?.href || ('https://www.espn.com/college-football/game/_/gameId/' + e.id);

    const base = {
        matchup, awayId, homeId, awayAbbr, homeAbbr, awayName, homeName, awayColor, homeColor,
        eventId: e.id, link
    };

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

// Turns a user-chosen hex color + opacity (0-100) from the property inspector
// into a fill/opacity pair the SVG <rect> can use directly. Falls back to
// plain black for anyone who hasn't set a custom background — same look as
// before this feature existed. This is deliberately only applied to the
// steady-state button (pre-game/live/final/err) — the score-flash and
// end-of-game fireworks effects keep using their own dynamic colors on top
// of it.
// Returns { fill, opacity } instead of a single rgba(...) string on purpose —
// this device's SVG renderer doesn't reliably implement the full SVG/CSS
// spec (see the tspan gap note in makeImage below), so a plain hex `fill`
// plus a separate numeric `fill-opacity` attribute is the safer bet than
// relying on functional color notation like rgba() being parsed.
function resolveBgColor(cfg) {
    if (!cfg || !cfg.bgColor) return { fill: 'black', opacity: 1 };
    const hex = String(cfg.bgColor).replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { fill: 'black', opacity: 1 };
    const opacityPct = cfg.bgOpacity != null ? Number(cfg.bgOpacity) : 100;
    const opacity     = Math.max(0, Math.min(100, isNaN(opacityPct) ? 100 : opacityPct)) / 100;
    return { fill: '#' + hex, opacity };
}

// Accepts an array of strings (auto-sized) or { text, fs, color } objects (explicit size).
function makeImage(lines, lineSpacing = 1.4, bgColor = 'black', bgOpacity = 1) {
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
    // white.
    //
    // Both segments live inside ONE text-anchor="middle" element as colored
    // <tspan>s, so the renderer centers the combined width using its own
    // real glyph measurements — the same mechanism that already centers the
    // plain clock line correctly, and the only way to get pixel-accurate
    // centering on a device whose actual font metrics we can't know in
    // advance. (An earlier version manually anchored two separate <text>
    // elements at a boundary point computed from an assumed glyph-width
    // table; that math was internally symmetric but still depended on our
    // estimate matching the real renderer's measurements, which is exactly
    // what made abbreviation/score pairs visibly drift off-center on real
    // hardware.) The gap between the two segments is a literal space
    // character in the second tspan's own text content — not a `dx` offset,
    // which real hardware silently ignored — combined with
    // `xml:space="preserve"` on the parent <text> so that space survives
    // instead of being trimmed as ordinary XML whitespace.
    const rows = items.map(({ text, fs, color, parts }, i) => {
        if (i > 0) y += lineHeights[i - 1] - items[i - 1].fs * 0.80 + fs * 0.80;

        if (parts && parts.length === 2) {
            return (
                `<text x="36" y="${y.toFixed(1)}" text-anchor="middle" xml:space="preserve" ` +
                `font-family="Helvetica Neue,Arial,sans-serif" font-size="${fs}" font-weight="600">` +
                `<tspan fill="${parts[0].color || color || 'white'}">${escXml(parts[0].text)}</tspan>` +
                `<tspan fill="${parts[1].color || color || 'white'}"> ${escXml(parts[1].text)}</tspan>` +
                `</text>`
            );
        }

        return `<text x="36" y="${y.toFixed(1)}" text-anchor="middle" fill="${color || 'white'}" ` +
               `font-family="Helvetica Neue,Arial,sans-serif" font-size="${fs}" font-weight="600">${escXml(text)}</text>`;
    }).join('');

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="144" height="144" overflow="hidden">` +
        `<rect width="${W}" height="${H}" fill="${bgColor}" fill-opacity="${bgOpacity}"/>` +
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

// bgColor may be a plain CSS color string (flash colors, 'black') or a
// { fill, opacity } object (resolveBgColor's output) — normalized to the
// latter here so makeImage always gets a fill string + numeric opacity.
function setButton(context, lines, lineSpacing, bgColor, force) {
    const bg = (bgColor && typeof bgColor === 'object') ? bgColor : { fill: bgColor || 'black', opacity: 1 };
    const key = JSON.stringify({ lines, bg });
    if (!force) {
        if (lastRender.get(context) === key) return; // skip if unchanged
        lastRender.set(context, key);
    }
    ws.send(JSON.stringify({ event: 'setImage', context, payload: { image: makeImage(lines, lineSpacing, bg.fill, bg.opacity), target: 0 } }));
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function flashButton(context, color, lines, spacing, restColor = 'black') {
    if (flashing.has(context)) return;
    flashing.add(context);
    log('→ flash', color);
    try {
        for (let i = 0; i < 4; i++) {
            setButton(context, lines, spacing, color, true);
            await sleep(200);
            setButton(context, lines, spacing, restColor, true);
            await sleep(200);
        }
    } finally {
        flashing.delete(context);
        setButton(context, lines, spacing, restColor, true);
    }
}

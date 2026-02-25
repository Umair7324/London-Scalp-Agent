import { LondonScalpEngine } from './LondonScalpEngine.js';

// ═══════════════════════════════════════════════════════════════
// LONDON SCALP AGENT — Main Entry Point
// Session: 07:00-08:00 UTC Mon-Fri (London open first hour)
// Settings: RR 1.5 | ATR 0.8 | MaxPB 0.3 | WR 53.3% | PF 1.71
// Run: node src/london_index.js
// ═══════════════════════════════════════════════════════════════

const SYMBOLS  = (process.env.SCALP_WATCHLIST || 'XAU/USD').split(',').map(s => s.trim());
const API_KEY  = process.env.TWELVEDATA_API_KEY;
const DISCORD  = process.env.DISCORD_WEBHOOK_URL;

const engine   = new LondonScalpEngine();
const refresh5m = {}; // { symbol: lastRefreshTs }

// ── Discord ──
async function notify(msg) {
  if (!DISCORD) return;
  try {
    await fetch(DISCORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch {}
}

// ── Fetch candles ──
async function fetch1m(symbol) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1min&outputsize=35&apikey=${API_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.values) return null;
  return data.values.reverse().map(v => ({
    ts: new Date(v.datetime + 'Z').getTime(),
    open: parseFloat(v.open), high: parseFloat(v.high),
    low:  parseFloat(v.low),  close: parseFloat(v.close),
    o: parseFloat(v.open), h: parseFloat(v.high),
    l: parseFloat(v.low),  c: parseFloat(v.close),
  }));
}

async function fetch5m(symbol) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=5min&outputsize=70&apikey=${API_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.values) return null;
  return data.values.reverse().map(v => ({
    ts: new Date(v.datetime + 'Z').getTime(),
    open: parseFloat(v.open), high: parseFloat(v.high),
    low:  parseFloat(v.low),  close: parseFloat(v.close),
    o: parseFloat(v.open), h: parseFloat(v.high),
    l: parseFloat(v.low),  c: parseFloat(v.close),
  }));
}

// ── Signal Discord message ──
function formatSignalMsg(symbol, result, price) {
  const s = result.signal;
  const t = result.trade;
  return [
    `🔴 **LONDON SCALP SELL — ${symbol}**`,
    `💰 Entry: \`${price.toFixed(2)}\` | SL: \`${t.sl.toFixed(2)}\` | TP: \`${t.tp.toFixed(2)}\``,
    `📊 RR: 1.5 | Risk: ${t.risk.toFixed(2)} pts | Confidence: ${s.confidence}%`,
    `📈 ATR: ${s.atr.toFixed(2)} | RSI: ${s.rsi?.toFixed(0)} | Stoch: ${s.stochK?.toFixed(0)}`,
    `✅ ${s.reasons?.join(' | ')}`,
    `🕐 London Open Session | ${new Date().toUTCString()}`,
  ].join('\n');
}

// ── MAIN ──
async function run() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       LONDON SCALP AGENT v1 — SELL-ONLY PULLBACK            ║');
  console.log(`║  Symbols: ${SYMBOLS.join(', ').padEnd(50)}║`);
  console.log('║  Session: 07:00-08:00 UTC | RR: 1.5 | WR: 53.3% (backtest) ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── Warm up ──
  console.log('📥 Loading historical data...');
  for (const symbol of SYMBOLS) {
    const c1m = await fetch1m(symbol);
    const c5m = await fetch5m(symbol);
    if (c1m) engine.load1mCandles(symbol, c1m);
    if (c5m) engine.load5mCandles(symbol, c5m);
    refresh5m[symbol] = Date.now();
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log('✅ Warmed up\n');

  // ── Poll every 60 seconds ──
  console.log('⏱ Polling every 60 seconds...\n');
  setInterval(async () => {
    const hour = new Date().getUTCHours();

    // Fetch slightly wider window (06:55-08:05) to catch edges
    if (hour < 6 || hour > 8) return;

    for (const symbol of SYMBOLS) {
      try {
        const c1m = await fetch1m(symbol);
        if (!c1m || !c1m.length) continue;

        const latest = c1m[c1m.length - 1];
        const price  = latest.close;

        engine.load1mCandles(symbol, c1m);

        // Refresh 5m every 4 minutes
        if (Date.now() - (refresh5m[symbol] || 0) > 4 * 60000) {
          const c5m = await fetch5m(symbol);
          if (c5m) engine.load5mCandles(symbol, c5m);
          refresh5m[symbol] = Date.now();
        }

        // Resolve open trade
        const resolved = engine.resolveOpenTrade(symbol, latest);
        if (resolved) {
          const emoji = resolved.result === 'WIN' ? '✅' : resolved.result === 'EXPIRED' ? '⏰' : '❌';
          const msg   = `${emoji} London trade closed: ${symbol} | ${resolved.result} | ${resolved.rPnL > 0 ? '+' : ''}${resolved.rPnL}R`;
          console.log(msg);
          await notify(msg);
        }

        // Generate signal
        const result = engine.generateSignal(symbol, price);
        console.log(`[${new Date().toUTCString()}] ${symbol} @ ${price.toFixed(2)} → ${result.action}`);

        if (result.action === 'SELL') {
          console.log(`   🔴 LONDON SELL! Conf: ${result.signal.confidence}% | SL: ${result.trade.sl.toFixed(2)} | TP: ${result.trade.tp.toFixed(2)}`);
          console.log(`   Reasons: ${result.signal.reasons?.join(', ')}`);
          await notify(formatSignalMsg(symbol, result, price));
        } else {
          if (process.env.DEBUG_MODE === 'true') console.log(`   ⏸ ${result.reason}`);
        }

        await new Promise(r => setTimeout(r, 1200));
      } catch (err) {
        console.error(`Error processing ${symbol}:`, err.message);
      }
    }

    // Stats at end of session (08:00 UTC)
    if (new Date().getUTCHours() === 8 && new Date().getUTCMinutes() === 0) {
      const s = engine.getStats();
      const msg = `📊 London Session Done | ${s.wins}W ${s.losses}L | WR: ${s.winRate}% | PF: ${s.profitFactor} | ${s.totalR.toFixed(1)}R total`;
      console.log('\n' + msg + '\n');
      await notify(msg);
    }
  }, 60000);
}

run().catch(console.error);
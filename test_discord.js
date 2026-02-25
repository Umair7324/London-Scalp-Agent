// ── Discord Webhook Test ──
// Run: node test_discord.js
// Tests both London scalp signal format + trade close format

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1476014987603480730/oUafnuOGO-4NtlwJa4Tf5CKgBnQUbeB8hJjmzPbfLTLZkLmhaXDGEe_QCmG5BtcSkVFx';

async function send(msg) {
  const res = await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: msg }),
  });
  console.log(`Sent: ${res.status === 204 ? '✅ Success' : '❌ Failed - ' + res.status}`);
}

async function runTests() {
  console.log('🔔 Testing Discord notifications...\n');

  // Test 1: SELL Signal
  await send([
    `🔴 **LONDON SCALP SELL — XAU/USD** *(TEST)*`,
    `💰 Entry: \`3285.40\` | SL: \`3288.20\` | TP: \`3281.20\``,
    `📊 RR: 1.5 | Risk: 2.80 pts | Confidence: 78%`,
    `📈 ATR: 3.50 | RSI: 62 | Stoch: 71`,
    `✅ Perfect EMA21 tap | Fresh stoch cross | MACD accelerating down`,
    `🕐 London Open Session | ${new Date().toUTCString()}`,
  ].join('\n'));

  await new Promise(r => setTimeout(r, 1000));

  // Test 2: WIN close
  await send(`✅ London trade closed: XAU/USD | WIN | +1.5R *(TEST)*`);

  await new Promise(r => setTimeout(r, 1000));

  // Test 3: LOSS close
  await send(`❌ London trade closed: XAU/USD | LOSS | -1R *(TEST)*`);

  await new Promise(r => setTimeout(r, 1000));

  // Test 4: Session summary
  await send(`📊 London Session Done | 1W 0L | WR: 100% | PF: ∞ | 1.5R total *(TEST)*`);

  console.log('\n✅ All test messages sent! Check your Discord channel.');
}

runTests().catch(console.error);
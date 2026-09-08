async function runAll() {
  const scenarios = [
    'RAPID_DICE',
    'RAPID_TOKEN_CLICKS',
    'CONCURRENT_MOVES',
    'RATE_LIMIT_CHAT',
    'RATE_LIMIT_REACTIONS',
    'RECONNECT_RECOVERY',
    'ROOM_FULL',
    'MATCHMAKING_CANCELLATION',
    'HOST_MIGRATION',
    'SIMULATE_2_PLAYER',
    'SIMULATE_4_PLAYER',
  ];

  console.log(`Starting Multiplayer Stress Test Suite (${scenarios.length} scenarios)...`);
  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    try {
      process.stdout.write(`Testing [${scenario}]... `);
      const res = await fetch('http://localhost:3000/api/dev/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.log(`FAILED (HTTP ${res.status}): ${text}`);
        failed++;
        continue;
      }

      const result = await res.json();
      if (result.passed) {
        console.log(`PASSED - ${result.details}`);
        passed++;
      } else {
        console.log(`FAILED - ${result.details}`);
        failed++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log('\n=======================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${scenarios.length})`);
  console.log('=======================================');
  if (failed > 0) process.exit(1);
}

runAll();

/**
 * Multiplayer Stress Test Utility for Ludo Royale
 * DEVELOPMENT ONLY — Completely disabled in production builds.
 * Simulates multiple players, rapid actions, concurrency, and connection drops.
 */

export interface StressTestScenarioResult {
  scenario: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
  subResults?: Array<{ step: string; passed: boolean; message: string }>;
}

export interface StressTestSuiteSummary {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  scenarios: StressTestScenarioResult[];
}

export class StressTestRunner {
  private isRunning = false;

  public isDevEnvironment(): boolean {
    return Boolean(import.meta.env.DEV);
  }

  /**
   * Run the complete stress test suite via dev-only API endpoint
   */
  public async runFullSuite(onProgress?: (progress: string) => void): Promise<StressTestSuiteSummary | null> {
    if (!this.isDevEnvironment()) {
      console.warn('[StressTestRunner] Stress testing is strictly disabled in production.');
      return null;
    }

    if (this.isRunning) {
      throw new Error('A stress test run is already in progress.');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const scenarios: StressTestScenarioResult[] = [];

    try {
      onProgress?.('Initializing Stress Test Suite...');

      // 1. Rapid Action Spam Test (Dice)
      onProgress?.('Testing Rapid Dice Roll Spam & Rate Limiting...');
      const spamTest = await this.runScenario('RAPID_DICE');
      scenarios.push(spamTest);

      // 2. Rapid Action Spam Test (Token)
      onProgress?.('Testing Rapid Token Moves...');
      const tokenSpamTest = await this.runScenario('RAPID_TOKEN_CLICKS');
      scenarios.push(tokenSpamTest);

      // 3. Concurrent Moves Atomic Lock Test
      onProgress?.('Testing Concurrent Moves & Race Condition Protection...');
      const concurrentTest = await this.runScenario('CONCURRENT_MOVES');
      scenarios.push(concurrentTest);

      // 4. Chat Rate Limiter Spam Test
      onProgress?.('Testing Chat Rate Limiter & Message Bounds...');
      const chatTest = await this.runScenario('RATE_LIMIT_CHAT');
      scenarios.push(chatTest);

      // 5. Reaction Rate Limiter Test
      onProgress?.('Testing Reaction Rate Limiter...');
      const reactionTest = await this.runScenario('RATE_LIMIT_REACTIONS');
      scenarios.push(reactionTest);

      // 6. State Recovery & Reconnection Resilience Test
      onProgress?.('Testing State Recovery & Reconnection Resilience...');
      const reconnectTest = await this.runScenario('RECONNECT_RECOVERY');
      scenarios.push(reconnectTest);

      // 7. Room Full Capacity Protection
      onProgress?.('Testing Room Full Capacity Protection...');
      const roomFullTest = await this.runScenario('ROOM_FULL');
      scenarios.push(roomFullTest);

      // 8. Matchmaking Cancellation Test
      onProgress?.('Testing Matchmaking Cancellation Cleanliness...');
      const mmCancelTest = await this.runScenario('MATCHMAKING_CANCELLATION');
      scenarios.push(mmCancelTest);

      // 9. Host Migration Test
      onProgress?.('Testing Automatic Host Migration on Disconnect...');
      const hostMigrateTest = await this.runScenario('HOST_MIGRATION');
      scenarios.push(hostMigrateTest);

      // 10. 2-Player Match Simulation
      onProgress?.('Testing 2-Player Match Flow & Token Progression...');
      const twoPlayerTest = await this.runScenario('SIMULATE_2_PLAYER');
      scenarios.push(twoPlayerTest);

      // 11. 4-Player Match Simulation
      onProgress?.('Testing 4-Player Match Flow & Inactive Player Bypass...');
      const fourPlayerTest = await this.runScenario('SIMULATE_4_PLAYER');
      scenarios.push(fourPlayerTest);

      onProgress?.('Stress test suite completed.');
    } catch (err: any) {
      console.error('[StressTestRunner] Suite failed:', err);
    } finally {
      this.isRunning = false;
    }

    const durationMs = Date.now() - startTime;
    const passedTests = scenarios.filter((s) => s.passed).length;
    const failedTests = scenarios.filter((s) => !s.passed).length;

    return {
      timestamp: new Date().toISOString(),
      totalTests: scenarios.length,
      passedTests,
      failedTests,
      durationMs,
      scenarios,
    };
  }

  private async runScenario(scenario: string): Promise<StressTestScenarioResult> {
    const start = Date.now();
    try {
      const res = await fetch('/api/dev/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          scenario,
          name: this.getScenarioName(scenario),
          passed: false,
          durationMs: Date.now() - start,
          details: errorData.error || `HTTP ${res.status}: Server rejected request`,
        };
      }

      const data = await res.json();
      return {
        scenario,
        name: this.getScenarioName(scenario),
        passed: !!data.passed,
        durationMs: Date.now() - start,
        details: data.details || 'Scenario completed',
        subResults: data.subResults,
      };
    } catch (err: any) {
      return {
        scenario,
        name: this.getScenarioName(scenario),
        passed: false,
        durationMs: Date.now() - start,
        details: err.message || 'Network error during test execution',
      };
    }
  }

  private getScenarioName(scenario: string): string {
    switch (scenario) {
      case 'RAPID_DICE':
        return 'Rapid Action Spam Protection (Dice)';
      case 'RAPID_TOKEN_CLICKS':
        return 'Rapid Action Spam Protection (Token)';
      case 'CONCURRENT_MOVES':
        return 'Concurrent Move Mutex & Atomic Locking';
      case 'RATE_LIMIT_CHAT':
        return 'Chat Spam Limiter & Character Bounds';
      case 'RATE_LIMIT_REACTIONS':
        return 'Reaction Spam Flooding Protection';
      case 'RECONNECT_RECOVERY':
        return 'WebSocket Disconnect & Game State Recovery';
      case 'ROOM_FULL':
        return 'Room Full Protection (Max 4 Players)';
      case 'MATCHMAKING_CANCELLATION':
        return 'Matchmaking Cancellation Cleanliness';
      case 'HOST_MIGRATION':
        return 'Automatic Host Migration on Disconnect';
      case 'SIMULATE_2_PLAYER':
        return '2-Player Multiplayer Flow & Rules';
      case 'SIMULATE_4_PLAYER':
        return '4-Player Multiplayer Flow & Turn Bypass';
      default:
        return scenario;
    }
  }
}

export const stressTestRunner = new StressTestRunner();

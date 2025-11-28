/**
 * Session Continuation Test
 *
 * This test validates that saved sessions can be loaded and continued properly.
 * It loads a session from the 10-minute test and continues gameplay for additional turns.
 *
 * Usage: npx tsx tests/session_continuation_test.ts <sessionId>
 */

import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import { AIPlayer } from '../src/systems/AIPlayer';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');
const CONTINUATION_DURATION_MS = 3 * 60 * 1000; // 3 minutes continuation
const ADDITIONAL_TURNS = 5; // Continue for 5 more turns

interface ContinuationResult {
  sessionId: string;
  originalTurnCount: number;
  loadedTurnCount: number;
  additionalTurns: number;
  totalTurns: number;
  loadTime: number;
  continuationTime: number;
  success: boolean;
  errors: string[];
  stateValidation: {
    playerName: boolean;
    worldState: boolean;
    characterState: boolean;
    turnContinuity: boolean;
  };
}

class SessionContinuationTest {
  private sessionId: string;
  private gameMaster: GameMaster | null = null;
  private aiPlayer: AIPlayer | null = null;
  private results: ContinuationResult;
  private startTime: number = 0;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.results = {
      sessionId,
      originalTurnCount: 0,
      loadedTurnCount: 0,
      additionalTurns: 0,
      totalTurns: 0,
      loadTime: 0,
      continuationTime: 0,
      success: false,
      errors: [],
      stateValidation: {
        playerName: false,
        worldState: false,
        characterState: false,
        turnContinuity: false
      }
    };
  }

  async run(): Promise<ContinuationResult> {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                SESSION CONTINUATION TEST                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📂 Loading session: ${this.sessionId}`);
    console.log('');

    this.startTime = Date.now();

    try {
      await this.loadSession();
      await this.validateLoadedState();
      await this.continueGameplay();
      await this.finalSave();

      this.results.success = this.results.errors.length === 0;

    } catch (error: any) {
      console.error('💥 Test failed:', error.message);
      this.results.errors.push(`Fatal error: ${error.message}`);
      this.results.success = false;
    }

    this.printReport();
    return this.results;
  }

  private async loadSession() {
    console.log('🔄 Loading session...');

    const loadStart = Date.now();

    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_PATH)) {
      throw new Error(`Storage path does not exist: ${STORAGE_PATH}`);
    }

    const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);

    // Initialize with Granite4:3b
    const llmProvider = new OllamaAdapter({
      model: 'granite4:3b',
      host: 'http://127.0.0.1:11434'
    });

    this.gameMaster = new GameMaster(this.sessionId, llmProvider, sessionWriter, sessionLoader);
    this.aiPlayer = new AIPlayer(llmProvider);

    await this.gameMaster.loadState();
    this.results.loadTime = Date.now() - loadStart;
    console.log(`✅ Session loaded in ${(this.results.loadTime / 1000).toFixed(1)}s`);
  }

  private async validateLoadedState() {
    if (!this.gameMaster) {
      throw new Error('GameMaster not initialized');
    }

    console.log('🔍 Validating loaded state...');

    const context = this.gameMaster.getAIPlayerContext();

    // Check player name
    if (context.player?.name) {
      this.results.stateValidation.playerName = true;
      console.log(`   ✅ Player: ${context.player.name}`);
    } else {
      this.results.errors.push('Player name not found in loaded state');
      console.log('   ❌ Player name missing');
    }

    // Check world state
    if (context.worldState?.currentLocation?.id) {
      this.results.stateValidation.worldState = true;
      console.log(`   ✅ Location: ${context.worldState.currentLocation.name || context.worldState.currentLocation.id}`);
    } else {
      this.results.errors.push('World state/location not found in loaded state');
      console.log('   ❌ World state missing');
    }

    // Check character state
    if (context.player?.aspects && context.player.aspects.length > 0) {
      this.results.stateValidation.characterState = true;
      console.log(`   ✅ Character: ${context.player.aspects.length} aspects loaded`);
    } else {
      this.results.errors.push('Character aspects not found in loaded state');
      console.log('   ❌ Character state missing');
    }

    // Get turn count from loaded session (use history length)
    try {
      // Access the private history through the context
      const context = this.gameMaster.getAIPlayerContext();
      this.results.loadedTurnCount = context.history?.length || 0;
      this.results.originalTurnCount = this.results.loadedTurnCount; // Assume this is the original count
      console.log(`   ✅ Turns: ${this.results.loadedTurnCount} turns loaded`);
    } catch (error: any) {
      this.results.errors.push(`Failed to get turn count: ${error.message}`);
      console.log('   ❌ Could not determine turn count');
    }

    // Validate turn continuity (basic check)
    if (this.results.loadedTurnCount > 0) {
      this.results.stateValidation.turnContinuity = true;
      console.log('   ✅ Turn continuity validated');
    } else {
      this.results.errors.push('No turns found in loaded session');
      console.log('   ❌ No turns in session');
    }

    const validationScore = Object.values(this.results.stateValidation).filter(Boolean).length;
    console.log(`   📊 State validation: ${validationScore}/4 checks passed`);
  }

  private async continueGameplay() {
    if (!this.gameMaster || !this.aiPlayer) {
      throw new Error('Game not properly initialized');
    }

    console.log('');
    console.log('🎮 Continuing gameplay...');
    console.log(`   Target: ${ADDITIONAL_TURNS} additional turns`);
    console.log('');

    const continuationStart = Date.now();
    let turnCount = 0;

    // Continue for specified number of turns or time limit
    while (turnCount < ADDITIONAL_TURNS && (Date.now() - continuationStart) < CONTINUATION_DURATION_MS) {
      const turnStart = Date.now();
      turnCount++;

      console.log(`🔄 Turn ${this.results.loadedTurnCount + turnCount} (Continuation #${turnCount})`);

      try {
        // Get AI context for continuation
        const fullContext = this.gameMaster.getAIPlayerContext();
        
        // Ensure we have a valid player before proceeding
        if (!fullContext.player) {
          throw new Error('No player found in loaded session');
        }
        
        // Cast to proper type (player is guaranteed to exist after null check)
        const context = {
          ...fullContext,
          player: fullContext.player,
          objectives: [
            'Continue your adventure from where you left off',
            'Build on previous discoveries and interactions',
            'Advance your current goals or explore new opportunities'
          ]
        };

        // AI decides next action
        const actionDecision = await this.aiPlayer.decideAction(context);

        console.log(`🤖 ${actionDecision.reasoning.substring(0, 80)}...`);
        console.log(`➡️  ${actionDecision.action}`);

        // Execute the action
        const result = await this.gameMaster.processAIPlayerAction(
          actionDecision.action,
          actionDecision.reasoning,
          actionDecision.fatePointsSpent,
          actionDecision.aspectInvokes
        );

        const turnDuration = (Date.now() - turnStart) / 1000;

        // Check success
        const isSuccess = result.result === 'success' || result.result === 'success_with_style' || result.result === 'tie';

        if (isSuccess) {
          console.log(`✅ ${turnDuration.toFixed(1)}s | ${result.turn?.events?.length || 0} events`);
          if (result.narration) {
            console.log(`   📜 "${result.narration.substring(0, 100)}..."`);
          }
        } else {
          console.log(`❌ Failed (${result.result || 'failure'}) | ${turnDuration.toFixed(1)}s`);
        }

      } catch (error: any) {
        console.error(`💥 Turn ${turnCount} failed: ${error.message}`);
        this.results.errors.push(`Turn ${turnCount} error: ${error.message}`);
        break; // Stop on first error to avoid cascading failures
      }

      // Small delay between turns
      await this.delay(1000);
    }

    this.results.additionalTurns = turnCount;
    this.results.totalTurns = this.results.loadedTurnCount + turnCount;
    this.results.continuationTime = Date.now() - continuationStart;

    console.log('');
    console.log(`✅ Continuation complete: ${turnCount} turns in ${(this.results.continuationTime / 1000).toFixed(1)}s`);
  }

  private async finalSave() {
    console.log('💾 Saving continued session...');

    try {
      if (this.gameMaster) {
        await this.gameMaster.saveState();
        console.log('✅ Session saved successfully');
      }
    } catch (error: any) {
      console.error('❌ Save failed:', error.message);
      this.results.errors.push(`Save error: ${error.message}`);
    }
  }

  private printReport() {
    const totalTime = Date.now() - this.startTime;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                CONTINUATION TEST REPORT                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Session Info
    console.log('📂 SESSION INFO');
    console.log('─'.repeat(60));
    console.log(`   Session ID:     ${this.results.sessionId}`);
    console.log(`   Original Turns: ${this.results.originalTurnCount}`);
    console.log(`   Loaded Turns:   ${this.results.loadedTurnCount}`);
    console.log(`   Added Turns:    ${this.results.additionalTurns}`);
    console.log(`   Total Turns:    ${this.results.totalTurns}`);
    console.log('');

    // Performance
    console.log('⏱️  PERFORMANCE');
    console.log('─'.repeat(60));
    console.log(`   Load Time:        ${(this.results.loadTime / 1000).toFixed(1)}s`);
    console.log(`   Continuation:     ${(this.results.continuationTime / 1000).toFixed(1)}s`);
    console.log(`   Total Test Time:  ${(totalTime / 1000).toFixed(1)}s`);
    console.log('');

    // State Validation
    console.log('🔍 STATE VALIDATION');
    console.log('─'.repeat(60));
    console.log(`   Player Name:      ${this.results.stateValidation.playerName ? '✅' : '❌'}`);
    console.log(`   World State:      ${this.results.stateValidation.worldState ? '✅' : '❌'}`);
    console.log(`   Character State:  ${this.results.stateValidation.characterState ? '✅' : '❌'}`);
    console.log(`   Turn Continuity:  ${this.results.stateValidation.turnContinuity ? '✅' : '❌'}`);

    const validationScore = Object.values(this.results.stateValidation).filter(Boolean).length;
    console.log(`   Overall:          ${validationScore}/4 checks passed`);
    console.log('');

    // Errors
    if (this.results.errors.length > 0) {
      console.log('🐛 ERRORS');
      console.log('─'.repeat(60));
      this.results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
      console.log('');
    }

    // Final Verdict
    console.log('═'.repeat(60));
    if (this.results.success) {
      console.log('🎉 CONTINUATION TEST PASSED');
      console.log('   Session loaded and continued successfully!');
    } else {
      console.log('💥 CONTINUATION TEST FAILED');
      console.log(`   ${this.results.errors.length} errors encountered`);
    }
    console.log('═'.repeat(60));

    // Export info
    console.log('');
    console.log('📁 Session available at:');
    console.log(`   ${STORAGE_PATH}/sessions/active/${this.results.sessionId}`);
    console.log(`💾 Export with: npx tsx src/exportSessionToMarkdown.ts ${this.results.sessionId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Command line interface
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx tests/session_continuation_test.ts <sessionId>');
  console.error('Example: npx tsx tests/session_continuation_test.ts granite-10min-test-1764256691345');
  process.exit(1);
}

const sessionId = args[0];

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

// Run the test
const test = new SessionContinuationTest(sessionId);
test.run().catch(console.error);
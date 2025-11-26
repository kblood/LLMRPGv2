/**
 * 10-Minute Comprehensive Test with Granite4:3b
 * 
 * This test runs a full game session exercising all major systems:
 * - World Generation
 * - Character Creation
 * - Exploration
 * - Combat
 * - NPC Interaction
 * - Quest System
 * - Economy (Shopping)
 * - Save/Load
 * - Knowledge Discovery
 */

import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const TEST_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_ID = `granite-10min-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

interface TestResult {
  action: string;
  success: boolean;
  turnNumber: number;
  eventCount: number;
  narrationLength: number;
  narration?: string;
  duration: number;
  error?: string;
}

class TenMinuteTest {
  private results: TestResult[] = [];
  private gameMaster: GameMaster | null = null;
  private startTime: number = 0;
  private errors: string[] = [];
  
  async run() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║           10-Minute Granite4:3b Comprehensive Test               ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    this.startTime = Date.now();
    
    try {
      await this.setup();
      await this.runGameLoop();
    } catch (error: any) {
      console.error('FATAL ERROR:', error.message);
      this.errors.push(`Fatal: ${error.message}`);
    } finally {
      this.printReport();
    }
  }
  
  private async setup() {
    console.log('📦 Setting up test environment...');
    
    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
    
    const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);
    
    await sessionWriter.createSession(SESSION_ID, {
      startTime: Date.now(),
      player: 'Granite Test Player'
    });
    
    // Initialize with Granite4:3b
    const llmProvider = new OllamaAdapter({
      model: 'granite4:3b',
      host: 'http://127.0.0.1:11434'
    });
    
    this.gameMaster = new GameMaster(SESSION_ID, llmProvider, sessionWriter, sessionLoader);
    
    console.log('✅ Environment ready\n');
    
    // Initialize world
    console.log('🌍 Generating world...');
    const worldStart = Date.now();
    await this.gameMaster.initializeWorld('Dark Fantasy with ancient magic and forgotten kingdoms');
    console.log(`✅ World generated in ${(Date.now() - worldStart) / 1000}s\n`);
    
    // Create character
    console.log('🧙 Creating character...');
    const charStart = Date.now();
    await this.gameMaster.createCharacter('A wandering scholar-mage seeking lost knowledge');
    console.log(`✅ Character created in ${(Date.now() - charStart) / 1000}s\n`);
    
    // Start the game
    await this.gameMaster.start();
    console.log('🎮 Game started!\n');
  }
  
  private async runGameLoop() {
    // Define test phases with actions
    const phases = [
      // Phase 1: Exploration and Observation
      {
        name: 'Exploration',
        actions: [
          'Look around carefully and observe my surroundings',
          'Examine any interesting features nearby',
          'Search for clues or hidden objects',
          'Listen for any sounds or movement',
        ]
      },
      // Phase 2: NPC Interaction
      {
        name: 'NPC Interaction',
        actions: [
          'Approach the nearest person and greet them',
          'Ask them about the local area and its history',
          'Inquire about any rumors or strange occurrences',
          'Thank them and ask if they need any help',
        ]
      },
      // Phase 3: Quest and Goals
      {
        name: 'Quest Pursuit',
        actions: [
          'Ask about any jobs or tasks that need doing',
          'Accept any available quest or mission',
          'Gather information about the quest objective',
          'Begin traveling toward the quest destination',
        ]
      },
      // Phase 4: Challenges and Skill Use
      {
        name: 'Challenges',
        actions: [
          'Use my scholarly knowledge to solve a problem',
          'Attempt to overcome any obstacle in my path',
          'Create an advantage using my magic abilities',
          'Carefully navigate through a dangerous area',
        ]
      },
      // Phase 5: Combat
      {
        name: 'Combat',
        actions: [
          'If enemies appear, prepare to defend myself',
          'Cast a protective spell around me',
          'Attack the nearest threat with arcane energy',
          'Dodge incoming attacks and counterattack',
        ]
      },
      // Phase 6: Economy and Inventory
      {
        name: 'Economy',
        actions: [
          '/inventory',
          '/status',
          'Find a merchant or shop',
          'Browse their wares and ask about prices',
        ]
      },
      // Phase 7: Save/Load Test
      {
        name: 'Save/Load',
        actions: [
          '/save',
          'Continue exploring after saving',
        ]
      },
      // Phase 8: Extended Exploration (fills remaining time)
      {
        name: 'Extended Play',
        actions: [
          'Explore a new area',
          'Investigate something unusual',
          'Use my skills creatively',
          'Interact with my environment',
          'Talk to another NPC',
          'Search for secrets',
          'Rest and observe',
          'Plan my next move',
        ]
      }
    ];
    
    let phaseIndex = 0;
    let actionIndex = 0;
    
    while (this.getElapsedTime() < TEST_DURATION_MS && this.gameMaster) {
      const phase = phases[phaseIndex % phases.length];
      const action = phase.actions[actionIndex % phase.actions.length];
      
      console.log(`\n[${this.getTimeString()}] Phase: ${phase.name}`);
      console.log(`➡️  Action: ${action}`);
      
      try {
        const result = await this.executeAction(action);
        this.results.push(result);
        
        if (result.success) {
          console.log(`✅ Turn ${result.turnNumber}: ${result.eventCount} events, ${result.narrationLength} chars (${result.duration}ms)`);
          if (result.narrationLength > 0 && result.narration) {
            // Truncate long narrations for display - use narration directly from result
            const narration = result.narration.substring(0, 200);
            console.log(`   📜 "${narration}..."`);
          }
        } else {
          console.log(`❌ Error: ${result.error}`);
          this.errors.push(`Turn ${result.turnNumber}: ${result.error}`);
        }
      } catch (loopError: any) {
        console.error(`💥 LOOP ERROR: ${loopError.message}`);
        console.error(loopError.stack);
        this.errors.push(`Loop error: ${loopError.message}`);
      }
      
      actionIndex++;
      if (actionIndex >= phase.actions.length) {
        actionIndex = 0;
        phaseIndex++;
      }
      
      // Small delay between actions to avoid overwhelming the LLM
      await this.delay(500);
    }
  }
  
  private async executeAction(action: string): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const result = await this.gameMaster!.processPlayerAction(action);
      const duration = Date.now() - start;
      
      return {
        action,
        success: true,
        turnNumber: result.turn?.turnNumber ?? 0,
        eventCount: result.turn?.events?.length ?? 0,
        narrationLength: result.narration?.length ?? 0,
        narration: result.narration || '',
        duration
      };
    } catch (error: any) {
      console.error(`💥 executeAction error for "${action}":`, error.message);
      console.error(error.stack);
      return {
        action,
        success: false,
        turnNumber: 0,
        eventCount: 0,
        narrationLength: 0,
        duration: Date.now() - start,
        error: error.message
      };
    }
  }
  
  private getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
  
  private getTimeString(): string {
    const elapsed = this.getElapsedTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private printReport() {
    const totalTime = this.getElapsedTime();
    const successfulActions = this.results.filter(r => r.success);
    const failedActions = this.results.filter(r => !r.success);
    const avgDuration = successfulActions.length > 0
      ? successfulActions.reduce((sum, r) => sum + r.duration, 0) / successfulActions.length
      : 0;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST REPORT                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`⏱️  Total Runtime:       ${(totalTime / 1000 / 60).toFixed(2)} minutes`);
    console.log(`📊 Total Actions:       ${this.results.length}`);
    console.log(`✅ Successful:          ${successfulActions.length}`);
    console.log(`❌ Failed:              ${failedActions.length}`);
    console.log(`⚡ Success Rate:        ${((successfulActions.length / this.results.length) * 100).toFixed(1)}%`);
    console.log(`⏳ Avg Response Time:   ${(avgDuration / 1000).toFixed(2)}s`);
    console.log('');
    
    if (this.errors.length > 0) {
      console.log('🐛 ERRORS FOUND:');
      console.log('─'.repeat(60));
      this.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
      console.log('');
    }
    
    // Summary by turn outcome
    const turnsByOutcome: Record<string, number> = {};
    this.results.forEach(r => {
      if (r.success) {
        turnsByOutcome['success'] = (turnsByOutcome['success'] || 0) + 1;
      } else {
        turnsByOutcome['failure'] = (turnsByOutcome['failure'] || 0) + 1;
      }
    });
    
    console.log('📈 Actions by Outcome:');
    Object.entries(turnsByOutcome).forEach(([outcome, count]) => {
      console.log(`   ${outcome}: ${count}`);
    });
    console.log('');
    
    // Final verdict
    if (failedActions.length === 0) {
      console.log('🎉 TEST PASSED - All actions completed successfully!');
    } else if (successfulActions.length / this.results.length >= 0.8) {
      console.log('⚠️  TEST PASSED WITH WARNINGS - Some actions failed but overall success rate is acceptable');
    } else {
      console.log('💥 TEST FAILED - Too many action failures');
    }
    
    // Session info
    console.log('');
    console.log(`📁 Session saved at: ${STORAGE_PATH}/sessions/active/${SESSION_ID}`);
  }
}

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
const test = new TenMinuteTest();
test.run().catch(console.error);

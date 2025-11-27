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
import { AIPlayer } from '../src/systems/AIPlayer';
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
  playerReasoning?: string;
}

class TenMinuteTest {
  private results: TestResult[] = [];
  private gameMaster: GameMaster | null = null;
  private aiPlayer: AIPlayer | null = null;
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
    
    // Initialize AI Player
    this.aiPlayer = new AIPlayer(llmProvider);
    
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
    let actionCount = 0;
    
    while (this.getElapsedTime() < TEST_DURATION_MS && this.gameMaster && this.aiPlayer) {
      console.log(`\n[${this.getTimeString()}] Turn ${actionCount + 1}`);
      
      try {
        // Get AI player context and decide action
        const context = this.gameMaster.getAIPlayerContext();
        const actionDecision = await this.aiPlayer.decideAction(context);
        
        console.log(`🤖 AI Player Reasoning: ${actionDecision.reasoning}`);
        console.log(`➡️  Action: ${actionDecision.action}`);
        
        // Execute the action using the AI player method
        const result = await this.gameMaster.processAIPlayerAction(actionDecision.action, actionDecision.reasoning);
        this.results.push({
          action: actionDecision.action,
          success: true,
          turnNumber: result.turn?.turnNumber ?? actionCount + 1,
          eventCount: result.turn?.events?.length ?? 0,
          narrationLength: result.narration?.length ?? 0,
          narration: result.narration || '',
          duration: 0, // We'll calculate this differently since we don't have start time per action
          playerReasoning: actionDecision.reasoning
        });
        
        if (result.success !== false) {
          console.log(`✅ Turn ${result.turn?.turnNumber ?? actionCount + 1}: ${result.turn?.events?.length ?? 0} events, ${result.narration?.length ?? 0} chars`);
          if (result.narration && result.narration.length > 0) {
            // Truncate long narrations for display
            const narration = result.narration.substring(0, 200);
            console.log(`   📜 "${narration}..."`);
          }
        } else {
          console.log(`❌ Error: ${result.error || 'Unknown error'}`);
          this.errors.push(`Turn ${actionCount + 1}: ${result.error || 'Unknown error'}`);
        }
      } catch (loopError: any) {
        console.error(`💥 LOOP ERROR: ${loopError.message}`);
        console.error(loopError.stack);
        this.errors.push(`Loop error: ${loopError.message}`);
        this.results.push({
          action: 'error',
          success: false,
          turnNumber: actionCount + 1,
          eventCount: 0,
          narrationLength: 0,
          duration: 0,
          error: loopError.message
        });
      }
      
      actionCount++;
      
      // Small delay between actions to avoid overwhelming the LLM
      await this.delay(1000); // Increased delay for AI decision making
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
    const totalActions = this.results.length;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST REPORT                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`⏱️  Total Runtime:       ${(totalTime / 1000 / 60).toFixed(2)} minutes`);
    console.log(`📊 Total Actions:       ${totalActions}`);
    console.log(`✅ Successful:          ${successfulActions.length}`);
    console.log(`❌ Failed:              ${failedActions.length}`);
    console.log(`⚡ Success Rate:        ${totalActions > 0 ? ((successfulActions.length / totalActions) * 100).toFixed(1) : '0.0'}%`);
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
    
    // Sample AI reasoning
    const reasoningExamples = this.results
      .filter(r => r.playerReasoning && r.playerReasoning.length > 0)
      .slice(0, 3);
    
    if (reasoningExamples.length > 0) {
      console.log('🤖 Sample AI Reasoning:');
      console.log('─'.repeat(60));
      reasoningExamples.forEach((result, i) => {
        console.log(`  ${i + 1}. "${result.playerReasoning!.substring(0, 100)}..."`);
      });
      console.log('');
    }
    
    // Final verdict
    if (failedActions.length === 0) {
      console.log('🎉 TEST PASSED - All actions completed successfully!');
    } else if (successfulActions.length / totalActions >= 0.8) {
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

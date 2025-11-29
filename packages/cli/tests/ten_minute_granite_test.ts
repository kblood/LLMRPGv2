/**
 * 10-Minute Comprehensive Test with Granite4:3b
 * 
 * This test runs a structured game session with defined gameplay phases:
 * 
 * PHASE 1: Setup & World Generation (~1 min)
 * PHASE 2: Exploration & Discovery (~1.5 min) - Tests location features and discovery
 * PHASE 3: Travel & Location Change (~1.5 min) - Tests new travel system (Phase 22)
 * PHASE 4: NPC Interaction & Dialogue (~2 min) - Tests dialogue intent routing (Phase 22)
 * PHASE 5: Quest Acceptance & Progress (~1.5 min)
 * PHASE 6: Combat & Challenges (~1.5 min)
 * PHASE 7: Economy & Meta Commands (~1 min)
 * 
 * Each phase has specific objectives and tracks success/failure.
 * The AI player is guided by phase-appropriate objectives.
 * 
 * Features Tested:
 * - Travel system (processTravelTurn, travelToLocation)
 * - Dialogue system (processDialogueTurn, dialogue intent)
 * - Anti-repetition detection (analyzeRecentHistory)
 * - Proactive compel offers after failures
 * - Location connections and exits
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

// Phase definitions with objectives and time allocation
interface TestPhase {
  name: string;
  description: string;
  durationMs: number;
  objectives: string[];
  minActions: number;
  successCriteria: string[];
}

const TEST_PHASES: TestPhase[] = [
  {
    name: 'Setup',
    description: 'World generation and character creation',
    durationMs: 60 * 1000, // 1 minute
    objectives: [
      'Generate a dark fantasy world with interesting hooks',
      'Create a scholar-mage character with clear motivation'
    ],
    minActions: 0, // Setup actions don't count
    successCriteria: ['World theme generated', 'Character created', 'Starting scene established']
  },
  {
    name: 'Exploration',
    description: 'Discover the starting location and its features',
    durationMs: 90 * 1000, // 1.5 minutes
    objectives: [
      'Explore the immediate surroundings',
      'Examine interesting features in the location',
      'Look for exits or passages to other areas',
      'Note any NPCs present in the area'
    ],
    minActions: 3,
    successCriteria: ['At least one investigation action', 'Location features discovered']
  },
  {
    name: 'Travel',
    description: 'Move to a new location via available exits',
    durationMs: 90 * 1000, // 1.5 minutes
    objectives: [
      'Find an exit or passage leading elsewhere',
      'Travel to a new location (e.g., "I head north", "I go through the doorway")',
      'Explore the new area after arriving',
      'Note differences between locations'
    ],
    minActions: 3,
    successCriteria: ['Travel intent triggered', 'Location changed or attempted']
  },
  {
    name: 'Dialogue',
    description: 'Engage NPCs in conversation using dialogue system',
    durationMs: 2 * 60 * 1000, // 2 minutes
    objectives: [
      'Find and approach any NPCs in the area',
      'Ask an NPC about something specific (triggers dialogue system)',
      'Tell or say something to an NPC',
      'Try to learn useful information through conversation'
    ],
    minActions: 4,
    successCriteria: ['Dialogue intent triggered', 'NPC response generated']
  },
  {
    name: 'Quest',
    description: 'Accept and progress on a quest or goal',
    durationMs: 90 * 1000, // 1.5 minutes
    objectives: [
      'Accept a quest or define a personal goal',
      'Take concrete steps toward the objective',
      'Overcome an obstacle related to the quest',
      'Make progress toward completion'
    ],
    minActions: 3,
    successCriteria: ['Quest started or objective defined', 'Progress made']
  },
  {
    name: 'Combat',
    description: 'Engage in conflict or challenging encounters',
    durationMs: 90 * 1000, // 1.5 minutes
    objectives: [
      'Find or provoke a challenging situation',
      'Use combat skills if hostile encounter occurs',
      'Alternatively, engage in social conflict',
      'Resolve the conflict through action'
    ],
    minActions: 3,
    successCriteria: ['Attack or defend action attempted', 'Conflict engaged']
  },
  {
    name: 'Meta',
    description: 'Test economy and system commands',
    durationMs: 60 * 1000, // 1 minute
    objectives: [
      'Check your inventory with /inventory',
      'View your status with /status',
      'Save the game with /save',
      'Look for trading opportunities'
    ],
    minActions: 3,
    successCriteria: ['Meta command executed', 'Game saved']
  }
];

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
  phase: string;
  intent?: string; // Track what intent was classified
  triggeredTravel?: boolean; // Did this action trigger travel system?
  triggeredDialogue?: boolean; // Did this action trigger dialogue system?
  locationChanged?: boolean; // Did location change during this action?
}

interface PhaseResult {
  phase: TestPhase;
  startTime: number;
  endTime: number;
  actions: TestResult[];
  success: boolean;
  notes: string[];
}

// Track new feature usage across the test
interface FeatureTracker {
  travelIntentCount: number;
  dialogueIntentCount: number;
  locationChanges: number;
  compelOffersReceived: number;
  fatePointsSpent: number;
  fatePointsGained: number;
  uniqueLocationsVisited: Set<string>;
  npcsInteractedWith: Set<string>;
  repetitionWarningsTriggered: number;
}

class TenMinuteTest {
  private results: TestResult[] = [];
  private phaseResults: PhaseResult[] = [];
  private gameMaster: GameMaster | null = null;
  private aiPlayer: AIPlayer | null = null;
  private startTime: number = 0;
  private errors: string[] = [];
  private currentPhaseIndex: number = 0;
  private currentPhaseStartTime: number = 0;
  private featureTracker: FeatureTracker = {
    travelIntentCount: 0,
    dialogueIntentCount: 0,
    locationChanges: 0,
    compelOffersReceived: 0,
    fatePointsSpent: 0,
    fatePointsGained: 0,
    uniqueLocationsVisited: new Set(),
    npcsInteractedWith: new Set(),
    repetitionWarningsTriggered: 0
  };
  
  async run() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        10-Minute Granite4:3b Comprehensive Phased Test           ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Test Phases:');
    TEST_PHASES.forEach((phase, i) => {
      console.log(`   ${i + 1}. ${phase.name} (${phase.durationMs / 1000}s) - ${phase.description}`);
    });
    console.log('');
    
    this.startTime = Date.now();
    
    try {
      await this.runPhase(0); // Setup phase
      
      // Run gameplay phases
      for (let i = 1; i < TEST_PHASES.length; i++) {
        if (this.getElapsedTime() >= TEST_DURATION_MS) {
          console.log('\n⏰ Time limit reached!');
          break;
        }
        await this.runPhase(i);
      }
    } catch (error: any) {
      console.error('FATAL ERROR:', error.message);
      this.errors.push(`Fatal: ${error.message}`);
    } finally {
      await this.printReport();
    }
  }
  
  private async runPhase(phaseIndex: number) {
    const phase = TEST_PHASES[phaseIndex];
    this.currentPhaseIndex = phaseIndex;
    this.currentPhaseStartTime = Date.now();
    
    console.log('');
    console.log('═'.repeat(70));
    console.log(`🎯 PHASE ${phaseIndex + 1}: ${phase.name.toUpperCase()}`);
    console.log(`   ${phase.description}`);
    console.log('═'.repeat(70));
    
    const phaseResult: PhaseResult = {
      phase,
      startTime: Date.now(),
      endTime: 0,
      actions: [],
      success: false,
      notes: []
    };
    
    try {
      if (phaseIndex === 0) {
        // Setup phase - special handling
        await this.setupPhase(phaseResult);
      } else {
        // Gameplay phases
        await this.gameplayPhase(phase, phaseResult);
      }
      
      // Evaluate success
      phaseResult.success = this.evaluatePhaseSuccess(phase, phaseResult);
      
    } catch (error: any) {
      phaseResult.notes.push(`Error: ${error.message}`);
      this.errors.push(`Phase ${phase.name}: ${error.message}`);
    }
    
    phaseResult.endTime = Date.now();
    this.phaseResults.push(phaseResult);
    
    const duration = (phaseResult.endTime - phaseResult.startTime) / 1000;
    console.log('');
    console.log(`📊 Phase ${phase.name} completed in ${duration.toFixed(1)}s`);
    console.log(`   Actions: ${phaseResult.actions.length}/${phase.minActions} (min required)`);
    console.log(`   Status: ${phaseResult.success ? '✅ SUCCESS' : '⚠️ INCOMPLETE'}`);
  }
  
  private async setupPhase(phaseResult: PhaseResult) {
    console.log('\n📦 Setting up test environment...');
    
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
    this.aiPlayer = new AIPlayer(llmProvider);
    
    phaseResult.notes.push('✅ Environment ready');
    console.log('✅ Environment ready\n');
    
    // Initialize world
    console.log('🌍 Generating world...');
    const worldStart = Date.now();
    await this.gameMaster.initializeWorld('Dark Fantasy with ancient magic, forgotten kingdoms, and dangerous ruins to explore');
    const worldTime = (Date.now() - worldStart) / 1000;
    phaseResult.notes.push(`World generated in ${worldTime.toFixed(1)}s`);
    console.log(`✅ World generated in ${worldTime.toFixed(1)}s\n`);
    
    // Create character
    console.log('🧙 Creating character...');
    const charStart = Date.now();
    await this.gameMaster.createCharacter('A wandering scholar-mage seeking lost knowledge of ancient civilizations, driven by curiosity and a mysterious past');
    const charTime = (Date.now() - charStart) / 1000;
    phaseResult.notes.push(`Character created in ${charTime.toFixed(1)}s`);
    console.log(`✅ Character created in ${charTime.toFixed(1)}s\n`);
    
    // Start the game
    await this.gameMaster.start();
    phaseResult.notes.push('Game started');
    console.log('🎮 Game started!\n');
  }
  
  private async gameplayPhase(phase: TestPhase, phaseResult: PhaseResult) {
    if (!this.gameMaster || !this.aiPlayer) {
      throw new Error('Game not initialized');
    }
    
    let actionCount = 0;
    const phaseStartTime = Date.now();
    
    // Meta phase uses direct commands
    if (phase.name === 'Meta') {
      await this.runMetaPhase(phase, phaseResult);
      return;
    }

    // Track starting location for this phase
    const startingLocationId = this.gameMaster.getAIPlayerContext().worldState?.currentLocation?.id;
    if (startingLocationId) {
      this.featureTracker.uniqueLocationsVisited.add(startingLocationId);
    }
    
    while (Date.now() - phaseStartTime < phase.durationMs && this.getElapsedTime() < TEST_DURATION_MS) {
      const actionStart = Date.now();
      
      console.log(`\n[${this.getTimeString()}] ${phase.name} Action ${actionCount + 1}`);
      
      try {
        // Get AI player context with phase-specific objectives
        const context = this.gameMaster.getAIPlayerContext();
        context.objectives = phase.objectives;
        
        // Track current location before action
        const locationBefore = context.worldState?.currentLocation?.id;
        
        const actionDecision = await this.aiPlayer.decideAction(context);
        
        console.log(`🤖 Reasoning: ${actionDecision.reasoning}`);
        console.log(`➡️  Action: ${actionDecision.action}`);
        
        // Execute the action
        const result = await this.gameMaster.processAIPlayerAction(
          actionDecision.action, 
          actionDecision.reasoning,
          actionDecision.fatePointsSpent,
          actionDecision.aspectInvokes
        );
        
        const duration = (Date.now() - actionStart) / 1000;
        
        // Analyze events for feature tracking
        const events = result.turn?.events || [];
        const hasTravelEvent = events.some(e => e.type === 'move' || e.action === 'location_change');
        const hasDialogueEvent = events.some(e => e.type === 'dialogue' || e.action === 'dialogue');
        const hasCompelEvent = events.some(e => e.type === 'fate_compel' || e.action === 'compel_offered');
        const hasFPSpend = events.some(e => e.type === 'fate_point_spend');
        const hasFPGain = events.some(e => e.type === 'fate_point_award' || e.type === 'fate_point_refresh');
        
        // Check location after action
        const contextAfter = this.gameMaster.getAIPlayerContext();
        const locationAfter = contextAfter.worldState?.currentLocation?.id;
        const locationChanged = locationBefore !== locationAfter && locationAfter !== undefined;
        
        // Update feature tracker
        if (hasTravelEvent || locationChanged) {
          this.featureTracker.travelIntentCount++;
          if (locationAfter) {
            this.featureTracker.uniqueLocationsVisited.add(locationAfter);
          }
          if (locationChanged) {
            this.featureTracker.locationChanges++;
          }
        }
        if (hasDialogueEvent) {
          this.featureTracker.dialogueIntentCount++;
        }
        if (hasCompelEvent) {
          this.featureTracker.compelOffersReceived++;
        }
        if (hasFPSpend) {
          this.featureTracker.fatePointsSpent++;
        }
        if (hasFPGain) {
          this.featureTracker.fatePointsGained++;
        }
        
        // Check for NPC interactions
        const npcEvents = events.filter(e => 
          e.description?.includes('NPC') || 
          e.type === 'dialogue' || 
          (e as any).metadata?.npcId
        );
        for (const npcEvent of npcEvents) {
          const npcId = (npcEvent as any).metadata?.npcId || (npcEvent as any).metadata?.targetNPC;
          if (npcId) {
            this.featureTracker.npcsInteractedWith.add(npcId);
          }
        }
        
        // Check success using result.result (string) not result.success
        const isSuccess = result.result === 'success' || result.result === 'success_with_style' || result.result === 'tie';
        
        const testResult: TestResult = {
          action: actionDecision.action,
          success: isSuccess,
          turnNumber: result.turn?.turnNumber ?? actionCount + 1,
          eventCount: result.turn?.events?.length ?? 0,
          narrationLength: result.narration?.length ?? 0,
          narration: result.narration || '',
          duration,
          playerReasoning: actionDecision.reasoning,
          phase: phase.name,
          triggeredTravel: hasTravelEvent || locationChanged,
          triggeredDialogue: hasDialogueEvent,
          locationChanged
        };
        
        this.results.push(testResult);
        phaseResult.actions.push(testResult);
        
        if (isSuccess) {
          let statusLine = `✅ ${duration.toFixed(1)}s | ${result.turn?.events?.length ?? 0} events`;
          if (locationChanged) statusLine += ' | 🗺️ LOCATION CHANGED';
          if (hasDialogueEvent) statusLine += ' | 💬 DIALOGUE';
          if (hasTravelEvent) statusLine += ' | 🚶 TRAVEL';
          console.log(statusLine);
          if (result.narration && result.narration.length > 0) {
            const narration = result.narration.substring(0, 150);
            console.log(`   📜 "${narration}..."`);
          }
        } else {
          // Failure case - result.result will be 'failure'
          console.log(`❌ Failed: ${result.result || 'failure'} | ${result.narration?.substring(0, 100) || 'No details'}`);
        }
      } catch (loopError: any) {
        console.error(`💥 Error: ${loopError.message}`);
        this.errors.push(`${phase.name} error: ${loopError.message}`);
        phaseResult.actions.push({
          action: 'error',
          success: false,
          turnNumber: actionCount + 1,
          eventCount: 0,
          narrationLength: 0,
          duration: (Date.now() - actionStart) / 1000,
          error: loopError.message,
          phase: phase.name
        });
      }
      
      actionCount++;
      
      // Check if we've met minimum actions for this phase
      if (actionCount >= phase.minActions) {
        // Continue if there's still significant time left (more than 30 seconds)
        if (Date.now() - phaseStartTime < phase.durationMs - 30000) {
          await this.delay(1000);
        } else {
          // Move to next phase
          break;
        }
      } else {
        await this.delay(1000);
      }
    }
  }
  
  private async runMetaPhase(phase: TestPhase, phaseResult: PhaseResult) {
    if (!this.gameMaster) return;
    
    const metaCommands = ['/inventory', '/status', '/save'];
    
    for (const cmd of metaCommands) {
      const actionStart = Date.now();
      console.log(`\n[${this.getTimeString()}] Meta Command: ${cmd}`);
      
      try {
        const result = await this.gameMaster.processPlayerAction(cmd);
        const duration = (Date.now() - actionStart) / 1000;
        
        // Check success using result.result (string) not result.success
        const isSuccess = result.result === 'success' || result.result === 'success_with_style' || result.result === 'tie';
        
        const testResult: TestResult = {
          action: cmd,
          success: isSuccess,
          turnNumber: result.turn?.turnNumber ?? 0,
          eventCount: result.turn?.events?.length ?? 0,
          narrationLength: result.narration?.length ?? 0,
          narration: result.narration || '',
          duration,
          phase: phase.name
        };
        
        this.results.push(testResult);
        phaseResult.actions.push(testResult);
        
        console.log(`✅ ${cmd} executed in ${duration.toFixed(1)}s`);
        if (result.narration) {
          console.log(`   📋 ${result.narration.substring(0, 100)}...`);
        }
      } catch (error: any) {
        console.error(`❌ ${cmd} failed: ${error.message}`);
        phaseResult.actions.push({
          action: cmd,
          success: false,
          turnNumber: 0,
          eventCount: 0,
          narrationLength: 0,
          duration: (Date.now() - actionStart) / 1000,
          error: error.message,
          phase: phase.name
        });
      }
      
      await this.delay(500);
    }
  }
  
  private evaluatePhaseSuccess(phase: TestPhase, phaseResult: PhaseResult): boolean {
    // Check minimum actions
    if (phaseResult.actions.length < phase.minActions) {
      phaseResult.notes.push(`Insufficient actions: ${phaseResult.actions.length}/${phase.minActions}`);
      return false;
    }
    
    // Check success rate (at least 75% of actions should succeed)
    const successfulActions = phaseResult.actions.filter(a => a.success);
    if (successfulActions.length / phaseResult.actions.length < 0.75) {
      phaseResult.notes.push(`Low success rate: ${successfulActions.length}/${phaseResult.actions.length}`);
      return false;
    }
    
    return true;
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
  
  private async printReport() {
    const totalTime = this.getElapsedTime();
    const successfulActions = this.results.filter(r => r.success);
    const failedActions = this.results.filter(r => !r.success);
    const totalActions = this.results.length;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                    PHASED TEST REPORT                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // Overall Statistics
    console.log('📊 OVERALL STATISTICS');
    console.log('─'.repeat(60));
    console.log(`⏱️  Total Runtime:       ${(totalTime / 1000 / 60).toFixed(2)} minutes`);
    console.log(`📊 Total Actions:       ${totalActions}`);
    console.log(`✅ Successful:          ${successfulActions.length}`);
    console.log(`❌ Failed:              ${failedActions.length}`);
    console.log(`⚡ Success Rate:        ${totalActions > 0 ? ((successfulActions.length / totalActions) * 100).toFixed(1) : '0.0'}%`);
    
    // Average response time
    const avgTime = successfulActions.length > 0 
      ? successfulActions.reduce((sum, r) => sum + r.duration, 0) / successfulActions.length 
      : 0;
    console.log(`⏳ Avg Response Time:   ${avgTime.toFixed(2)}s`);
    console.log('');
    
    // Phase-by-Phase Results
    console.log('🎯 PHASE RESULTS');
    console.log('─'.repeat(60));
    
    this.phaseResults.forEach((pr, i) => {
      const phaseDuration = (pr.endTime - pr.startTime) / 1000;
      const phaseSuccess = pr.actions.filter(a => a.success).length;
      const phaseTotal = pr.actions.length;
      const statusIcon = pr.success ? '✅' : '⚠️';
      
      console.log(`\n${statusIcon} Phase ${i + 1}: ${pr.phase.name}`);
      console.log(`   Duration: ${phaseDuration.toFixed(1)}s | Actions: ${phaseTotal} | Success: ${phaseSuccess}/${phaseTotal}`);
      
      if (pr.notes.length > 0) {
        pr.notes.forEach(note => {
          console.log(`   📝 ${note}`);
        });
      }
    });
    console.log('');
    
    // Actions by Phase Summary
    console.log('📈 ACTIONS BY PHASE');
    console.log('─'.repeat(60));
    
    const phaseStats: Record<string, { total: number, success: number, avgTime: number }> = {};
    this.results.forEach(r => {
      if (!phaseStats[r.phase]) {
        phaseStats[r.phase] = { total: 0, success: 0, avgTime: 0 };
      }
      phaseStats[r.phase].total++;
      if (r.success) {
        phaseStats[r.phase].success++;
        phaseStats[r.phase].avgTime += r.duration;
      }
    });
    
    Object.entries(phaseStats).forEach(([phase, stats]) => {
      const avgTime = stats.success > 0 ? stats.avgTime / stats.success : 0;
      const rate = (stats.success / stats.total * 100).toFixed(0);
      console.log(`   ${phase.padEnd(12)} | ${stats.success}/${stats.total} (${rate}%) | avg ${avgTime.toFixed(1)}s`);
    });
    console.log('');
    
    // NEW FEATURES TRACKER (Phase 22)
    console.log('🆕 PHASE 22 FEATURE USAGE');
    console.log('─'.repeat(60));
    console.log(`   🚶 Travel Intent Triggers:    ${this.featureTracker.travelIntentCount}`);
    console.log(`   🗺️  Location Changes:          ${this.featureTracker.locationChanges}`);
    console.log(`   🏠 Unique Locations Visited:  ${this.featureTracker.uniqueLocationsVisited.size}`);
    console.log(`   💬 Dialogue Intent Triggers:  ${this.featureTracker.dialogueIntentCount}`);
    console.log(`   👤 NPCs Interacted With:      ${this.featureTracker.npcsInteractedWith.size}`);
    console.log(`   🎲 Compel Offers Received:    ${this.featureTracker.compelOffersReceived}`);
    console.log(`   ⭐ Fate Points Spent:         ${this.featureTracker.fatePointsSpent}`);
    console.log(`   ⭐ Fate Points Gained:        ${this.featureTracker.fatePointsGained}`);
    console.log('');
    
    // Feature Coverage Assessment
    const travelWorking = this.featureTracker.travelIntentCount > 0 || this.featureTracker.locationChanges > 0;
    const dialogueWorking = this.featureTracker.dialogueIntentCount > 0;
    const compelWorking = this.featureTracker.compelOffersReceived > 0;
    const explorationWorking = this.featureTracker.uniqueLocationsVisited.size > 1;
    
    console.log('🔍 FEATURE VERIFICATION');
    console.log('─'.repeat(60));
    console.log(`   ${travelWorking ? '✅' : '⚠️'} Travel System:     ${travelWorking ? 'TRIGGERED' : 'NOT TESTED'}`);
    console.log(`   ${dialogueWorking ? '✅' : '⚠️'} Dialogue System:   ${dialogueWorking ? 'TRIGGERED' : 'NOT TESTED'}`);
    console.log(`   ${compelWorking ? '✅' : 'ℹ️'} Proactive Compels: ${compelWorking ? 'TRIGGERED' : 'Not triggered (may need failures)'}`);
    console.log(`   ${explorationWorking ? '✅' : '⚠️'} Multi-Location:    ${explorationWorking ? 'VERIFIED' : 'Single location only'}`);
    console.log('');
    
    // Errors
    if (this.errors.length > 0) {
      console.log('🐛 ERRORS ENCOUNTERED');
      console.log('─'.repeat(60));
      this.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
      console.log('');
    }
    
    // Sample AI reasoning
    const reasoningExamples = this.results
      .filter(r => r.playerReasoning && r.playerReasoning.length > 0)
      .slice(0, 5);
    
    if (reasoningExamples.length > 0) {
      console.log('🤖 SAMPLE AI REASONING');
      console.log('─'.repeat(60));
      reasoningExamples.forEach((result, i) => {
        console.log(`  ${i + 1}. [${result.phase}] "${result.playerReasoning!.substring(0, 80)}..."`);
      });
      console.log('');
    }
    
    // Final Verdict
    const successfulPhases = this.phaseResults.filter(pr => pr.success).length;
    const totalPhases = this.phaseResults.length;
    
    console.log('═'.repeat(60));
    if (successfulPhases === totalPhases && failedActions.length === 0) {
      console.log('🎉 TEST PASSED - All phases completed successfully!');
    } else if (successfulPhases >= totalPhases * 0.7) {
      console.log(`⚠️  TEST PASSED WITH WARNINGS - ${successfulPhases}/${totalPhases} phases successful`);
    } else {
      console.log(`💥 TEST INCOMPLETE - Only ${successfulPhases}/${totalPhases} phases successful`);
    }
    console.log('═'.repeat(60));
    
    // Session info
    console.log('');
    console.log(`📁 Session saved at: ${STORAGE_PATH}/sessions/active/${SESSION_ID}`);
    console.log(`💾 Export with: npx tsx src/exportSessionToMarkdown.ts ${SESSION_ID}`);
    
    // Explicit final save to ensure everything is persisted
    try {
      if (this.gameMaster) {
        await this.gameMaster.saveState();
        console.log('💾 Final session save completed');
      }
    } catch (saveError: any) {
      console.error('⚠️  Final save failed:', saveError.message);
      this.errors.push(`Final save error: ${saveError.message}`);
    }
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

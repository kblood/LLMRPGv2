import { GameMaster } from './GameMaster';
import { input, select, confirm } from '@inquirer/prompts';

export type GameMode = 'exploration' | 'combat' | 'social' | 'trade' | 'dialogue';

export interface GameLoopOptions {
  initialCommands?: string[];
  exitAfter?: boolean;
  showContext?: boolean;
}

export class GameLoop {
  private mode: GameMode = 'exploration';
  
  constructor(private gameMaster: GameMaster) {}

  async start(options: GameLoopOptions = {}) {
    await this.gameMaster.start();
    
    this.printWelcome();

    const commands = options.initialCommands || [];

    // Process initial commands
    for (const cmd of commands) {
        console.log(`> ${cmd}`);
        if (cmd.toLowerCase() === 'exit') return;
        
        const result = await this.gameMaster.processPlayerAction(cmd);
        this.printResult(result);
        this.updateMode(result);
    }

    if (options.exitAfter) {
        return;
    }

    await this.mainLoop(options);
  }

  private async mainLoop(options: GameLoopOptions) {
    while (true) {
      // Display context if enabled
      if (options.showContext) {
        this.displayContext();
      }

      // Get appropriate prompt based on mode
      const prompt = this.getPromptForMode();
      const action = await input({ message: prompt });

      if (action.toLowerCase() === 'exit') {
        const shouldSave = await confirm({ 
          message: 'Save before exiting?',
          default: true 
        });
        if (shouldSave) {
          await this.gameMaster.processPlayerAction('/save');
          console.log('Game saved.');
        }
        break;
      }

      const result = await this.gameMaster.processPlayerAction(action);
      this.printResult(result);
      this.updateMode(result);
    }
  }

  private printWelcome() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                        LLMRPGv2                              ║');
    console.log('║          A Fate Core RPG powered by AI                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Commands: /help | /status | /inventory | /save | /load | exit');
    console.log('');
  }

  private printResult(result: any) {
    console.log('');
    console.log('─'.repeat(60));
    console.log(result.narration);
    console.log('─'.repeat(60));
    
    if (result.result && result.result !== 'meta_command_success') {
      const outcomeEmoji = this.getOutcomeEmoji(result.result);
      console.log(`${outcomeEmoji} Outcome: ${result.result}`);
    }
    console.log('');
  }

  private getOutcomeEmoji(outcome: string): string {
    switch (outcome) {
      case 'success_with_style': return '✨';
      case 'success': return '✓';
      case 'tie': return '⚖️';
      case 'failure': return '✗';
      default: return '•';
    }
  }

  private updateMode(result: any) {
    const worldState = this.gameMaster.getWorldState();
    
    // Check if we're in combat
    // Note: currentScene is accessed via GameMaster internal state
    // For a full implementation, we'd expose this via a method
    
    // For now, use a simplified check based on result context
    if (result.turn?.events?.some((e: any) => e.type === 'combat_start')) {
      this.mode = 'combat';
    } else if (result.turn?.events?.some((e: any) => e.type === 'dialogue')) {
      this.mode = 'dialogue';
    } else if (result.turn?.events?.some((e: any) => e.subType === 'trade_list' || e.subType === 'trade_buy')) {
      this.mode = 'trade';
    } else {
      this.mode = 'exploration';
    }
  }

  private getPromptForMode(): string {
    switch (this.mode) {
      case 'combat':
        return '⚔️  [Combat] > ';
      case 'dialogue':
        return '💬 [Dialogue] > ';
      case 'trade':
        return '🪙 [Trade] > ';
      case 'social':
        return '🎭 [Social] > ';
      default:
        return '🗺️  > ';
    }
  }

  private displayContext() {
    const worldState = this.gameMaster.getWorldState();
    
    console.log('');
    console.log('╭─ Context ────────────────────────────────────────────────────╮');
    
    // Display time
    if (worldState.time) {
      const timeDisplay = worldState.time.period 
        ? `${worldState.time.value} (${worldState.time.period})`
        : worldState.time.value;
      console.log(`│ 🕐 ${timeDisplay}`);
    }

    // Display active quests count
    const activeQuests = worldState.quests?.filter(q => q.status === 'active') || [];
    if (activeQuests.length > 0) {
      console.log(`│ 📜 Active Quests: ${activeQuests.length}`);
    }

    console.log('╰──────────────────────────────────────────────────────────────╯');
  }

  /**
   * Get the current game mode
   */
  getMode(): GameMode {
    return this.mode;
  }

  /**
   * Manually set the game mode (for testing or special events)
   */
  setMode(mode: GameMode) {
    this.mode = mode;
  }
}

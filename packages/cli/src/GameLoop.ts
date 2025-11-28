import { GameMaster } from './GameMaster';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';

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

      let result: any = await this.gameMaster.processPlayerAction(action);
      this.printResult(result);

      // Handle Compel Offer
      if (result.result === 'compel_offered' && result.compel) {
        const accept = await confirm({ 
            message: `Accept Compel? (Gain 1 FP, but face complication: ${result.compel.description})`,
            default: true 
        });
        
        const compelResult = await this.gameMaster.resolveCompel(result.compel, accept);
        this.printResult(compelResult);
        
        if (!accept && compelResult.result === 'compel_refused') {
            // Re-run the original action, skipping compel check
            console.log("Retrying action...");
            result = await this.gameMaster.processPlayerAction(action, undefined, true);
            this.printResult(result);
        }
      }

      this.updateMode(result);
    }
  }

  private printWelcome() {
    console.log('');
    console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + chalk.white.bold('                        LLMRPGv2                              ') + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('║') + chalk.gray('          A Fate Core RPG powered by AI                       ') + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.gray('Commands:'), chalk.yellow('/help | /status | /inventory | /save | /load | exit'));
    console.log('');
  }

  private printResult(result: any) {
    console.log('');
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(result.narration));
    console.log(chalk.gray('─'.repeat(60)));

    if (result.result && result.result !== 'meta_command_success') {
      const outcomeEmoji = this.getOutcomeEmoji(result.result);
      const outcomeColor = this.getOutcomeColor(result.result);
      console.log(outcomeColor(`${outcomeEmoji} Outcome: ${result.result}`));
    }
    console.log('');
  }

  private getOutcomeColor(outcome: string): typeof chalk {
    switch (outcome) {
      case 'success_with_style': return chalk.green.bold;
      case 'success': return chalk.green;
      case 'tie': return chalk.yellow;
      case 'failure': return chalk.red;
      case 'compel_offered': return chalk.magenta;
      case 'compel_accepted': return chalk.blue;
      case 'compel_refused': return chalk.cyan;
      default: return chalk.gray;
    }
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
    console.log(chalk.gray('╭─ Context ────────────────────────────────────────────────────╮'));

    // Display time
    if (worldState.time) {
      const timeDisplay = worldState.time.period
        ? `${worldState.time.value} (${worldState.time.period})`
        : worldState.time.value;
      console.log(chalk.gray('│'), chalk.cyan('🕐'), chalk.white(timeDisplay));
    }

    // Display active quests count
    const activeQuests = worldState.quests?.filter(q => q.status === 'active') || [];
    if (activeQuests.length > 0) {
      console.log(chalk.gray('│'), chalk.yellow('📜'), chalk.white(`Active Quests: ${activeQuests.length}`));
    }

    console.log(chalk.gray('╰──────────────────────────────────────────────────────────────╯'));
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

import { GameMaster } from './GameMaster';
import { input } from '@inquirer/prompts';

export class GameLoop {
  constructor(private gameMaster: GameMaster) {}

  async start(options: { initialCommands?: string[], exitAfter?: boolean } = {}) {
    await this.gameMaster.start();
    
    console.log("Welcome to LLMRPGv2!");
    console.log("Type 'exit' to quit.");

    const commands = options.initialCommands || [];

    // Process initial commands
    for (const cmd of commands) {
        console.log(`> ${cmd}`);
        if (cmd.toLowerCase() === 'exit') return;
        
        const result = await this.gameMaster.processPlayerAction(cmd);
        console.log(`\n${result.narration}\n`);
        console.log(`Result: ${result.result}`);
    }

    if (options.exitAfter) {
        return;
    }

    while (true) {
      const action = await input({ message: '> ' });

      if (action.toLowerCase() === 'exit') {
        break;
      }

      const result = await this.gameMaster.processPlayerAction(action);
      console.log(`\n${result.narration}\n`);
      console.log(`Result: ${result.result}`);
    }
  }
}

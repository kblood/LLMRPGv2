import { GameMaster } from './GameMaster';
import { input } from '@inquirer/prompts';

export class GameLoop {
  constructor(private gameMaster: GameMaster) {}

  async start() {
    await this.gameMaster.start();
    
    console.log("Welcome to LLMRPGv2!");
    console.log("Type 'exit' to quit.");

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

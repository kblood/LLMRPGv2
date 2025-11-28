import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import { GameMaster } from './GameMaster';
import { GameLoop } from './GameLoop';
import { OllamaAdapter, MockAdapter, LLMProvider } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const program = new Command();

program
  .name('llmrpg')
  .description('LLMRPGv2 CLI')
  .version('0.1.0');

program.command('start')
  .description('Start a new game session')
  .option('--mock', 'Use mock LLM adapter')
  .option('--theme <theme>', 'Specify the world theme')
  .option('--run <commands...>', 'Run specific commands and exit')
  .option('--load <sessionId>', 'Load an existing session')
  .action(async (options) => {
    console.log(chalk.green.bold('Welcome to LLMRPGv2!'));

    const storagePath = process.cwd();
    
    // Initialize dependencies
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);

    let sessionId = options.load;
    if (!sessionId) {
        sessionId = `session-${Date.now()}`;
        await sessionWriter.createSession(sessionId, {
            startTime: Date.now(),
            player: "Player"
        });
    } else {
        console.log(chalk.blue(`Resuming session: ${sessionId}`));
    }

    // Initialize LLM
    let llmProvider: LLMProvider;
    if (options.mock) {
        console.log(chalk.yellow('Using Mock LLM Adapter'));
        llmProvider = new MockAdapter();
    } else {
        llmProvider = new OllamaAdapter({
            model: 'llama3', // Default model
            host: 'http://localhost:11434'
        });
    }

    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter, sessionLoader);

    if (options.load) {
        console.log(chalk.cyan('📂 Loading session...'));
        const loadStart = Date.now();
        await gameMaster.loadState();
        const loadTime = ((Date.now() - loadStart) / 1000).toFixed(1);
        console.log(chalk.green(`✓ Session loaded in ${loadTime}s\n`));
    } else {
        // World Generation Phase
        let themeInput = options.theme;
        if (!themeInput) {
            themeInput = await input({ 
              message: 'Enter a genre or theme for your world (e.g., "Cyberpunk Noir", "High Fantasy"):',
              default: 'High Fantasy'
            });
        }

        // World Generation Phase with progress indicator
        console.log(chalk.cyan('🌍 Generating world...'));
        const worldStart = Date.now();
        await gameMaster.initializeWorld(themeInput);
        const worldTime = ((Date.now() - worldStart) / 1000).toFixed(1);
        console.log(chalk.green(`✓ World generated in ${worldTime}s\n`));

        // Character Creation Phase
        let characterConcept = "A generic hero";
        if (!options.run) {
            characterConcept = await input({
                message: chalk.cyan('Describe your character concept (e.g., "A grizzled detective with a cybernetic eye"):'),
                default: 'A wandering adventurer'
            });
        }

        console.log(chalk.cyan('👤 Creating character...'));
        const charStart = Date.now();
        await gameMaster.createCharacter(characterConcept);
        const charTime = ((Date.now() - charStart) / 1000).toFixed(1);
        console.log(chalk.green(`✓ Character created in ${charTime}s\n`));
    }

    const gameLoop = new GameLoop(gameMaster);
    
    if (options.run) {
        await gameLoop.start({ initialCommands: options.run, exitAfter: true });
    } else {
        await gameLoop.start();
    }
  });

program.parse();

import { Command } from 'commander';
import { GameMaster } from './GameMaster';
import { GameLoop } from './GameLoop';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('llmrpg')
  .description('LLMRPGv2 CLI')
  .version('0.1.0');

program.command('start')
  .description('Start a new game session')
  .action(async () => {
    const sessionId = `session-${Date.now()}`;
    const storagePath = path.join(process.cwd(), 'sessions');
    
    // Initialize dependencies
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Player"
    });

    // Initialize LLM (using Ollama for now as default)
    const llmProvider = new OllamaAdapter({
        model: 'llama3', // Default model
        host: 'http://localhost:11434'
    });

    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter);
    const gameLoop = new GameLoop(gameMaster);

    await gameLoop.start();
  });

program.parse();

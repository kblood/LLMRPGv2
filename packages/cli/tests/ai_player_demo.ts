/**
 * AI Player Demo Test
 * 
 * This test demonstrates the AI player system where:
 * 1. The AI player explains its reasoning for each action
 * 2. The Game Master narrates the resolution of each action
 * 
 * Run with: npx tsx tests/ai_player_demo.ts
 */

import { GameMaster } from '../src/GameMaster';
import { AIPlayer } from '../src/systems/AIPlayer';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `ai-player-demo-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');
const MAX_TURNS = 10;

async function runDemo() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║              AI Player with Reasoning Demo                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_PATH)) {
        fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }

    const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);

    await sessionWriter.createSession(SESSION_ID, {
        startTime: Date.now(),
        player: 'AI Player Demo'
    });

    // Initialize with Ollama (change model as needed)
    const llmProvider = new OllamaAdapter({
        model: 'granite4:3b', // or llama3, mistral, etc.
        host: 'http://127.0.0.1:11434'
    });

    const gameMaster = new GameMaster(SESSION_ID, llmProvider, sessionWriter, sessionLoader);
    const aiPlayer = new AIPlayer(llmProvider);

    // Initialize World
    console.log('🌍 Generating world...\n');
    await gameMaster.initializeWorld('A mysterious fantasy realm with ancient ruins and hidden magic');

    // Create Character
    console.log('🧙 Creating character...\n');
    await gameMaster.createCharacter('A curious scholar-mage who seeks forbidden knowledge');

    await gameMaster.start();

    let lastNarration = '';

    // Main game loop with AI player
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
        console.log('\n' + '═'.repeat(70));
        console.log(`                          TURN ${turn}`);
        console.log('═'.repeat(70));

        // Get context for AI player
        const context = gameMaster.getAIPlayerContext();
        
        // AI Player decides action with reasoning
        console.log('\n🤔 AI PLAYER THINKING...\n');
        
        const aiDecision = await aiPlayer.decideAction({
            ...context,
            lastNarration
        } as any);

        // Display AI player's reasoning
        console.log('┌─────────────────────────────────────────────────────────────────────┐');
        console.log('│ PLAYER REASONING                                                    │');
        console.log('├─────────────────────────────────────────────────────────────────────┤');
        console.log(`│ Action: ${aiDecision.action.substring(0, 60)}${aiDecision.action.length > 60 ? '...' : ''}`);
        console.log('│');
        console.log(`│ 💭 Reasoning: ${aiDecision.reasoning}`);
        if (aiDecision.strategy) {
            console.log(`│ 📋 Strategy: ${aiDecision.strategy}`);
        }
        if (aiDecision.expectedOutcome) {
            console.log(`│ 🎯 Expected: ${aiDecision.expectedOutcome}`);
        }
        console.log('└─────────────────────────────────────────────────────────────────────┘');

        // Process action through GameMaster
        console.log('\n🎲 RESOLVING ACTION...\n');
        
        const result = await gameMaster.processAIPlayerAction(
            aiDecision.action,
            aiDecision.reasoning,
            aiDecision.fatePointsSpent,
            aiDecision.aspectInvokes
        );

        // Display GM narration
        console.log('┌─────────────────────────────────────────────────────────────────────┐');
        console.log('│ 📖 GAME MASTER NARRATION                                            │');
        console.log('├─────────────────────────────────────────────────────────────────────┤');
        
        // Word wrap the narration
        const words = result.narration.split(' ');
        let line = '│ ';
        for (const word of words) {
            if (line.length + word.length > 70) {
                console.log(line);
                line = '│ ' + word + ' ';
            } else {
                line += word + ' ';
            }
        }
        if (line.trim() !== '│') {
            console.log(line);
        }
        
        console.log('│');
        console.log(`│ Outcome: ${getOutcomeEmoji(result.result)} ${result.result}`);
        console.log('└─────────────────────────────────────────────────────────────────────┘');

        lastNarration = result.narration;

        // Small delay between turns
        await delay(1000);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('                        DEMO COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n📁 Session saved at: ${STORAGE_PATH}/sessions/active/${SESSION_ID}\n`);
}

function getOutcomeEmoji(outcome: string): string {
    switch (outcome) {
        case 'success_with_style': return '✨';
        case 'success': return '✅';
        case 'tie': return '⚖️';
        case 'failure': return '❌';
        default: return '•';
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
runDemo().catch(console.error);

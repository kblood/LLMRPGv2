/**
 * Session History Printer
 * 
 * Utility to print out what happened in a session - turns, events, and deltas.
 */
import { FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import { Turn, Delta } from '@llmrpg/core';
import path from 'path';
import fs from 'fs';

interface PrintOptions {
  showDeltas?: boolean;
  showEvents?: boolean;
  startTurn?: number;
  endTurn?: number;
  verbose?: boolean;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatDice(dice: number[]): string {
  const symbols = dice.map(d => {
    if (d === 1) return '+';
    if (d === -1) return '-';
    return '0';
  });
  return `[${symbols.join('')}]`;
}

function formatEvent(event: any, verbose: boolean): string {
  const lines: string[] = [];
  
  lines.push(`    📌 Event: ${event.type} (${event.eventId})`);
  
  if (event.description) {
    lines.push(`       ${event.description}`);
  }
  
  if (event.action) {
    lines.push(`       Action: ${event.action}`);
  }
  
  if (event.roll) {
    const diceStr = formatDice(event.roll.dice);
    lines.push(`       Roll: ${diceStr} = ${event.roll.total} vs Difficulty ${event.difficulty || '?'}`);
    if (event.shifts !== undefined) {
      const outcome = event.shifts >= 0 ? '✅ Success' : '❌ Failure';
      lines.push(`       Shifts: ${event.shifts} (${outcome})`);
    }
  }
  
  if (verbose && event.outcome) {
    lines.push(`       Outcome: ${JSON.stringify(event.outcome)}`);
  }
  
  return lines.join('\n');
}

function formatTurn(turn: Turn, verbose: boolean): string {
  const lines: string[] = [];
  
  const timeStr = turn.gameTime 
    ? `Day ${turn.gameTime.day}, ${turn.gameTime.timeOfDay}`
    : 'Unknown time';
  
  lines.push(`\n┌─ Turn ${turn.turnId} ─────────────────────────────────────`);
  lines.push(`│ Actor: ${turn.actor}`);
  lines.push(`│ Scene: ${turn.sceneId}`);
  lines.push(`│ Game Time: ${timeStr}`);
  lines.push(`│ Real Time: ${formatTimestamp(turn.timestamp)}`);
  
  if (turn.events && turn.events.length > 0) {
    lines.push(`│`);
    lines.push(`│ Events (${turn.events.length}):`);
    for (const event of turn.events) {
      lines.push(formatEvent(event, verbose));
    }
  }
  
  lines.push(`└──────────────────────────────────────────────────────`);
  
  return lines.join('\n');
}

function formatDelta(delta: Delta): string {
  const pathStr = delta.path.join('.');
  return `  Δ ${delta.operation.toUpperCase()} ${delta.target}.${pathStr}: ${JSON.stringify(delta.previousValue)} → ${JSON.stringify(delta.newValue)} [${delta.cause}]`;
}

export async function printSessionHistory(
  basePath: string,
  sessionId: string,
  options: PrintOptions = {}
): Promise<void> {
  const { 
    showDeltas = true, 
    showEvents = true, 
    startTurn = 1, 
    endTurn = 10000,
    verbose = false 
  } = options;
  
  // FileSystemAdapter takes the root path, SessionLoader adds sessions/active/
  const adapter = new FileSystemAdapter(basePath);
  const loader = new SessionLoader(adapter);
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║         SESSION HISTORY: ${sessionId.substring(0, 20)}...   ║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  // Load metadata
  try {
    const metadata = await loader.loadSessionMetadata(sessionId);
    console.log('📋 Session Metadata:');
    console.log(`   Started: ${formatTimestamp(metadata.startTime)}`);
    console.log(`   Player: ${metadata.player || 'Unknown'}`);
    if (metadata.currentTurn) {
      console.log(`   Current Turn: ${metadata.currentTurn}`);
    }
    console.log('');
  } catch (e) {
    console.log('⚠️  Could not load session metadata');
  }
  
  // Load current state summary
  try {
    const state = await loader.loadCurrentState(sessionId);
    console.log('🌍 World State Summary:');
    if (state.world?.theme) {
      console.log(`   Theme: ${state.world.theme.name || 'Unknown'} (${state.world.theme.genre || 'Unknown'})`);
    }
    if (state.world?.currentScene) {
      console.log(`   Current Scene: ${state.world.currentScene.name}`);
      console.log(`   Location: ${state.world.currentScene.locationId}`);
    }
    if (state.player?.name) {
      console.log(`   Player Character: ${state.player.name}`);
      console.log(`   High Concept: ${state.player.highConcept || 'Unknown'}`);
    }
    console.log('');
  } catch (e) {
    console.log('⚠️  Could not load current state');
  }
  
  // Load and print turns
  console.log('📜 Turn History:');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const turns = await loader.loadTurns(sessionId, startTurn, endTurn);
    
    if (turns.length === 0) {
      console.log('   No turns recorded yet.\n');
    } else {
      for (const turn of turns) {
        if (showEvents) {
          console.log(formatTurn(turn, verbose));
        } else {
          console.log(`Turn ${turn.turnId}: ${turn.actor} @ ${turn.sceneId}`);
        }
        
        // Load deltas for this turn if requested
        if (showDeltas) {
          try {
            const deltas = await loader.loadDeltas(sessionId, turn.turnId, turn.turnId);
            if (deltas.length > 0) {
              console.log('\n  State Changes:');
              for (const delta of deltas) {
                console.log(formatDelta(delta));
              }
              console.log('');
            }
          } catch (e) {
            // No deltas for this turn, that's OK
          }
        }
      }
    }
  } catch (e) {
    console.log(`⚠️  Could not load turns: ${e}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    END OF SESSION HISTORY');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// List all available sessions from both regular and test-sessions folders
export async function listSessions(basePath: string): Promise<{ id: string, folder: string }[]> {
  const sessions: { id: string, folder: string }[] = [];
  
  // Check regular sessions folder
  const activePath = path.join(basePath, 'sessions', 'active');
  if (fs.existsSync(activePath)) {
    const dirs = fs.readdirSync(activePath);
    for (const dir of dirs) {
      const metaPath = path.join(activePath, dir, 'session.meta.json');
      if (fs.existsSync(metaPath)) {
        sessions.push({ id: dir, folder: 'sessions' });
      }
    }
  }
  
  // Check test-sessions folder
  const testActivePath = path.join(basePath, 'test-sessions', 'sessions', 'active');
  if (fs.existsSync(testActivePath)) {
    const dirs = fs.readdirSync(testActivePath);
    for (const dir of dirs) {
      const metaPath = path.join(testActivePath, dir, 'session.meta.json');
      if (fs.existsSync(metaPath)) {
        sessions.push({ id: dir, folder: 'test-sessions' });
      }
    }
  }
  
  return sessions;
}

// Find which folder a session is in
export function findSessionFolder(basePath: string, sessionId: string): string | null {
  // Check regular sessions folder
  const regularPath = path.join(basePath, 'sessions', 'active', sessionId, 'session.meta.json');
  if (fs.existsSync(regularPath)) {
    return '';  // Regular sessions folder (no prefix needed for FileSystemAdapter)
  }
  
  // Check test-sessions folder  
  const testPath = path.join(basePath, 'test-sessions', 'sessions', 'active', sessionId, 'session.meta.json');
  if (fs.existsSync(testPath)) {
    return 'test-sessions';  // Test sessions folder
  }
  
  return null;
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Session History Printer
=======================

Usage:
  npx tsx src/printSessionHistory.ts [sessionId] [options]
  npx tsx src/printSessionHistory.ts --list

Options:
  --list              List all available sessions
  --test              Look in test-sessions folder instead of sessions
  --no-deltas         Don't show state changes (deltas)
  --no-events         Don't show detailed event info
  --start <turn>      Start from turn number
  --end <turn>        End at turn number
  --verbose           Show all event details
  --help, -h          Show this help

Examples:
  npx tsx src/printSessionHistory.ts --list
  npx tsx src/printSessionHistory.ts session-1764111699299
  npx tsx src/printSessionHistory.ts granite-10min-test-1764180846356
  npx tsx src/printSessionHistory.ts session-1764111699299 --no-deltas
  npx tsx src/printSessionHistory.ts session-1764111699299 --start 5 --end 10
`);
    return;
  }
  
  // Determine the base path (cli package root)
  const basePath = path.resolve(__dirname, '..');
  
  if (args.includes('--list')) {
    const sessions = await listSessions(basePath);
    console.log('\nAvailable Sessions:');
    console.log('═══════════════════════════════════════════════════════════\n');
    if (sessions.length === 0) {
      console.log('  No sessions found.');
    } else {
      // Group by folder
      const regular = sessions.filter(s => s.folder === 'sessions');
      const test = sessions.filter(s => s.folder === 'test-sessions');
      
      if (regular.length > 0) {
        console.log('  📂 Regular Sessions (sessions/):');
        for (const session of regular) {
          console.log(`     📁 ${session.id}`);
        }
        console.log('');
      }
      
      if (test.length > 0) {
        console.log('  📂 Test Sessions (test-sessions/):');
        for (const session of test) {
          console.log(`     📁 ${session.id}`);
        }
        console.log('');
      }
    }
    console.log('');
    return;
  }
  
  const sessionId = args[0];
  const options: PrintOptions = {
    showDeltas: !args.includes('--no-deltas'),
    showEvents: !args.includes('--no-events'),
    verbose: args.includes('--verbose'),
  };
  
  const startIdx = args.indexOf('--start');
  if (startIdx !== -1 && args[startIdx + 1]) {
    options.startTurn = parseInt(args[startIdx + 1], 10);
  }
  
  const endIdx = args.indexOf('--end');
  if (endIdx !== -1 && args[endIdx + 1]) {
    options.endTurn = parseInt(args[endIdx + 1], 10);
  }
  
  // Auto-detect which folder the session is in
  const folder = findSessionFolder(basePath, sessionId);
  if (folder === null) {
    console.error(`❌ Session "${sessionId}" not found in sessions/ or test-sessions/`);
    console.log('   Run with --list to see available sessions.');
    return;
  }
  
  const sessionBasePath = folder ? path.join(basePath, folder) : basePath;
  await printSessionHistory(sessionBasePath, sessionId, options);
}

main().catch(console.error);

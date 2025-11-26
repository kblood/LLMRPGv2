/**
 * Session to Markdown Exporter
 * 
 * Interactive CLI tool to export session history to a Markdown file.
 */
import { FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import { Turn, Delta } from '@llmrpg/core';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

interface SessionInfo {
  id: string;
  folder: string;
  metadata?: any;
  turnCount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Formatting Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatDice(dice: number[]): string {
  const symbols = dice.map(d => {
    if (d === 1) return '+';
    if (d === -1) return '-';
    return '0';
  });
  return `\`[${symbols.join('')}]\``;
}

function formatEvent(event: any): string[] {
  const lines: string[] = [];
  
  const typeEmoji: Record<string, string> = {
    'skill_check': '🎲',
    'state_change': '📝',
    'knowledge_gain': '💡',
    'quest_update': '📜',
    'combat': '⚔️',
    'dialogue': '💬',
    'narrative': '📖',
    'location_change': '🗺️',
  };
  
  const emoji = typeEmoji[event.type] || '📌';
  lines.push(`- ${emoji} **${event.type}**: ${event.description || 'No description'}`);
  
  if (event.action) {
    lines.push(`  - Action: \`${event.action}\``);
  }
  
  if (event.roll) {
    const diceStr = formatDice(event.roll.dice);
    const outcome = (event.shifts !== undefined && event.shifts >= 0) ? '✅ Success' : '❌ Failure';
    lines.push(`  - Roll: ${diceStr} = **${event.roll.total}** vs Difficulty ${event.difficulty || '?'}`);
    if (event.shifts !== undefined) {
      lines.push(`  - Shifts: ${event.shifts} (${outcome})`);
    }
  }
  
  return lines;
}

function formatDelta(delta: Delta): string {
  const pathStr = delta.path.join('.');
  const prevValue = JSON.stringify(delta.previousValue) || 'null';
  const newValue = JSON.stringify(delta.newValue) || 'null';
  
  // Truncate long values
  const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max) + '...' : s;
  
  return `| \`${delta.operation}\` | \`${delta.target}.${pathStr}\` | ${truncate(prevValue, 30)} → ${truncate(newValue, 50)} | ${delta.cause} |`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Discovery
// ═══════════════════════════════════════════════════════════════════════════

async function discoverSessions(basePath: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  
  // Check regular sessions folder
  const activePath = path.join(basePath, 'sessions', 'active');
  if (fs.existsSync(activePath)) {
    const dirs = fs.readdirSync(activePath);
    for (const dir of dirs) {
      const metaPath = path.join(activePath, dir, 'session.meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          const turnsPath = path.join(activePath, dir, 'turns');
          let turnCount = 0;
          if (fs.existsSync(turnsPath)) {
            const turnFiles = fs.readdirSync(turnsPath);
            for (const file of turnFiles) {
              const content = fs.readFileSync(path.join(turnsPath, file), 'utf-8');
              turnCount += content.split('\n').filter(l => l.trim()).length;
            }
          }
          sessions.push({ id: dir, folder: 'sessions', metadata, turnCount });
        } catch {
          sessions.push({ id: dir, folder: 'sessions' });
        }
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
        try {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          const turnsPath = path.join(testActivePath, dir, 'turns');
          let turnCount = 0;
          if (fs.existsSync(turnsPath)) {
            const turnFiles = fs.readdirSync(turnsPath);
            for (const file of turnFiles) {
              const content = fs.readFileSync(path.join(turnsPath, file), 'utf-8');
              turnCount += content.split('\n').filter(l => l.trim()).length;
            }
          }
          sessions.push({ id: dir, folder: 'test-sessions', metadata, turnCount });
        } catch {
          sessions.push({ id: dir, folder: 'test-sessions' });
        }
      }
    }
  }
  
  return sessions;
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown Generation
// ═══════════════════════════════════════════════════════════════════════════

async function generateMarkdown(
  basePath: string,
  session: SessionInfo,
  includeDeltas: boolean = true
): Promise<string> {
  const sessionBasePath = session.folder === 'test-sessions' 
    ? path.join(basePath, 'test-sessions') 
    : basePath;
  
  const adapter = new FileSystemAdapter(sessionBasePath);
  const loader = new SessionLoader(adapter);
  
  const lines: string[] = [];
  
  // Header
  lines.push(`# Session: ${session.id}`);
  lines.push('');
  lines.push(`> Exported on ${new Date().toLocaleString()}`);
  lines.push('');
  
  // Metadata
  lines.push('## 📋 Session Information');
  lines.push('');
  
  try {
    const metadata = await loader.loadSessionMetadata(session.id);
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| **Session ID** | \`${session.id}\` |`);
    lines.push(`| **Started** | ${formatTimestamp(metadata.startTime)} |`);
    lines.push(`| **Player** | ${metadata.player || 'Unknown'} |`);
    if (metadata.currentTurn) {
      lines.push(`| **Total Turns** | ${metadata.currentTurn} |`);
    }
    lines.push('');
  } catch {
    lines.push('*Could not load session metadata*');
    lines.push('');
  }
  
  // World State
  lines.push('## 🌍 World State');
  lines.push('');
  
  try {
    const state = await loader.loadCurrentState(session.id);
    
    if (state.world?.theme) {
      lines.push('### Theme');
      lines.push(`- **Name**: ${state.world.theme.name || 'Unknown'}`);
      lines.push(`- **Genre**: ${state.world.theme.genre || 'Unknown'}`);
      if (state.world.theme.tone) {
        lines.push(`- **Tone**: ${state.world.theme.tone}`);
      }
      if (state.world.theme.keywords?.length) {
        lines.push(`- **Keywords**: ${state.world.theme.keywords.join(', ')}`);
      }
      lines.push('');
    }
    
    if (state.world?.currentScene) {
      lines.push('### Current Scene');
      lines.push(`- **Name**: ${state.world.currentScene.name}`);
      lines.push(`- **Description**: ${state.world.currentScene.description || 'No description'}`);
      lines.push(`- **Type**: ${state.world.currentScene.type || 'Unknown'}`);
      lines.push('');
    }
    
    if (state.player) {
      lines.push('### Player Character');
      lines.push(`- **Name**: ${state.player.name || 'Unknown'}`);
      if (state.player.highConcept) {
        lines.push(`- **High Concept**: ${state.player.highConcept}`);
      }
      if (state.player.trouble) {
        lines.push(`- **Trouble**: ${state.player.trouble}`);
      }
      if (state.player.aspects?.length) {
        lines.push(`- **Aspects**: ${state.player.aspects.join(', ')}`);
      }
      lines.push('');
    }
  } catch {
    lines.push('*Could not load world state*');
    lines.push('');
  }
  
  // Turn History
  lines.push('## 📜 Turn History');
  lines.push('');
  
  try {
    const turns = await loader.loadTurns(session.id, 1, 10000);
    
    if (turns.length === 0) {
      lines.push('*No turns recorded*');
      lines.push('');
    } else {
      for (const turn of turns) {
        const timeStr = turn.gameTime 
          ? `Day ${turn.gameTime.day}, ${turn.gameTime.timeOfDay}`
          : 'Unknown time';
        
        lines.push(`### Turn ${turn.turnId}`);
        lines.push('');
        lines.push(`| | |`);
        lines.push(`|---|---|`);
        lines.push(`| **Actor** | ${turn.actor} |`);
        lines.push(`| **Scene** | ${turn.sceneId} |`);
        lines.push(`| **Game Time** | ${timeStr} |`);
        lines.push(`| **Real Time** | ${formatTimestamp(turn.timestamp)} |`);
        lines.push('');
        
        if (turn.events && turn.events.length > 0) {
          lines.push('#### Events');
          lines.push('');
          for (const event of turn.events) {
            lines.push(...formatEvent(event));
          }
          lines.push('');
        }
        
        // Load deltas for this turn if requested
        if (includeDeltas) {
          try {
            const deltas = await loader.loadDeltas(session.id, turn.turnId, turn.turnId);
            if (deltas.length > 0) {
              lines.push('<details>');
              lines.push('<summary>State Changes (Deltas)</summary>');
              lines.push('');
              lines.push('| Operation | Path | Change | Cause |');
              lines.push('|-----------|------|--------|-------|');
              for (const delta of deltas) {
                lines.push(formatDelta(delta));
              }
              lines.push('');
              lines.push('</details>');
              lines.push('');
            }
          } catch {
            // No deltas for this turn
          }
        }
        
        lines.push('---');
        lines.push('');
      }
    }
  } catch (e) {
    lines.push(`*Could not load turns: ${e}*`);
    lines.push('');
  }
  
  // Footer
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Generated by LLMRPGv2 Session Exporter*');
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Interactive CLI Menu
// ═══════════════════════════════════════════════════════════════════════════

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           LLMRPGv2 - Session to Markdown Exporter                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printSessionList(sessions: SessionInfo[], page: number, pageSize: number) {
  const start = page * pageSize;
  const end = Math.min(start + pageSize, sessions.length);
  const totalPages = Math.ceil(sessions.length / pageSize);
  
  console.log(`Sessions (Page ${page + 1}/${totalPages}):`);
  console.log('─'.repeat(70));
  console.log('');
  
  for (let i = start; i < end; i++) {
    const s = sessions[i];
    const num = (i + 1).toString().padStart(2, ' ');
    const folder = s.folder === 'test-sessions' ? '[TEST]' : '[MAIN]';
    const turns = s.turnCount !== undefined ? `${s.turnCount} turns` : '? turns';
    const player = s.metadata?.player || 'Unknown';
    const date = s.metadata?.startTime ? new Date(s.metadata.startTime).toLocaleDateString() : 'Unknown';
    
    console.log(`  ${num}. ${folder} ${s.id}`);
    console.log(`      └─ ${player} | ${date} | ${turns}`);
  }
  
  console.log('');
  console.log('─'.repeat(70));
}

async function runInteractiveMenu() {
  const rl = createReadlineInterface();
  const basePath = path.resolve(__dirname, '..');
  
  try {
    clearScreen();
    printHeader();
    console.log('🔍 Discovering sessions...\n');
    
    const sessions = await discoverSessions(basePath);
    
    if (sessions.length === 0) {
      console.log('❌ No sessions found!');
      console.log('   Run a game first to create session data.');
      rl.close();
      return;
    }
    
    // Sort sessions by start time (newest first)
    sessions.sort((a, b) => {
      const timeA = a.metadata?.startTime || 0;
      const timeB = b.metadata?.startTime || 0;
      return timeB - timeA;
    });
    
    const pageSize = 10;
    let currentPage = 0;
    const totalPages = Math.ceil(sessions.length / pageSize);
    
    while (true) {
      clearScreen();
      printHeader();
      printSessionList(sessions, currentPage, pageSize);
      
      console.log('Commands:');
      console.log('  [number]  - Select session to export');
      console.log('  n         - Next page');
      console.log('  p         - Previous page');
      console.log('  q         - Quit');
      console.log('');
      
      const input = await prompt(rl, '> Enter selection: ');
      
      if (input.toLowerCase() === 'q') {
        console.log('\n👋 Goodbye!');
        break;
      }
      
      if (input.toLowerCase() === 'n') {
        if (currentPage < totalPages - 1) {
          currentPage++;
        }
        continue;
      }
      
      if (input.toLowerCase() === 'p') {
        if (currentPage > 0) {
          currentPage--;
        }
        continue;
      }
      
      const selection = parseInt(input, 10);
      if (isNaN(selection) || selection < 1 || selection > sessions.length) {
        console.log('\n⚠️  Invalid selection. Press Enter to continue...');
        await prompt(rl, '');
        continue;
      }
      
      const selectedSession = sessions[selection - 1];
      
      // Ask about deltas
      clearScreen();
      printHeader();
      console.log(`Selected: ${selectedSession.id}`);
      console.log('');
      
      const includeDeltas = await prompt(rl, 'Include state changes (deltas)? [Y/n]: ');
      const withDeltas = includeDeltas.toLowerCase() !== 'n';
      
      // Ask for output filename
      const defaultFilename = `${selectedSession.id}.md`;
      const filenameInput = await prompt(rl, `Output filename [${defaultFilename}]: `);
      const filename = filenameInput || defaultFilename;
      
      // Generate and save
      console.log('');
      console.log('📝 Generating Markdown...');
      
      try {
        const markdown = await generateMarkdown(basePath, selectedSession, withDeltas);
        
        const outputPath = path.join(basePath, 'exports');
        if (!fs.existsSync(outputPath)) {
          fs.mkdirSync(outputPath, { recursive: true });
        }
        
        const fullPath = path.join(outputPath, filename);
        fs.writeFileSync(fullPath, markdown, 'utf-8');
        
        console.log('');
        console.log('✅ Export complete!');
        console.log(`   File: ${fullPath}`);
        console.log(`   Size: ${(markdown.length / 1024).toFixed(1)} KB`);
      } catch (error: any) {
        console.log(`\n❌ Export failed: ${error.message}`);
      }
      
      console.log('');
      await prompt(rl, 'Press Enter to continue...');
    }
    
  } finally {
    rl.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════════════════════════════════════

async function exportDirect(sessionId: string, options: { noDeltas?: boolean, output?: string }) {
  const basePath = path.resolve(__dirname, '..');
  
  console.log('🔍 Finding session...');
  const sessions = await discoverSessions(basePath);
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) {
    console.error(`❌ Session "${sessionId}" not found.`);
    console.log('\nAvailable sessions:');
    for (const s of sessions) {
      console.log(`  - ${s.id}`);
    }
    process.exit(1);
  }
  
  console.log(`📝 Generating Markdown for ${sessionId}...`);
  
  const markdown = await generateMarkdown(basePath, session, !options.noDeltas);
  
  const outputPath = path.join(basePath, 'exports');
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const filename = options.output || `${sessionId}.md`;
  const fullPath = path.join(outputPath, filename);
  fs.writeFileSync(fullPath, markdown, 'utf-8');
  
  console.log('');
  console.log('✅ Export complete!');
  console.log(`   File: ${fullPath}`);
  console.log(`   Size: ${(markdown.length / 1024).toFixed(1)} KB`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Session to Markdown Exporter
============================

Interactive CLI tool to export session history to Markdown files.

Usage:
  npx tsx src/exportSessionToMarkdown.ts                    # Interactive menu
  npx tsx src/exportSessionToMarkdown.ts <sessionId>        # Direct export
  npx tsx src/exportSessionToMarkdown.ts --help             # Show this help

Options:
  --no-deltas         Don't include state changes in export
  --output <file>     Specify output filename (default: <sessionId>.md)

Examples:
  npx tsx src/exportSessionToMarkdown.ts
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356 --no-deltas
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356 --output my-session.md

The interactive menu allows you to:
  - Browse all available sessions (regular and test sessions)
  - View session info (player, date, turn count)
  - Select a session to export
  - Choose whether to include state changes (deltas)
  - Specify the output filename

Exported files are saved to: packages/cli/exports/
`);
    return;
  }
  
  // Check for direct export mode (first non-flag argument is session ID)
  const sessionId = args.find(a => !a.startsWith('--'));
  
  if (sessionId) {
    const noDeltas = args.includes('--no-deltas');
    const outputIdx = args.indexOf('--output');
    const output = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
    
    await exportDirect(sessionId, { noDeltas, output });
  } else {
    await runInteractiveMenu();
  }
}

main().catch(console.error);

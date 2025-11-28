/**
 * Session to Markdown Exporter
 * 
 * Interactive CLI tool to export session history to a Markdown file.
 * Supports multiple export formats for different use cases.
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

type ExportFormat = 'story' | 'playreport' | 'technical';

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

// Extract the player's action from turn events
function extractPlayerAction(turn: Turn): string | null {
  if (!turn.events || turn.events.length === 0) return null;
  
  // Look for skill_check events which contain the action description
  const skillCheck = turn.events.find((e: any) => e.type === 'skill_check');
  if (skillCheck && skillCheck.description) {
    // Extract action from "Player attempted to X using Y" format
    const match = skillCheck.description.match(/Player attempted to (.+?) using/);
    if (match) return match[1].trim();
    return skillCheck.description;
  }
  
  // Look for other action-related events
  const actionEvent = turn.events.find((e: any) => e.action && e.action !== 'player_action');
  if (actionEvent && actionEvent.description) {
    return actionEvent.description;
  }
  
  return null;
}

// Extract dice roll information from turn events
function extractRollInfo(turn: Turn): { dice: number[], total: number, skill: string, difficulty: number, shifts: number, outcome: string } | null {
  if (!turn.events || turn.events.length === 0) return null;
  
  const skillCheck = turn.events.find((e: any) => e.type === 'skill_check' && e.roll);
  if (!skillCheck) return null;
  
  const outcome = (skillCheck as any).shifts >= 3 ? 'Success with Style!' :
                  (skillCheck as any).shifts >= 0 ? 'Success' :
                  (skillCheck as any).shifts === 0 ? 'Tie' : 'Failure';
  
  // Extract skill from description
  const skillMatch = (skillCheck as any).description?.match(/using ([^(]+) \(\+?\d+\)/);
  const skill = skillMatch ? skillMatch[1].trim() : 'Unknown';
  
  return {
    dice: (skillCheck as any).roll.dice,
    total: (skillCheck as any).roll.total,
    skill,
    difficulty: (skillCheck as any).difficulty || 0,
    shifts: (skillCheck as any).shifts || 0,
    outcome
  };
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
  includeDeltas: boolean = true,
  format: ExportFormat = 'playreport'
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
  if (format !== 'technical') {
    lines.push(`> *This is a ${format === 'story' ? 'story-focused' : 'play report'} export*`);
  }
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
        // BUG-006 Fix: Format aspect objects properly
        const aspectStrings = state.player.aspects.map((a: any) => {
          if (typeof a === 'string') return a;
          if (a.name) return `${a.name} (${a.type || 'aspect'})`;
          return JSON.stringify(a);
        });
        lines.push(`- **Aspects**: ${aspectStrings.join(', ')}`);
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
    const rawTurns = await loader.loadTurns(session.id, 1, 10000);

    // Deduplicate turns by turnId - keep the most complete version (one with playerReasoning)
    const turnMap = new Map<number, Turn>();
    for (const turn of rawTurns) {
      const existing = turnMap.get(turn.turnId);
      if (!existing) {
        turnMap.set(turn.turnId, turn);
      } else {
        // Keep the version with more data (playerReasoning indicates complete turn)
        if ((turn as any).playerReasoning && !(existing as any).playerReasoning) {
          turnMap.set(turn.turnId, turn);
        }
      }
    }

    // Sort turns by turnId
    const turns = Array.from(turnMap.values()).sort((a, b) => a.turnId - b.turnId);

    if (turns.length === 0) {
      lines.push('*No turns recorded*');
      lines.push('');
    } else {
      // Track export statistics for validation
      let exportedTurns = 0;

      for (const turn of turns) {
        exportedTurns++;
        const timeStr = turn.gameTime 
          ? `Day ${turn.gameTime.day}, ${turn.gameTime.timeOfDay}`
          : 'Unknown time';
        
        lines.push(`### Turn ${turn.turnId}`);
        lines.push('');
        
        if (format === 'technical') {
          // Technical format - detailed tables
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
          
          // Include narration if available
          if ((turn as any).narration) {
            lines.push('#### GM Narration');
            lines.push('');
            lines.push((turn as any).narration);
            lines.push('');
          }
          
          // Include AI player reasoning if available
          if ((turn as any).playerReasoning) {
            lines.push('#### AI Player Reasoning');
            lines.push('');
            lines.push((turn as any).playerReasoning);
            lines.push('');
          }
        } else {
          // Story or Playreport format - narrative focus
          const playerAction = extractPlayerAction(turn);
          const rollInfo = extractRollInfo(turn);
          
          // Show game time as a story element
          if (format === 'playreport') {
            lines.push(`*${timeStr}*`);
            lines.push('');
          }
          
          // Player Action (what the player tried to do)
          if (playerAction) {
            lines.push(`**Player Action:** ${playerAction}`);
            lines.push('');
          }
          
          // Dice roll and outcome (playreport only)
          if (rollInfo && format === 'playreport') {
            const diceStr = formatDice(rollInfo.dice);
            const outcomeEmoji = rollInfo.shifts >= 3 ? '✨' : 
                                 rollInfo.shifts >= 0 ? '✓' : 
                                 rollInfo.shifts === 0 ? '⚖️' : '✗';
            lines.push(`> 🎲 *${rollInfo.skill}* ${diceStr} = **${rollInfo.total}** vs Difficulty ${rollInfo.difficulty}`);
            lines.push(`> ${outcomeEmoji} **${rollInfo.outcome}** (${rollInfo.shifts >= 0 ? '+' : ''}${rollInfo.shifts} shifts)`);
            lines.push('');
          }
          
          // GM Narration (the main story content)
          if ((turn as any).narration) {
            lines.push((turn as any).narration);
            lines.push('');
          }
          
          // AI Player Reasoning (in collapsible for playreport, hidden for story)
          if ((turn as any).playerReasoning && format === 'playreport') {
            lines.push('<details>');
            lines.push('<summary>🤔 AI Player Reasoning</summary>');
            lines.push('');
            lines.push(`*${(turn as any).playerReasoning}*`);
            lines.push('');
            lines.push('</details>');
            lines.push('');
          }
          
          // Events (collapsible for playreport, hidden for story)
          if (turn.events && turn.events.length > 0 && format === 'playreport') {
            // Filter to only interesting events
            const interestingEvents = turn.events.filter((e: any) => 
              ['knowledge_gain', 'quest_update', 'combat', 'dialogue', 'location_change', 
               'fate_point_spend', 'fate_point_award', 'fate_compel'].includes(e.type)
            );
            
            if (interestingEvents.length > 0) {
              lines.push('<details>');
              lines.push('<summary>📌 Game Events</summary>');
              lines.push('');
              for (const event of interestingEvents) {
                lines.push(...formatEvent(event));
              }
              lines.push('');
              lines.push('</details>');
              lines.push('');
            }
          }
        }
        
        // Load deltas for this turn if requested and in technical mode
        if (includeDeltas && format === 'technical') {
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

      // Export validation: Warn if turns are missing
      if (exportedTurns < turns.length) {
        console.warn(`⚠️ WARNING: Exported ${exportedTurns} of ${turns.length} turns!`);
      } else {
        console.log(`✅ Export complete: ${exportedTurns} turns exported`);
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
      
      // Ask for format
      console.log('Export formats:');
      console.log('  1. story     - Narrative focus, minimal mechanics');
      console.log('  2. playreport - Mix of narrative and key mechanics (default)');
      console.log('  3. technical - Detailed log with all events and deltas');
      console.log('');
      const formatInput = await prompt(rl, 'Choose format [1/2/3]: ');
      const format: ExportFormat = formatInput === '1' ? 'story' : 
                                   formatInput === '3' ? 'technical' : 'playreport';
      
      const includeDeltas = format === 'technical';
      
      // Ask for output filename
      const defaultFilename = `${selectedSession.id}.md`;
      const filenameInput = await prompt(rl, `Output filename [${defaultFilename}]: `);
      const filename = filenameInput || defaultFilename;
      
      // Generate and save
      console.log('');
      console.log(`📝 Generating ${format} Markdown...`);
      
      try {
        const markdown = await generateMarkdown(basePath, selectedSession, includeDeltas, format);
        
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

async function exportDirect(sessionId: string, options: { noDeltas?: boolean, output?: string, format?: ExportFormat }) {
  const basePath = path.resolve(__dirname, '..');
  const format = options.format || 'playreport';
  
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
  
  console.log(`📝 Generating ${format} Markdown for ${sessionId}...`);
  
  const includeDeltas = format === 'technical' && !options.noDeltas;
  const markdown = await generateMarkdown(basePath, session, includeDeltas, format);
  
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
  --format <type>     Export format: story, playreport (default), or technical
  --output <file>     Specify output filename (default: <sessionId>.md)

Format Types:
  story       - Narrative focus, minimal mechanics. Best for reading as a story.
  playreport  - Mix of narrative and key mechanics. Good for sharing sessions.
  technical   - Detailed log with all events, deltas, and state changes.

Examples:
  npx tsx src/exportSessionToMarkdown.ts
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356 --format story
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356 --format playreport
  npx tsx src/exportSessionToMarkdown.ts granite-10min-test-1764180846356 --output my-session.md

The interactive menu allows you to:
  - Browse all available sessions (regular and test sessions)
  - View session info (player, date, turn count)
  - Select a session to export
  - Choose export format
  - Specify the output filename

Exported files are saved to: packages/cli/exports/
`);
    return;
  }
  
  // Check for direct export mode (first non-flag argument is session ID)
  const sessionId = args.find(a => !a.startsWith('--'));
  
  if (sessionId) {
    const outputIdx = args.indexOf('--output');
    const output = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
    
    const formatIdx = args.indexOf('--format');
    const formatArg = formatIdx !== -1 ? args[formatIdx + 1] : undefined;
    const format: ExportFormat = formatArg === 'story' ? 'story' : 
                                  formatArg === 'technical' ? 'technical' : 'playreport';
    
    await exportDirect(sessionId, { output, format });
  } else {
    await runInteractiveMenu();
  }
}

main().catch(console.error);

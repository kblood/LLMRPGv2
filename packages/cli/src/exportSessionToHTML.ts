/**
 * Session to HTML Exporter
 *
 * Generates styled HTML exports of sessions with multiple format options:
 * - Story format: Narrative-focused with rich styling
 * - Character arc: Development visualization
 * - Campaign summary: Metrics and key events
 */

import { FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import { Turn, Delta } from '@llmrpg/core';
import path from 'path';
import fs from 'fs';

interface SessionInfo {
  id: string;
  folder: string;
  metadata?: any;
  turnCount?: number;
}

type ExportFormat = 'story' | 'arc' | 'summary';

// CSS Styles for HTML export
const CSS_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    padding: 20px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 40px;
    text-align: center;
  }

  header h1 {
    font-size: 2.5em;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }

  header .subtitle {
    font-size: 1.1em;
    opacity: 0.9;
  }

  .meta-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    padding: 30px;
    background: #f8f9fa;
    border-bottom: 2px solid #e9ecef;
  }

  .meta-item {
    padding: 15px;
    background: white;
    border-radius: 4px;
    border-left: 4px solid #667eea;
  }

  .meta-label {
    font-size: 0.9em;
    color: #6c757d;
    text-transform: uppercase;
    margin-bottom: 5px;
  }

  .meta-value {
    font-size: 1.4em;
    font-weight: bold;
    color: #667eea;
  }

  .content {
    padding: 40px;
  }

  section {
    margin-bottom: 40px;
  }

  section h2 {
    color: #667eea;
    font-size: 1.8em;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e9ecef;
  }

  .turn-entry {
    padding: 20px;
    margin-bottom: 20px;
    background: #f8f9fa;
    border-radius: 4px;
    border-left: 4px solid #667eea;
    transition: all 0.3s ease;
  }

  .turn-entry:hover {
    background: #e7e8ff;
    border-left-color: #764ba2;
  }

  .turn-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e9ecef;
  }

  .turn-number {
    font-size: 0.9em;
    color: #6c757d;
    text-transform: uppercase;
    font-weight: bold;
  }

  .turn-actor {
    font-size: 1.2em;
    font-weight: bold;
    color: #667eea;
  }

  .turn-time {
    font-size: 0.85em;
    color: #6c757d;
  }

  .turn-narration {
    font-style: italic;
    color: #495057;
    margin: 15px 0;
    line-height: 1.8;
  }

  .turn-events {
    margin-top: 15px;
  }

  .event {
    padding: 10px;
    margin-bottom: 10px;
    background: white;
    border-radius: 4px;
    border-left: 3px solid #dee2e6;
    font-size: 0.95em;
  }

  .event-skill_check {
    border-left-color: #ffc107;
    background: #fffbf0;
  }

  .event-combat {
    border-left-color: #dc3545;
    background: #fff5f5;
  }

  .event-dialogue {
    border-left-color: #17a2b8;
    background: #f0f8ff;
  }

  .event-quest_update {
    border-left-color: #28a745;
    background: #f0fff4;
  }

  .dice-roll {
    font-family: 'Courier New', monospace;
    background: #f8f9fa;
    padding: 8px 12px;
    border-radius: 4px;
    margin: 5px 0;
  }

  .roll-success {
    color: #28a745;
    font-weight: bold;
  }

  .roll-failure {
    color: #dc3545;
    font-weight: bold;
  }

  .arc-container {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 30px;
  }

  .arc-timeline {
    position: relative;
    padding-left: 30px;
  }

  .arc-event {
    position: relative;
    padding: 15px;
    margin-bottom: 20px;
    background: #f8f9fa;
    border-radius: 4px;
    border-left: 3px solid #667eea;
  }

  .arc-event::before {
    content: '';
    position: absolute;
    left: -18px;
    top: 25px;
    width: 12px;
    height: 12px;
    background: #667eea;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 2px #667eea;
  }

  .arc-event.milestone::before {
    width: 16px;
    height: 16px;
    left: -21px;
    top: 22px;
    background: #764ba2;
    box-shadow: 0 0 0 2px #764ba2;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 20px;
    margin: 20px 0;
  }

  .stat-box {
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 4px;
    text-align: center;
  }

  .stat-number {
    font-size: 2em;
    font-weight: bold;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 0.9em;
    opacity: 0.9;
  }

  footer {
    padding: 20px 40px;
    background: #f8f9fa;
    border-top: 1px solid #e9ecef;
    text-align: center;
    color: #6c757d;
    font-size: 0.9em;
  }

  @media print {
    body {
      background: white;
      padding: 0;
    }

    .container {
      box-shadow: none;
    }

    .turn-entry:hover {
      background: #f8f9fa;
      border-left-color: #667eea;
    }

    page-break-inside: avoid;
  }

  @media (max-width: 768px) {
    header h1 {
      font-size: 1.8em;
    }

    .meta-info {
      grid-template-columns: 1fr;
    }

    .arc-container {
      grid-template-columns: 1fr;
    }

    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
`;

// Helper functions
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function generateSessionHeader(sessionId: string, metadata: any): string {
  const title = metadata?.theme?.name || 'Untitled Session';
  const turns = metadata?.totalTurns || 0;
  const date = metadata?.createdAt ? formatDate(new Date(metadata.createdAt).getTime()) : 'Unknown';

  return `
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">Session Report</div>
    </header>
    <div class="meta-info">
      <div class="meta-item">
        <div class="meta-label">Session ID</div>
        <div class="meta-value">${sessionId.substring(0, 8)}...</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Total Turns</div>
        <div class="meta-value">${turns}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Date</div>
        <div class="meta-value">${date}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Theme</div>
        <div class="meta-value">${escapeHtml(metadata?.theme?.description || 'N/A')}</div>
      </div>
    </div>
  `;
}

function generateTurnEntry(turn: Turn, turnIndex: number): string {
  const actor = turn.actor || 'Unknown';
  const narration = turn.narration || '';
  const timestamp = turn.timestamp || Date.now();

  let eventsHtml = '';
  if (turn.events && turn.events.length > 0) {
    eventsHtml = '<div class="turn-events">';
    for (const event of turn.events) {
      const eventType = (event as any).type || 'unknown';
      let eventClass = `event event-${eventType}`;

      let eventContent = `<strong>${eventType}:</strong> ${escapeHtml((event as any).description || '')}`;

      // Add dice roll info if present
      if ((event as any).roll) {
        const roll = (event as any).roll;
        const diceStr = roll.dice
          ? roll.dice.map((d: number) => (d > 0 ? '+' : '') + d).join(' ')
          : 'N/A';
        eventContent += `<div class="dice-roll">Roll: [${diceStr}] = ${roll.total}</div>`;
      }

      eventsHtml += `<div class="${eventClass}">${eventContent}</div>`;
    }
    eventsHtml += '</div>';
  }

  return `
    <div class="turn-entry">
      <div class="turn-header">
        <span class="turn-number">Turn ${turnIndex}</span>
        <span class="turn-actor">${escapeHtml(actor)}</span>
        <span class="turn-time">${formatDate(timestamp)}</span>
      </div>
      <div class="turn-narration">${escapeHtml(narration)}</div>
      ${eventsHtml}
    </div>
  `;
}

function generateStoryFormat(turns: Turn[], metadata: any, sessionId: string): string {
  const turnEntries = turns
    .map((turn, idx) => generateTurnEntry(turn, idx + 1))
    .join('');

  return `
    ${generateSessionHeader(sessionId, metadata)}
    <div class="content">
      <section>
        <h2>Session Story</h2>
        ${turnEntries}
      </section>
    </div>
  `;
}

function generateArcFormat(turns: Turn[], metadata: any, sessionId: string): string {
  // Extract key moments from turns
  const arcEvents: any[] = [];
  let lastMilestone = 0;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const isMilestone = turn.events?.some((e: any) => e.type === 'quest_update' || e.type === 'knowledge_gain');

    if (isMilestone || i === 0 || i === turns.length - 1) {
      arcEvents.push({
        turn: i + 1,
        actor: turn.actor,
        narration: turn.narration,
        isMilestone: isMilestone || i === 0,
      });
    }
  }

  const eventsHtml = arcEvents
    .map(
      (event, idx) => `
    <div class="arc-event ${event.isMilestone ? 'milestone' : ''}">
      <strong>Turn ${event.turn}: ${escapeHtml(event.actor)}</strong>
      <p>${escapeHtml(event.narration)}</p>
    </div>
  `
    )
    .join('');

  const characterStats = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-number">${turns.length}</div>
        <div class="stat-label">Total Turns</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${arcEvents.length}</div>
        <div class="stat-label">Key Moments</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${turns.filter((t: any) => t.events?.some((e: any) => e.type === 'combat')).length}</div>
        <div class="stat-label">Combat Turns</div>
      </div>
    </div>
  `;

  return `
    ${generateSessionHeader(sessionId, metadata)}
    <div class="content">
      <section>
        <h2>Character Development Arc</h2>
        ${characterStats}
      </section>
      <section>
        <h2>Story Timeline</h2>
        <div class="arc-container">
          <div class="arc-timeline">
            ${eventsHtml}
          </div>
        </div>
      </section>
    </div>
  `;
}

function generateSummaryFormat(turns: Turn[], metadata: any, sessionId: string): string {
  // Calculate statistics
  const totalTurns = turns.length;
  const combatTurns = turns.filter((t: any) => t.events?.some((e: any) => e.type === 'combat')).length;
  const successfulChecks = turns.filter((t: any) =>
    t.events?.some((e: any) => e.type === 'skill_check' && (e as any).shifts >= 0)
  ).length;
  const questUpdates = turns.filter((t: any) => t.events?.some((e: any) => e.type === 'quest_update')).length;

  const summaryHtml = `
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-number">${totalTurns}</div>
        <div class="stat-label">Total Turns</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${combatTurns}</div>
        <div class="stat-label">Combat Turns</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${successfulChecks}</div>
        <div class="stat-label">Successful Checks</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${questUpdates}</div>
        <div class="stat-label">Quest Updates</div>
      </div>
    </div>
  `;

  const successRate = totalTurns > 0 ? ((successfulChecks / totalTurns) * 100).toFixed(1) : '0';

  return `
    ${generateSessionHeader(sessionId, metadata)}
    <div class="content">
      <section>
        <h2>Session Summary</h2>
        ${summaryHtml}
        <p><strong>Success Rate:</strong> ${successRate}%</p>
        <p><strong>Average Turns per Combat:</strong> ${combatTurns > 0 ? (totalTurns / combatTurns).toFixed(1) : 'N/A'}</p>
      </section>
    </div>
  `;
}

async function generateHTML(
  sessionId: string,
  format: ExportFormat,
  outputPath: string
): Promise<void> {
  try {
    const adapter = new FileSystemAdapter(path.join(__dirname, '../../../test-sessions'));
    const loader = new SessionLoader(adapter);

    const metadata = await loader.loadSessionMetadata(sessionId);
    // Load a large range of turns (assuming sessions don't exceed 10,000 turns)
    const turns = await loader.loadTurns(sessionId, 0, 10000);

    let contentHtml = '';
    switch (format) {
      case 'story':
        contentHtml = generateStoryFormat(turns, metadata, sessionId);
        break;
      case 'arc':
        contentHtml = generateArcFormat(turns, metadata, sessionId);
        break;
      case 'summary':
        contentHtml = generateSummaryFormat(turns, metadata, sessionId);
        break;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLMRPG Session Export</title>
  <style>
    ${CSS_STYLES}
  </style>
</head>
<body>
  <div class="container">
    ${contentHtml}
    <footer>
      <p>Generated by LLMRPG v2 | ${new Date().toLocaleString()}</p>
    </footer>
  </div>
</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`✅ HTML export saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error generating HTML:', error);
    throw error;
  }
}

// Export main function
export async function exportSessionAsHTML(
  sessionId: string,
  format: ExportFormat = 'story',
  outputPath?: string
): Promise<void> {
  const defaultPath = outputPath || `session-${sessionId}-${format}.html`;
  await generateHTML(sessionId, format, defaultPath);
}

export { CSS_STYLES, ExportFormat };

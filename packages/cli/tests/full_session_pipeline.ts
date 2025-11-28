/**
 * Full Session Pipeline Test
 *
 * Orchestrates the complete workflow:
 * 1. Wait for a session to be saved
 * 2. Continue the session
 * 3. Run statistical analysis
 * 4. Export to markdown
 * 5. Generate quality report
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');
const LAST_SESSION_FILE = path.join(STORAGE_PATH, 'LAST_SESSION_ID.txt');
const CONTINUATION_TURNS = 10;
const WAIT_TIMEOUT = 15 * 60 * 1000; // Wait up to 15 minutes for session

interface SessionStats {
  sessionId: string;
  initialTurns: number;
  continuationTurns: number;
  totalTurns: number;
  successRate: number;
  averageTurnTime: number;
  worldCoherence: number;
  storyQuality: number;
}

async function waitForSessionId(maxWait: number = WAIT_TIMEOUT): Promise<string> {
  console.log('⏳ Waiting for session to complete...\n');

  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (fs.existsSync(LAST_SESSION_FILE)) {
      const sessionId = fs.readFileSync(LAST_SESSION_FILE, 'utf-8').trim();
      if (sessionId && sessionId.length > 0) {
        console.log(`✅ Found session: ${sessionId}\n`);
        return sessionId;
      }
    }

    // Check every 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`   Waiting... (${elapsed}s elapsed)\r`);
  }

  throw new Error('Timeout waiting for session to complete');
}

async function runContinuationTest(sessionId: string): Promise<number> {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   CONTINUING SESSION                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  console.log(`📂 Continuing session: ${sessionId}`);
  console.log(`📊 Target: ${CONTINUATION_TURNS} additional turns\n`);

  try {
    const cmd = `npx tsx tests/session_continuation_test.ts ${sessionId}`;
    const output = execSync(cmd, { cwd: __dirname, encoding: 'utf-8' });
    console.log(output);

    // Extract turn count from output
    const match = output.match(/Added Turns:\s+(\d+)/);
    return match ? parseInt(match[1]) : 0;
  } catch (error: any) {
    console.error('Continuation test failed:', error.message);
    return 0;
  }
}

async function runAnalytics(sessionId: string): Promise<{ successRate: number; avgTurnTime: number }> {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   ANALYTICS & STATISTICS                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const cmd = `npx tsx src/exportSessionAnalytics.ts ${sessionId}`;
    const output = execSync(cmd, { cwd: __dirname, encoding: 'utf-8' });
    console.log(output);

    // Extract stats from output
    const successMatch = output.match(/Success Rate.*?([\d.]+)%/);
    const timeMatch = output.match(/Average Turn Time.*?([\d.]+)s/);

    return {
      successRate: successMatch ? parseFloat(successMatch[1]) : 0,
      avgTurnTime: timeMatch ? parseFloat(timeMatch[1]) : 0
    };
  } catch (error: any) {
    console.error('Analytics failed:', error.message);
    return { successRate: 0, avgTurnTime: 0 };
  }
}

async function exportToMarkdown(sessionId: string): Promise<string> {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   EXPORTING TO MARKDOWN                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const cmd = `npx tsx src/exportSessionToMarkdown.ts ${sessionId}`;
    const output = execSync(cmd, { cwd: __dirname, encoding: 'utf-8' });
    console.log(output);

    // Extract file path from output
    const match = output.match(/File: (.+\.md)/);
    return match ? match[1] : '';
  } catch (error: any) {
    console.error('Export failed:', error.message);
    return '';
  }
}

async function generateQualityReport(sessionId: string, filePath: string): Promise<{ worldCoherence: number; storyQuality: number }> {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   STORY QUALITY ANALYSIS                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Read the exported markdown
  if (!fs.existsSync(filePath)) {
    console.error(`Export file not found: ${filePath}`);
    return { worldCoherence: 0, storyQuality: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Analyze story quality
  const turnCount = lines.filter(l => l.match(/^### Turn \d+/)).length;
  const hasNarration = lines.some(l => l.includes('narration') || l.includes('📜'));
  const hasMeaningfulActions = lines.filter(l => l.includes('Action:')).length > turnCount * 0.7;
  const hasLocationVariety = /location|room|area|chamber|hall|passage/i.test(content);
  const hasCharacterInteraction = /speak|talk|ask|tell|chat|dialogue/i.test(content);
  const hasConflict = /combat|fight|attack|defend|enemy|threat|danger/i.test(content);

  // Score world coherence (0-100)
  let worldCoherence = 0;
  if (hasNarration) worldCoherence += 25;
  if (hasLocationVariety) worldCoherence += 25;
  if (hasCharacterInteraction) worldCoherence += 25;
  if (hasMeaningfulActions) worldCoherence += 25;

  // Score story quality (0-100)
  let storyQuality = 0;
  if (hasMeaningfulActions) storyQuality += 30;
  if (hasCharacterInteraction) storyQuality += 25;
  if (hasConflict) storyQuality += 20;
  if (hasLocationVariety) storyQuality += 15;
  if (hasNarration) storyQuality += 10;

  console.log('📊 Quality Metrics:');
  console.log(`   Turns: ${turnCount}`);
  console.log(`   ✅ Narration Present: ${hasNarration ? 'Yes' : 'No'}`);
  console.log(`   ✅ Meaningful Actions: ${hasMeaningfulActions ? 'Yes' : 'No'}`);
  console.log(`   ✅ Location Variety: ${hasLocationVariety ? 'Yes' : 'No'}`);
  console.log(`   ✅ Character Interaction: ${hasCharacterInteraction ? 'Yes' : 'No'}`);
  console.log(`   ✅ Conflict/Challenge: ${hasConflict ? 'Yes' : 'No'}`);
  console.log(`\n   🌍 World Coherence Score: ${worldCoherence}/100`);
  console.log(`   📖 Story Quality Score: ${storyQuality}/100`);

  return { worldCoherence, storyQuality };
}

async function runPipeline() {
  const startTime = Date.now();

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           FULL SESSION ANALYSIS PIPELINE                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Wait for session
    const sessionId = await waitForSessionId();

    // Get initial turn count from session meta
    const sessionDir = path.join(STORAGE_PATH, 'sessions', 'active', sessionId);
    let initialTurns = 0;
    try {
      const metaPath = path.join(sessionDir, 'session.meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        initialTurns = meta.turnCount || 0;
      }
    } catch (e) {
      console.warn('Could not read initial turn count');
    }

    // Run continuation
    const continuationTurns = await runContinuationTest(sessionId);

    // Get analytics
    const analytics = await runAnalytics(sessionId);

    // Export to markdown
    const exportFile = await exportToMarkdown(sessionId);

    // Generate quality report
    const quality = await generateQualityReport(sessionId, exportFile);

    // Final report
    const totalTurns = initialTurns + continuationTurns;
    const totalTime = Date.now() - startTime;

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                    FINAL SUMMARY REPORT                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 SESSION METRICS:');
    console.log(`   Session ID:           ${sessionId}`);
    console.log(`   Initial Turns:        ${initialTurns}`);
    console.log(`   Continuation Turns:   ${continuationTurns}`);
    console.log(`   Total Turns:          ${totalTurns}`);
    console.log(`\n⚡ PERFORMANCE:');
    console.log(`   Success Rate:         ${analytics.successRate.toFixed(1)}%`);
    console.log(`   Avg Turn Time:        ${analytics.avgTurnTime.toFixed(2)}s`);
    console.log(`\n🎭 STORY QUALITY:`);
    console.log(`   World Coherence:      ${quality.worldCoherence}/100`);
    console.log(`   Story Quality:        ${quality.storyQuality}/100`);
    console.log(`\n⏱️  PIPELINE DURATION:  ${((totalTime / 1000 / 60).toFixed(1))} minutes`);

    console.log(`\n📁 Exported Files:`);
    console.log(`   Markdown: ${exportFile}`);

    console.log('\n✅ PIPELINE COMPLETE\n');

    return { sessionId, initialTurns, continuationTurns, totalTurns, analytics, quality };

  } catch (error: any) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

// Run the pipeline
runPipeline();

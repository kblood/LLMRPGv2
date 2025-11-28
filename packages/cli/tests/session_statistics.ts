/**
 * Session Statistics & Quality Analysis
 * Analyzes completed sessions for gameplay metrics and story coherence
 */

import { SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');

interface SessionStats {
  sessionId: string;
  totalTurns: number;
  successCount: number;
  failureCount: number;
  compelCount: number;
  combatTurns: number;
  socialTurns: number;
  explorationTurns: number;
  locationCount: number;
  npcInteractions: number;
  averageNarrationLength: number;
  gameOverTurns: number; // Turns where game ended
  playerCharacterName: string;
  worldTheme: string;
  mainLocation: string;
}

async function analyzeSession(sessionId: string): Promise<SessionStats> {
  console.log(`\n📊 Analyzing session: ${sessionId}\n`);

  const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
  const loader = new SessionLoader(fsAdapter);

  try {
    await loader.loadSession(sessionId);
    const state = loader.getGameState();

    if (!state) {
      throw new Error('Could not load session state');
    }

    const stats: SessionStats = {
      sessionId,
      totalTurns: 0,
      successCount: 0,
      failureCount: 0,
      compelCount: 0,
      combatTurns: 0,
      socialTurns: 0,
      explorationTurns: 0,
      locationCount: 0,
      npcInteractions: 0,
      averageNarrationLength: 0,
      gameOverTurns: 0,
      playerCharacterName: state.player?.name || 'Unknown',
      worldTheme: state.world?.theme?.name || 'Unknown',
      mainLocation: state.currentScene?.name || 'Unknown'
    };

    // Analyze turns
    let totalNarrationLength = 0;
    const turns = state.turnHistory || [];
    stats.totalTurns = turns.length;

    const visitedLocations = new Set<string>();
    if (state.currentScene?.id) {
      visitedLocations.add(state.currentScene.id);
    }

    for (const turn of turns) {
      // Count result types
      if (turn.result === 'success' || turn.result === 'success_with_style') {
        stats.successCount++;
      } else if (turn.result === 'failure') {
        stats.failureCount++;
      } else if (turn.result === 'compel_offered') {
        stats.compelCount++;
      }

      // Analyze events
      for (const event of turn.events || []) {
        if (event.type === 'combat_attack' || event.type === 'combat_defend') {
          stats.combatTurns++;
        } else if (event.type === 'dialogue') {
          stats.socialTurns++;
          stats.npcInteractions++;
        } else if (event.type === 'travel') {
          stats.explorationTurns++;
        }

        // Track locations
        if ((event as any).location?.id) {
          visitedLocations.add((event as any).location.id);
        }
      }

      // Narration length
      if ((turn as any).narration) {
        totalNarrationLength += ((turn as any).narration as string).length;
      }

      // Game over check
      if ((turn as any).result === 'game_over') {
        stats.gameOverTurns++;
      }
    }

    stats.locationCount = visitedLocations.size;
    stats.averageNarrationLength = turns.length > 0 ? totalNarrationLength / turns.length : 0;

    return stats;

  } catch (error: any) {
    console.error('Error analyzing session:', error.message);
    throw error;
  }
}

function printStats(stats: SessionStats) {
  console.log('═'.repeat(70));
  console.log('📊 SESSION STATISTICS REPORT');
  console.log('═'.repeat(70));

  console.log('\n🎮 SESSION OVERVIEW');
  console.log(`   Session ID:          ${stats.sessionId}`);
  console.log(`   Player:              ${stats.playerCharacterName}`);
  console.log(`   World:               ${stats.worldTheme}`);
  console.log(`   Starting Location:   ${stats.mainLocation}`);

  console.log('\n📈 GAMEPLAY METRICS');
  console.log(`   Total Turns:         ${stats.totalTurns}`);
  console.log(`   Locations Visited:   ${stats.locationCount}`);
  console.log(`   NPC Interactions:    ${stats.npcInteractions}`);

  const successRate = stats.totalTurns > 0 ? ((stats.successCount / stats.totalTurns) * 100).toFixed(1) : '0';
  const failureRate = stats.totalTurns > 0 ? ((stats.failureCount / stats.totalTurns) * 100).toFixed(1) : '0';
  const compelRate = stats.totalTurns > 0 ? ((stats.compelCount / stats.totalTurns) * 100).toFixed(1) : '0';

  console.log('\n📊 TURN OUTCOMES');
  console.log(`   Success:             ${stats.successCount} (${successRate}%)`);
  console.log(`   Failure:             ${stats.failureCount} (${failureRate}%)`);
  console.log(`   Compel Offered:      ${stats.compelCount} (${compelRate}%)`);

  console.log('\n🎭 ACTION TYPES');
  console.log(`   Combat Turns:        ${stats.combatTurns}`);
  console.log(`   Social Turns:        ${stats.socialTurns}`);
  console.log(`   Exploration Turns:   ${stats.explorationTurns}`);

  console.log('\n✍️  NARRATION QUALITY');
  console.log(`   Avg Narration Length: ${stats.averageNarrationLength.toFixed(0)} characters`);

  if (stats.gameOverTurns > 0) {
    console.log(`\n⚠️  Game Over Turns:    ${stats.gameOverTurns}`);
  }

  console.log('\n' + '═'.repeat(70));
}

function generateQualityScore(stats: SessionStats): { score: number; grade: string; analysis: string } {
  let score = 0;
  const issues: string[] = [];
  const positives: string[] = [];

  // Success rate quality
  const successRate = stats.totalTurns > 0 ? (stats.successCount / stats.totalTurns) * 100 : 0;
  if (successRate >= 40) {
    score += 25;
    positives.push('Good success rate');
  } else if (successRate >= 25) {
    score += 15;
    positives.push('Acceptable success rate');
  } else {
    issues.push('Low success rate - world may be too punishing');
  }

  // Location variety
  if (stats.locationCount >= 5) {
    score += 20;
    positives.push('Good location variety');
  } else if (stats.locationCount >= 3) {
    score += 10;
    positives.push('Some location variety');
  } else {
    issues.push('Limited location exploration');
  }

  // NPC interactions
  if (stats.npcInteractions >= stats.totalTurns * 0.2) {
    score += 20;
    positives.push('Good NPC interaction');
  } else if (stats.npcInteractions > 0) {
    score += 10;
    positives.push('Some NPC interaction');
  } else {
    issues.push('No NPC interactions');
  }

  // Action variety
  const actionTypes = [stats.combatTurns > 0 ? 1 : 0, stats.socialTurns > 0 ? 1 : 0, stats.explorationTurns > 0 ? 1 : 0];
  const actionVariety = actionTypes.reduce((a, b) => a + b, 0);
  if (actionVariety === 3) {
    score += 20;
    positives.push('Excellent action variety');
  } else if (actionVariety === 2) {
    score += 10;
    positives.push('Good action variety');
  } else {
    issues.push('Limited action variety');
  }

  // Narration quality
  if (stats.averageNarrationLength > 100) {
    score += 15;
    positives.push('Detailed narration');
  } else if (stats.averageNarrationLength > 50) {
    score += 8;
    positives.push('Adequate narration');
  } else {
    issues.push('Short narration - less immersive');
  }

  // Determine grade
  let grade = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B+';
  else if (score >= 60) grade = 'B';
  else if (score >= 50) grade = 'C+';
  else if (score >= 40) grade = 'C';
  else if (score >= 30) grade = 'D';

  const analysis = [
    'POSITIVES:',
    ...positives.map(p => `  ✓ ${p}`),
    '',
    'AREAS FOR IMPROVEMENT:',
    ...issues.map(i => `  ✗ ${i}`)
  ].join('\n');

  return { score, grade, analysis };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx tests/session_statistics.ts <sessionId>');
    process.exit(1);
  }

  const sessionId = args[0];

  try {
    const stats = await analyzeSession(sessionId);
    printStats(stats);

    const quality = generateQualityScore(stats);
    console.log('\n🎭 STORY QUALITY ANALYSIS');
    console.log(`   Quality Score: ${quality.score}/100`);
    console.log(`   Grade: ${quality.grade}`);
    console.log('\n' + quality.analysis);

    console.log('\n✅ Analysis complete\n');
  } catch (error: any) {
    console.error('Failed to analyze session:', error.message);
    process.exit(1);
  }
}

main();

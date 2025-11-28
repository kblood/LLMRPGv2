/**
 * Session Analytics Exporter
 * 
 * Generates a technical analysis report of a session, focusing on:
 * - Action patterns and sequences
 * - Feature usage tracking
 * - Outcome statistics
 * - System coverage gaps
 */
import { FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import { Turn, GameEvent, EventType } from '@llmrpg/core';
import path from 'path';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface SessionInfo {
  id: string;
  folder: string;
  metadata?: any;
  turnCount?: number;
}

interface ActionStats {
  total: number;
  byType: Record<EventType | string, number>;
  bySkill: Record<string, number>;
  outcomes: {
    success: number;
    successWithStyle: number;
    tie: number;
    failure: number;
  };
}

interface FeatureUsage {
  name: string;
  category: string;
  used: boolean;
  count: number;
  firstTurn?: number;
  lastTurn?: number;
}

interface RepetitionPattern {
  action: string;
  consecutiveCount: number;
  totalCount: number;
  turnsUsed: number[];
}

interface AnalyticsReport {
  sessionId: string;
  exportTime: Date;
  
  // Basic stats
  totalTurns: number;
  uniqueTurns: number;
  sessionDuration: number; // ms
  
  // Action analysis
  actionStats: ActionStats;
  
  // Feature tracking
  features: FeatureUsage[];
  unusedFeatures: string[];
  
  // Repetition detection
  repetitionPatterns: RepetitionPattern[];
  repetitionScore: number; // 0-100, higher = more repetitive
  
  // Event distribution
  eventTypeCounts: Record<string, number>;
  
  // Skill usage
  skillUsage: Record<string, { uses: number; successes: number; failures: number }>;
  
  // Fate economy
  fatePoints: {
    spent: number;
    gained: number;
    compelsOffered: number;
    compelsAccepted: number;
    compelsRefused: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature Definitions
// ═══════════════════════════════════════════════════════════════════════════

const ALL_FEATURES: Array<{ name: string; category: string; detectFn: (events: GameEvent[], turns: Turn[]) => boolean }> = [
  // Fate Mechanics
  { name: 'Aspect Invocation (Free)', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.metadata?.freeInvoke) },
  { name: 'Aspect Invocation (Paid)', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.type === 'fate_point_spend' && ev.metadata?.reason === 'invoke') },
  { name: 'Compel Offered', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.type === 'fate_compel') },
  { name: 'Compel Accepted', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.type === 'fate_compel' && ev.metadata?.accepted === true) },
  { name: 'Compel Refused', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.type === 'fate_compel' && ev.metadata?.accepted === false) },
  { name: 'Boost Created', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.metadata?.boost || ev.action === 'create_advantage') },
  { name: 'Boost Consumed', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.metadata?.boostConsumed) },
  { name: 'Concession', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.metadata?.concession) },
  { name: 'Stress Taken', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.metadata?.stress || ev.metadata?.stressTaken) },
  { name: 'Consequence Taken', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.metadata?.consequence) },
  { name: 'Milestone/Advancement', category: 'Fate Mechanics', detectFn: (e) => e.some(ev => ev.type === 'quest_update' && ev.metadata?.milestone) },
  
  // World Systems
  { name: 'Zone Movement', category: 'World Systems', detectFn: (e) => e.some(ev => ev.type === 'move' || ev.metadata?.zoneChange) },
  { name: 'Trading', category: 'World Systems', detectFn: (e) => e.some(ev => ev.action === 'trade' || ev.metadata?.trade) },
  { name: 'Crafting', category: 'World Systems', detectFn: (e) => e.some(ev => ev.action === 'craft' || ev.metadata?.craft) },
  { name: 'Inventory Management', category: 'World Systems', detectFn: (e) => e.some(ev => ev.action === 'inventory_check' || ev.metadata?.inventory) },
  { name: 'NPC Relationship Change', category: 'World Systems', detectFn: (e) => e.some(ev => ev.metadata?.relationshipChange) },
  { name: 'Faction Reputation Change', category: 'World Systems', detectFn: (e) => e.some(ev => ev.metadata?.factionChange || ev.metadata?.reputationChange) },
  { name: 'Knowledge Discovery', category: 'World Systems', detectFn: (e) => e.some(ev => ev.type === 'knowledge_gain') },
  { name: 'Quest Started', category: 'World Systems', detectFn: (e) => e.some(ev => ev.type === 'quest_update' && ev.metadata?.status === 'started') },
  { name: 'Quest Completed', category: 'World Systems', detectFn: (e) => e.some(ev => ev.type === 'quest_update' && ev.metadata?.status === 'completed') },
  { name: 'Quest Stage Advanced', category: 'World Systems', detectFn: (e) => e.some(ev => ev.type === 'quest_update' && ev.metadata?.stageAdvance) },
  
  // Combat/Conflict
  { name: 'Physical Attack', category: 'Combat/Conflict', detectFn: (e) => e.some(ev => ev.type === 'combat_attack' && ev.metadata?.conflictType !== 'social') },
  { name: 'Physical Defense', category: 'Combat/Conflict', detectFn: (e) => e.some(ev => ev.type === 'combat_defend' && ev.metadata?.conflictType !== 'social') },
  { name: 'Social Attack', category: 'Combat/Conflict', detectFn: (e) => e.some(ev => ev.type === 'combat_attack' && ev.metadata?.conflictType === 'social') },
  { name: 'Social Defense', category: 'Combat/Conflict', detectFn: (e) => e.some(ev => ev.type === 'combat_defend' && ev.metadata?.conflictType === 'social') },
  { name: 'Group Conflict', category: 'Combat/Conflict', detectFn: (e) => e.some(ev => ev.metadata?.groupConflict) },
  { name: 'Declaration Made', category: 'Combat/Conflict', detectFn: (e) => e.some(ev => ev.metadata?.declaration) },
  
  // Fate Actions
  { name: 'Overcome Action', category: 'Fate Actions', detectFn: (e) => e.some(ev => ev.action === 'overcome') },
  { name: 'Create Advantage Action', category: 'Fate Actions', detectFn: (e) => e.some(ev => ev.action === 'create_advantage') },
  { name: 'Attack Action', category: 'Fate Actions', detectFn: (e) => e.some(ev => ev.action === 'attack') },
  { name: 'Defend Action', category: 'Fate Actions', detectFn: (e) => e.some(ev => ev.action === 'defend') },
  
  // Interactions
  { name: 'NPC Dialogue', category: 'Interactions', detectFn: (e) => e.some(ev => ev.type === 'dialogue') },
  { name: 'Environment Observation', category: 'Interactions', detectFn: (e) => e.some(ev => ev.type === 'observe') },
  { name: 'Object Interaction', category: 'Interactions', detectFn: (e) => e.some(ev => ev.type === 'interact') },
];

// ═══════════════════════════════════════════════════════════════════════════
// Analysis Functions
// ═══════════════════════════════════════════════════════════════════════════

function extractPlayerActionText(turn: Turn): string | null {
  // Try to extract the player's intended action from events or reasoning
  if (!turn.events || turn.events.length === 0) return null;
  
  const skillCheck = turn.events.find(e => e.type === 'skill_check');
  if (skillCheck?.description) {
    const match = skillCheck.description.match(/Player attempted to (.+?) using/);
    if (match) return match[1].trim().toLowerCase();
    return skillCheck.description.toLowerCase();
  }
  
  // Try other event types
  for (const event of turn.events) {
    if (event.description && event.actor === 'player') {
      return event.description.toLowerCase().substring(0, 100);
    }
  }
  
  return null;
}

function normalizeActionText(text: string): string {
  // Normalize action text for comparison
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

function aggregateActionTypes(turns: Turn[]): ActionStats {
  const stats: ActionStats = {
    total: 0,
    byType: {},
    bySkill: {},
    outcomes: { success: 0, successWithStyle: 0, tie: 0, failure: 0 }
  };
  
  for (const turn of turns) {
    if (!turn.events) continue;
    
    for (const event of turn.events) {
      stats.total++;
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      
      if (event.skill) {
        stats.bySkill[event.skill] = (stats.bySkill[event.skill] || 0) + 1;
      }
      
      if (event.shifts !== null && event.shifts !== undefined) {
        if (event.shifts >= 3) {
          stats.outcomes.successWithStyle++;
        } else if (event.shifts > 0) {
          stats.outcomes.success++;
        } else if (event.shifts === 0) {
          stats.outcomes.tie++;
        } else {
          stats.outcomes.failure++;
        }
      }
    }
  }
  
  return stats;
}

function trackFeatureUsage(events: GameEvent[], turns: Turn[]): FeatureUsage[] {
  return ALL_FEATURES.map(feature => {
    const used = feature.detectFn(events, turns);
    
    // Count occurrences and find first/last turn
    let count = 0;
    let firstTurn: number | undefined;
    let lastTurn: number | undefined;
    
    for (const turn of turns) {
      if (turn.events && feature.detectFn(turn.events, [turn])) {
        count++;
        if (firstTurn === undefined) firstTurn = turn.turnId;
        lastTurn = turn.turnId;
      }
    }
    
    return {
      name: feature.name,
      category: feature.category,
      used,
      count,
      firstTurn,
      lastTurn
    };
  });
}

function detectRepetitionPatterns(turns: Turn[]): RepetitionPattern[] {
  const patterns: RepetitionPattern[] = [];
  const actionCounts: Record<string, { count: number; turns: number[] }> = {};
  
  // Track each action
  for (const turn of turns) {
    const action = extractPlayerActionText(turn);
    if (!action) continue;
    
    const normalized = normalizeActionText(action);
    if (!normalized) continue;
    
    if (!actionCounts[normalized]) {
      actionCounts[normalized] = { count: 0, turns: [] };
    }
    actionCounts[normalized].count++;
    actionCounts[normalized].turns.push(turn.turnId);
  }
  
  // Detect consecutive repetition
  let lastAction: string | null = null;
  let consecutiveCount = 1;
  let consecutiveStart = 0;
  
  const consecutivePatterns: Map<string, number> = new Map();
  
  for (let i = 0; i < turns.length; i++) {
    const action = extractPlayerActionText(turns[i]);
    if (!action) continue;
    
    const normalized = normalizeActionText(action);
    
    if (normalized === lastAction) {
      consecutiveCount++;
    } else {
      // Record the previous streak if it was significant
      if (lastAction && consecutiveCount >= 3) {
        const existing = consecutivePatterns.get(lastAction) || 0;
        consecutivePatterns.set(lastAction, Math.max(existing, consecutiveCount));
      }
      lastAction = normalized;
      consecutiveCount = 1;
      consecutiveStart = i;
    }
  }
  
  // Final streak
  if (lastAction && consecutiveCount >= 3) {
    const existing = consecutivePatterns.get(lastAction) || 0;
    consecutivePatterns.set(lastAction, Math.max(existing, consecutiveCount));
  }
  
  // Build patterns array
  for (const [action, data] of Object.entries(actionCounts)) {
    if (data.count >= 3) { // Only report actions used 3+ times
      patterns.push({
        action,
        totalCount: data.count,
        consecutiveCount: consecutivePatterns.get(action) || 1,
        turnsUsed: data.turns
      });
    }
  }
  
  // Sort by total count descending
  patterns.sort((a, b) => b.totalCount - a.totalCount);
  
  return patterns.slice(0, 10); // Top 10 patterns
}

function calculateRepetitionScore(patterns: RepetitionPattern[], totalTurns: number): number {
  if (totalTurns < 5) return 0;
  
  // Higher score = more repetitive
  let score = 0;
  
  // Factor 1: Concentration in top action (0-40 points)
  const topPattern = patterns[0];
  if (topPattern) {
    const topRatio = topPattern.totalCount / totalTurns;
    score += topRatio * 40;
  }
  
  // Factor 2: Consecutive repetition (0-30 points)
  const maxConsecutive = Math.max(...patterns.map(p => p.consecutiveCount), 0);
  const consecutiveRatio = Math.min(maxConsecutive / 10, 1); // Cap at 10 consecutive
  score += consecutiveRatio * 30;
  
  // Factor 3: Variety (0-30 points) - fewer unique actions = higher score
  const uniqueActions = patterns.length;
  const varietyPenalty = Math.max(0, 1 - (uniqueActions / 10)); // Fewer than 10 unique = penalty
  score += varietyPenalty * 30;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

function countEventTypes(events: GameEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
  }
  return counts;
}

function calculateSkillUsage(events: GameEvent[]): Record<string, { uses: number; successes: number; failures: number }> {
  const skills: Record<string, { uses: number; successes: number; failures: number }> = {};
  
  for (const event of events) {
    let skill = event.skill;
    
    // Try to extract skill from description if not in skill field
    if (!skill && event.description) {
      const match = event.description.match(/using ([^(]+) \(\+?\d+\)/);
      if (match) {
        skill = match[1].trim();
      }
    }
    
    if (!skill) continue;
    
    if (!skills[skill]) {
      skills[skill] = { uses: 0, successes: 0, failures: 0 };
    }
    
    skills[skill].uses++;
    
    if (event.shifts !== null && event.shifts !== undefined) {
      if (event.shifts >= 0) {
        skills[skill].successes++;
      } else {
        skills[skill].failures++;
      }
    }
  }
  
  return skills;
}

function calculateFateEconomy(events: GameEvent[]): AnalyticsReport['fatePoints'] {
  return {
    spent: events.filter(e => e.type === 'fate_point_spend').length,
    gained: events.filter(e => e.type === 'fate_point_award').length,
    compelsOffered: events.filter(e => e.type === 'fate_compel').length,
    compelsAccepted: events.filter(e => e.type === 'fate_compel' && e.metadata?.accepted === true).length,
    compelsRefused: events.filter(e => e.type === 'fate_compel' && e.metadata?.accepted === false).length
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Report Generation
// ═══════════════════════════════════════════════════════════════════════════

async function generateAnalytics(basePath: string, session: SessionInfo): Promise<AnalyticsReport> {
  const sessionBasePath = session.folder === 'test-sessions' 
    ? path.join(basePath, 'test-sessions') 
    : basePath;
  
  const adapter = new FileSystemAdapter(sessionBasePath);
  const loader = new SessionLoader(adapter);
  
  // Load turns
  const rawTurns = await loader.loadTurns(session.id, 1, 10000);
  
  // Deduplicate
  const turnMap = new Map<number, Turn>();
  for (const turn of rawTurns) {
    const existing = turnMap.get(turn.turnId);
    if (!existing || ((turn as any).playerReasoning && !(existing as any).playerReasoning)) {
      turnMap.set(turn.turnId, turn);
    }
  }
  const turns = Array.from(turnMap.values()).sort((a, b) => a.turnId - b.turnId);
  
  // Collect all events
  const allEvents: GameEvent[] = [];
  for (const turn of turns) {
    if (turn.events) {
      allEvents.push(...turn.events);
    }
  }
  
  // Calculate session duration
  const firstTurn = turns[0];
  const lastTurn = turns[turns.length - 1];
  const duration = lastTurn && firstTurn ? lastTurn.timestamp - firstTurn.timestamp : 0;
  
  // Run analysis
  const actionStats = aggregateActionTypes(turns);
  const features = trackFeatureUsage(allEvents, turns);
  const unusedFeatures = features.filter(f => !f.used).map(f => f.name);
  const repetitionPatterns = detectRepetitionPatterns(turns);
  const repetitionScore = calculateRepetitionScore(repetitionPatterns, turns.length);
  const eventTypeCounts = countEventTypes(allEvents);
  const skillUsage = calculateSkillUsage(allEvents);
  const fatePoints = calculateFateEconomy(allEvents);
  
  return {
    sessionId: session.id,
    exportTime: new Date(),
    totalTurns: rawTurns.length,
    uniqueTurns: turns.length,
    sessionDuration: duration,
    actionStats,
    features,
    unusedFeatures,
    repetitionPatterns,
    repetitionScore,
    eventTypeCounts,
    skillUsage,
    fatePoints
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function generateMarkdownReport(report: AnalyticsReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# Session Analytics: ${report.sessionId}`);
  lines.push('');
  lines.push(`> Generated on ${report.exportTime.toLocaleString()}`);
  lines.push('');
  
  // Summary
  lines.push('## 📊 Session Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| **Total Turns (Raw)** | ${report.totalTurns} |`);
  lines.push(`| **Unique Turns** | ${report.uniqueTurns} |`);
  lines.push(`| **Session Duration** | ${formatDuration(report.sessionDuration)} |`);
  lines.push(`| **Total Events** | ${report.actionStats.total} |`);
  lines.push(`| **Repetition Score** | ${report.repetitionScore}/100 ${report.repetitionScore >= 50 ? '⚠️' : '✓'} |`);
  lines.push('');
  
  // Repetition Warning
  if (report.repetitionScore >= 50) {
    lines.push('### ⚠️ High Repetition Detected');
    lines.push('');
    lines.push('This session shows signs of the player getting stuck in a loop. Top repeated actions:');
    lines.push('');
    for (const pattern of report.repetitionPatterns.slice(0, 5)) {
      const percentage = Math.round((pattern.totalCount / report.uniqueTurns) * 100);
      lines.push(`- **"${pattern.action}"** - ${pattern.totalCount} times (${percentage}% of turns)${pattern.consecutiveCount >= 3 ? ` - ⚠️ ${pattern.consecutiveCount} consecutive` : ''}`);
    }
    lines.push('');
  }
  
  // Outcome Statistics
  lines.push('## 🎲 Outcome Statistics');
  lines.push('');
  const totalOutcomes = report.actionStats.outcomes.success + 
                        report.actionStats.outcomes.successWithStyle + 
                        report.actionStats.outcomes.tie + 
                        report.actionStats.outcomes.failure;
  
  if (totalOutcomes > 0) {
    lines.push('| Outcome | Count | Percentage |');
    lines.push('|---------|-------|------------|');
    lines.push(`| ✨ Success with Style | ${report.actionStats.outcomes.successWithStyle} | ${Math.round((report.actionStats.outcomes.successWithStyle / totalOutcomes) * 100)}% |`);
    lines.push(`| ✓ Success | ${report.actionStats.outcomes.success} | ${Math.round((report.actionStats.outcomes.success / totalOutcomes) * 100)}% |`);
    lines.push(`| ⚖️ Tie | ${report.actionStats.outcomes.tie} | ${Math.round((report.actionStats.outcomes.tie / totalOutcomes) * 100)}% |`);
    lines.push(`| ✗ Failure | ${report.actionStats.outcomes.failure} | ${Math.round((report.actionStats.outcomes.failure / totalOutcomes) * 100)}% |`);
    lines.push('');
  } else {
    lines.push('*No dice rolls recorded*');
    lines.push('');
  }
  
  // Event Type Distribution
  lines.push('## 📈 Event Type Distribution');
  lines.push('');
  const sortedEventTypes = Object.entries(report.eventTypeCounts)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedEventTypes.length > 0) {
    lines.push('| Event Type | Count |');
    lines.push('|------------|-------|');
    for (const [type, count] of sortedEventTypes) {
      lines.push(`| \`${type}\` | ${count} |`);
    }
    lines.push('');
  }
  
  // Skill Usage
  lines.push('## 🎯 Skill Usage');
  lines.push('');
  const sortedSkills = Object.entries(report.skillUsage)
    .sort((a, b) => b[1].uses - a[1].uses);
  
  if (sortedSkills.length > 0) {
    lines.push('| Skill | Uses | Successes | Failures | Success Rate |');
    lines.push('|-------|------|-----------|----------|--------------|');
    for (const [skill, stats] of sortedSkills) {
      const rate = stats.uses > 0 ? Math.round((stats.successes / stats.uses) * 100) : 0;
      lines.push(`| ${skill} | ${stats.uses} | ${stats.successes} | ${stats.failures} | ${rate}% |`);
    }
    lines.push('');
  } else {
    lines.push('*No skill checks recorded*');
    lines.push('');
  }
  
  // Fate Point Economy
  lines.push('## ⚡ Fate Point Economy');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Fate Points Spent | ${report.fatePoints.spent} |`);
  lines.push(`| Fate Points Gained | ${report.fatePoints.gained} |`);
  lines.push(`| Compels Offered | ${report.fatePoints.compelsOffered} |`);
  lines.push(`| Compels Accepted | ${report.fatePoints.compelsAccepted} |`);
  lines.push(`| Compels Refused | ${report.fatePoints.compelsRefused} |`);
  lines.push('');
  
  // Feature Usage
  lines.push('## ✅ Feature Usage Checklist');
  lines.push('');
  
  // Group by category
  const featuresByCategory: Record<string, FeatureUsage[]> = {};
  for (const feature of report.features) {
    if (!featuresByCategory[feature.category]) {
      featuresByCategory[feature.category] = [];
    }
    featuresByCategory[feature.category].push(feature);
  }
  
  for (const [category, features] of Object.entries(featuresByCategory)) {
    lines.push(`### ${category}`);
    lines.push('');
    for (const feature of features) {
      const icon = feature.used ? '✅' : '❌';
      const countStr = feature.count > 0 ? ` (${feature.count}x)` : '';
      lines.push(`- ${icon} ${feature.name}${countStr}`);
    }
    lines.push('');
  }
  
  // Unused Features Summary
  if (report.unusedFeatures.length > 0) {
    lines.push('## 🚫 Unused Features');
    lines.push('');
    lines.push('The following features were never triggered during this session:');
    lines.push('');
    for (const feature of report.unusedFeatures) {
      lines.push(`- ${feature}`);
    }
    lines.push('');
    lines.push('*Consider whether these features are hard to trigger or if the player never had the opportunity.*');
    lines.push('');
  }
  
  // Repetition Patterns
  if (report.repetitionPatterns.length > 0) {
    lines.push('## 🔄 Action Repetition Patterns');
    lines.push('');
    lines.push('| Action | Total Uses | Max Consecutive | % of Session |');
    lines.push('|--------|------------|-----------------|--------------|');
    for (const pattern of report.repetitionPatterns) {
      const percentage = Math.round((pattern.totalCount / report.uniqueTurns) * 100);
      const warning = pattern.consecutiveCount >= 5 ? ' ⚠️' : '';
      lines.push(`| "${pattern.action.substring(0, 40)}..." | ${pattern.totalCount} | ${pattern.consecutiveCount}${warning} | ${percentage}% |`);
    }
    lines.push('');
  }
  
  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by LLMRPGv2 Session Analytics*');
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Discovery (shared with main exporter)
// ═══════════════════════════════════════════════════════════════════════════

async function discoverSessions(basePath: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  
  const activePath = path.join(basePath, 'sessions', 'active');
  if (fs.existsSync(activePath)) {
    const dirs = fs.readdirSync(activePath);
    for (const dir of dirs) {
      const metaPath = path.join(activePath, dir, 'session.meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          sessions.push({ id: dir, folder: 'sessions', metadata });
        } catch {
          sessions.push({ id: dir, folder: 'sessions' });
        }
      }
    }
  }
  
  const testActivePath = path.join(basePath, 'test-sessions', 'sessions', 'active');
  if (fs.existsSync(testActivePath)) {
    const dirs = fs.readdirSync(testActivePath);
    for (const dir of dirs) {
      const metaPath = path.join(testActivePath, dir, 'session.meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          sessions.push({ id: dir, folder: 'test-sessions', metadata });
        } catch {
          sessions.push({ id: dir, folder: 'test-sessions' });
        }
      }
    }
  }
  
  return sessions;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Session Analytics Exporter
==========================

Generate technical analysis reports for session data.

Usage:
  npx tsx src/exportSessionAnalytics.ts <sessionId>
  npx tsx src/exportSessionAnalytics.ts <sessionId> --output report.md
  npx tsx src/exportSessionAnalytics.ts --list

Options:
  --output <file>  Specify output filename (default: <sessionId>-analytics.md)
  --list           List all available sessions
  --json           Output raw JSON instead of Markdown
  --help           Show this help

Features:
  - Action pattern analysis and repetition detection
  - Feature usage checklist (what was used vs unused)
  - Outcome statistics (success/failure rates)
  - Skill usage breakdown
  - Fate point economy tracking
  - Repetition score (0-100, higher = more repetitive)

Examples:
  npx tsx src/exportSessionAnalytics.ts granite-10min-test-1764256691345
  npx tsx src/exportSessionAnalytics.ts granite-10min-test-1764256691345 --json
`);
    return;
  }
  
  const basePath = path.resolve(__dirname, '..');
  const sessions = await discoverSessions(basePath);
  
  if (args.includes('--list')) {
    console.log('Available sessions:');
    for (const s of sessions) {
      console.log(`  - ${s.id} (${s.folder})`);
    }
    return;
  }
  
  const sessionId = args.find(a => !a.startsWith('--'));
  
  if (!sessionId) {
    console.error('❌ Please specify a session ID.');
    console.log('   Use --list to see available sessions.');
    process.exit(1);
  }
  
  const session = sessions.find(s => s.id === sessionId);
  if (!session) {
    console.error(`❌ Session "${sessionId}" not found.`);
    console.log('\nAvailable sessions:');
    for (const s of sessions) {
      console.log(`  - ${s.id}`);
    }
    process.exit(1);
  }
  
  console.log(`📊 Analyzing session: ${sessionId}...`);
  
  const report = await generateAnalytics(basePath, session);
  
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  
  const markdown = generateMarkdownReport(report);
  
  const outputIdx = args.indexOf('--output');
  const filename = outputIdx !== -1 ? args[outputIdx + 1] : `${sessionId}-analytics.md`;
  
  const outputPath = path.join(basePath, 'exports');
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const fullPath = path.join(outputPath, filename);
  fs.writeFileSync(fullPath, markdown, 'utf-8');
  
  console.log('');
  console.log('✅ Analytics report generated!');
  console.log(`   File: ${fullPath}`);
  console.log(`   Size: ${(markdown.length / 1024).toFixed(1)} KB`);
  console.log('');
  console.log(`📈 Summary:`);
  console.log(`   Turns: ${report.uniqueTurns}`);
  console.log(`   Repetition Score: ${report.repetitionScore}/100 ${report.repetitionScore >= 50 ? '⚠️ HIGH' : '✓ OK'}`);
  console.log(`   Features Used: ${report.features.filter(f => f.used).length}/${report.features.length}`);
}

main().catch(console.error);

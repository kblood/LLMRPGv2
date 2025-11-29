/**
 * Generates main quests/objectives that guide gameplay
 * Simple system for bounded games (8-10 locations, 1 main quest)
 */

import { WorldState, Location } from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

export interface GameQuest {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side';
  status: 'active' | 'completed' | 'failed';

  // Progression
  turnCreated: number;
  turnDeadline?: number;

  // Goals
  objectives: string[];  // Sub-goals
  completionCriteria: string;  // How to know it's done

  // Reward/Results
  rewards?: {
    description: string;
  };
}

export interface QuestState {
  mainQuest?: GameQuest;
  sideQuests: GameQuest[];
  completed: GameQuest[];
}

/**
 * Generate a main quest that requires exploration of multiple locations
 */
export function generateMainQuest(
  theme: WorldState['theme'],
  locations: Record<string, Location>,
  turn: number
): GameQuest {
  const questTemplates = [
    {
      title: 'Uncover the Ancient Secret',
      description: 'Explore the world and discover what ancient mystery lies hidden in these lands. Seek out clues in distant locations and piece together the truth.',
      objectives: [
        'Explore at least 5 different locations',
        'Discover the main mystery location',
        'Learn the truth about what happened here',
      ],
      completionCriteria: 'Reach the deepest or most significant location and understand its secrets',
    },
    {
      title: 'Find the Lost Artifact',
      description: 'Search for a legendary artifact said to be hidden somewhere in these lands. Ask around, explore hidden corners, and follow the clues.',
      objectives: [
        'Investigate different areas for clues',
        'Find the location where the artifact is hidden',
        'Retrieve the artifact and return with it',
      ],
      completionCriteria: 'Discover and secure the artifact at its hidden location',
    },
    {
      title: 'Solve the Mystery of This Place',
      description: 'Something feels off about these lands. Investigate the locations and NPCs to understand what\'s really going on.',
      objectives: [
        'Talk to inhabitants across multiple locations',
        'Gather evidence and clues about the situation',
        'Confront or resolve the central mystery',
      ],
      completionCriteria: 'Gain a complete understanding of the mystery and take definitive action',
    },
    {
      title: 'Restore Balance to the World',
      description: 'The world feels unstable. By exploring and understanding the locations, perhaps you can restore what has been lost.',
      objectives: [
        'Travel to the four corners of the world',
        'Understand what disrupted the balance',
        'Take action to restore it',
      ],
      completionCriteria: 'Successfully perform the ritual or action needed to restore balance',
    },
  ];

  const template = questTemplates[Math.floor(Math.random() * questTemplates.length)];

  return {
    id: uuidv4(),
    title: template.title,
    description: template.description,
    type: 'main',
    status: 'active',
    turnCreated: turn,
    turnDeadline: turn + 40,  // 40 turns to complete (plenty of time for 8-10 locations)
    objectives: template.objectives,
    completionCriteria: template.completionCriteria,
    rewards: {
      description: 'The satisfaction of understanding this world and its secrets',
    },
  };
}

/**
 * Generate 1-2 optional side quests for exploration flavor
 */
export function generateSideQuests(
  theme: WorldState['theme'],
  locations: Record<string, Location>,
  turn: number,
  count: number = 2
): GameQuest[] {
  const sideQuestTemplates = [
    {
      title: 'Help the Local Residents',
      description: 'The people here need assistance. Find out what troubles them and see if you can help.',
      objectives: ['Find someone who needs help', 'Learn what their problem is', 'Help resolve it'],
      completionCriteria: 'Successfully help at least one person',
    },
    {
      title: 'Explore Hidden Paths',
      description: 'There are rumors of secret passages and hidden areas. See if you can find them.',
      objectives: ['Search for hidden passages', 'Discover at least one secret area', 'Report back'],
      completionCriteria: 'Find and explore a hidden location',
    },
    {
      title: 'Gather Local Lore',
      description: 'Collect stories and information from the inhabitants. These tales might be useful.',
      objectives: ['Talk to at least 3 different NPCs', 'Gather their stories', 'Piece them together'],
      completionCriteria: 'Understand the local history and culture',
    },
  ];

  const quests: GameQuest[] = [];
  const shuffled = [...sideQuestTemplates].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const template = shuffled[i];
    quests.push({
      id: uuidv4(),
      title: template.title,
      description: template.description,
      type: 'side',
      status: 'active',
      turnCreated: turn,
      turnDeadline: turn + 20,
      objectives: template.objectives,
      completionCriteria: template.completionCriteria,
      rewards: {
        description: 'Additional understanding and perspective',
      },
    });
  }

  return quests;
}

/**
 * Initialize quest state for a new game
 */
export function initializeQuestState(
  theme: WorldState['theme'],
  locations: Record<string, Location>,
  startTurn: number
): QuestState {
  return {
    mainQuest: generateMainQuest(theme, locations, startTurn),
    sideQuests: generateSideQuests(theme, locations, startTurn, 2),
    completed: [],
  };
}

/**
 * Format quest for display to player
 */
export function formatQuestForDisplay(quest: GameQuest): string {
  return `
📜 ${quest.title} (${quest.type.toUpperCase()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${quest.description}

OBJECTIVES:
${quest.objectives.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}

COMPLETION: ${quest.completionCriteria}
${quest.rewards ? `REWARD: ${quest.rewards.description}` : ''}
  `.trim();
}

/**
 * Get summary of current quests
 */
export function getQuestSummary(questState: QuestState): string {
  const lines: string[] = [];

  if (questState.mainQuest && questState.mainQuest.status === 'active') {
    lines.push(`🎯 Main Goal: ${questState.mainQuest.title}`);
  }

  const activeSide = questState.sideQuests.filter(q => q.status === 'active');
  if (activeSide.length > 0) {
    lines.push(`📋 Optional Quests: ${activeSide.map(q => q.title).join(', ')}`);
  }

  if (questState.completed.length > 0) {
    lines.push(`✅ Completed: ${questState.completed.length} quest${questState.completed.length !== 1 ? 's' : ''}`);
  }

  return lines.join('\n');
}

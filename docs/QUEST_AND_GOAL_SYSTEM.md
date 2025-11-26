# Quest and Goal System

## Overview

The Quest and Goal System provides a structured way to track player objectives, missions, and narrative progress. It is designed to be flexible enough for an LLM to manage while providing concrete state for the game engine.

## Core Concepts

### Quests
A **Quest** is a high-level mission or storyline. It has a title, description, and a set of objectives.

- **ID**: Unique identifier (UUID or slug).
- **Status**: `active`, `completed`, `failed`, `abandoned`.
- **Giver**: The NPC or entity that initiated the quest.
- **Rewards**: XP, items, reputation changes.

### Objectives
An **Objective** is a specific task required to advance or complete a quest.

- **Type**:
  - `visit`: Go to a location.
  - `kill`: Defeat an enemy.
  - `collect`: Obtain an item.
  - `talk`: Speak with an NPC.
  - `interact`: Use an object.
  - `custom`: Narrative goal.
- **Status**: `active`, `completed`, `failed`.
- **Progress**: `currentCount` / `requiredCount`.
- **Hidden**: Objectives can be hidden until discovered.

## Data Structures

### Quest Schema
```typescript
interface Quest {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  objectives: Objective[];
  giverId?: string;
  locationId?: string;
  rewards?: {
    xp?: number;
    items?: string[];
    reputation?: Record<string, number>;
  };
  isHidden: boolean;
}
```

### Objective Schema
```typescript
interface Objective {
  id: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  type: 'visit' | 'kill' | 'collect' | 'talk' | 'interact' | 'custom';
  targetId?: string;
  currentCount: number;
  requiredCount: number;
  isHidden: boolean;
}
```

## Integration

### World State
Quests are stored in the `WorldState` under the `quests` array. This ensures they are persisted with the session and available to the LLM context.

### LLM Role
The **Decision Engine** is responsible for analyzing player actions and narrative outcomes to determine if:
1. A new quest should be started.
2. An existing objective has been progressed or completed.
3. A quest has been completed or failed.

The `determineQuestUpdate` method in `DecisionEngine` prompts the LLM with the current action and outcome, asking for a JSON response detailing any quest updates.

### Game Master Role
The **Game Master** orchestrates the update process:
1. After an action is resolved and narrated, it calls `decisionEngine.determineQuestUpdate`.
2. If an update is returned, it uses `QuestManager` to apply changes to the state.
3. It logs a `quest_update` event (e.g., `new_quest`, `objective_update`, `quest_completed`).
4. It generates a delta for the state change.

## Event Types

- `quest_update`: The primary event type for all quest-related changes.
  - Action: `new_quest`, `objective_update`, `quest_completed`, `quest_failed`.
  - Metadata: Contains the quest ID, objective ID, and relevant details.

## Example Flow

1. **Player Action**: "I agree to help the village elder find his lost staff."
2. **Decision Engine**: Recognizes a commitment.
   - Returns: `{ type: "new", quest: { title: "The Elder's Staff", ... } }`
3. **Game Master**:
   - Adds quest to `WorldState`.
   - Logs `quest_update` event.
   - Narrates confirmation.

4. **Player Action**: "I find the staff in the cave."
5. **Decision Engine**: Recognizes objective completion.
   - Returns: `{ type: "update_objective", questId: "...", objectiveId: "find_staff", status: "completed" }`
6. **Game Master**:
   - Updates objective status.
   - Checks if quest is complete (if this was the last objective).
   - Logs updates.

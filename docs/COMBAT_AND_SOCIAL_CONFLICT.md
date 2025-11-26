# Combat and Social Conflict System

## Overview

The Conflict System in LLMRPGv2 is a unified engine for handling high-stakes, turn-based encounters. It supports both **Physical Combat** and **Social Conflict** using the same underlying mechanics, inspired by Fate Core.

## Core Architecture

### Unified Conflict Model
Both physical and social conflicts share the same structure:
- **Participants**: Player vs. Opposition (NPCs).
- **Turns**: Structured order of actions.
- **Exchanges**: Rounds of turns.
- **Stress & Consequences**: Damage tracking.
- **Resolution**: One side concedes or is "Taken Out".

### Differences
| Feature | Physical Combat | Social Conflict |
|---------|-----------------|-----------------|
| **Stress Track** | Physical | Mental |
| **Attack Skills** | Fight, Shoot | Provoke, Deceive, Rapport |
| **Defense Skills** | Athletics, Fight | Will, Empathy |
| **Consequences** | Injuries, Wounds | Shaken, Demoralized, Reputation Loss |
| **Goal** | Defeat, Kill, Capture | Persuade, Intimidate, Humiliate |

## Implementation

### CombatManager
The `CombatManager` class orchestrates the conflict loop.

- **`startConflict`**: Initializes a conflict state, determines participants, and rolls initiative.
- **`nextTurn`**: Advances the turn counter and determines the next actor.
- **`checkResolution`**: Checks if either side has been defeated based on the conflict type (Physical vs Mental stress).

### Game Master Integration
The `GameMaster` handles the high-level flow:

1. **Detection**: Checks if the current scene has an active conflict.
2. **Routing**: If active, routes player input to `processCombatTurn` instead of the standard exploration loop.
3. **Execution**:
   - **Player Turn**: Resolves player action, applies stress/consequences, narrates result.
   - **NPC Turns**: Iterates through NPC turns, using the LLM to decide actions, resolving them, and narrating.
4. **Loop**: Continues until the player's turn comes up again or the conflict ends.

## Social Conflict Flow

1. **Initiation**: Player challenges an NPC socially (e.g., "I demand you let us pass!").
2. **Setup**: GM calls `startSocialConflict`.
3. **Exchange**:
   - Player rolls **Provoke** vs NPC's **Will**.
   - Success deals **Mental Stress**.
   - NPC retaliates with **Deceive** vs Player's **Empathy**.
4. **Resolution**:
   - If NPC runs out of Mental Stress/Consequences, they are "Taken Out" (e.g., they break down, agree, or flee in shame).
   - If Player runs out, they are defeated (e.g., humiliated, forced to back down).

## Data Structures

### Conflict State
```typescript
interface ConflictState {
  id: string;
  type: 'physical' | 'mental' | 'social';
  participants: Participant[];
  turnOrder: string[]; // IDs
  currentTurnIndex: number;
  isResolved: boolean;
  winner?: 'player' | 'opposition';
}
```

### Stress Tracks
Characters have two stress tracks:
- **Physical**: Capacity based on Physique.
- **Mental**: Capacity based on Will.

## LLM Role

- **Action Decision**: For NPCs, the LLM decides the most logical action (Attack, Create Advantage, etc.) based on their personality and the current state.
- **Narration**: The LLM generates dynamic descriptions of attacks, defenses, and the emotional impact of social "hits".

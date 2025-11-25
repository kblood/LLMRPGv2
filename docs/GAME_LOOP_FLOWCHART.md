# Game Loop Flowchart - RPG with Game Master Control

## Overview

This document describes the main game loop using a **Turn-based** architecture with **Fate Core** mechanics.

**Related Documents:**
- [Turn and Action System](./TURN_AND_ACTION_SYSTEM.md) - Turn/Event/Scene definitions
- [Fate Mechanics Reference](./FATE_MECHANICS_REFERENCE.md) - Core RPG mechanics
- [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) - State change tracking
- [Session Logging and Replay](./SESSION_LOGGING_AND_REPLAY.md) - Persistence

---

## Master Game Loop (Turn-by-Turn)

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME START                                │
│                                                              │
│  1. GameMaster initializes world                            │
│     ├─ Create main quest + sub-quests                       │
│     ├─ Create side quests                                   │
│     └─ Create starting location                             │
│                                                              │
│  2. Initialize Player (Fate Character)                      │
│     ├─ Set High Concept & Trouble aspects                   │
│     ├─ Set skills (Fate ladder)                             │
│     ├─ Set starting aspects & stunts                        │
│     └─ Place at starting location                           │
│                                                              │
│  3. Initialize NPCs                                         │
│     ├─ Place at specific locations                          │
│     ├─ Set schedules/routines                               │
│     └─ Set initial relationships                            │
│                                                              │
│  4. Start First Scene                                       │
│     └─ Create scene with aspects and zones                  │
│                                                              │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
      ┌───────────────────────────────────┐
      │   START MAIN GAME LOOP            │
      │   (Each Turn)                     │
      └───────────┬───────────────────────┘
                  │
                  ▼
      ┌──────────────────────────────────────┐
      │  PLAYER INPUT / ACTION PHASE         │
      │                                      │
      │  Get player's declared action:       │
      │  ├─ Overcome (travel, unlock, etc)  │
      │  ├─ Create Advantage (prep, intel)  │
      │  ├─ Attack (in conflict)            │
      │  ├─ Defend (oppose attack)          │
      │  └─ Free actions (look, talk basic) │
      └──────────┬───────────────────────────┘
                 │
        ┌────────┴────────────────────┐
        │                             │
        ▼                             ▼
   [OVERCOME]              [CREATE ADVANTAGE]
   (See Overcome Loop)     (See Advantage Loop)
```

---

## Overcome Action Loop (Travel, Obstacles, etc.)

```
┌──────────────────────────────────────────────────────┐
│      PLAYER CHOOSES: "Travel to X" (Overcome)        │
│                                                      │
│  Fate Action: OVERCOME                              │
│  Skill: Athletics, Drive, or Stealth               │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│  GAME MASTER SETS OPPOSITION                         │
│  ─────────────────────────────                       │
│  • Easy journey: Mediocre (+0)                      │
│  • Moderate: Fair (+2)                              │
│  • Dangerous: Great (+4)                            │
│                                                      │
│  Or: Active opposition from NPC/environment         │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│  ROLL FATE DICE (4dF + Skill)                       │
│  ─────────────────────────                           │
│  Player rolls, compare to opposition                │
│                                                      │
│  SUCCESS: Travel unhindered                         │
│  SUCCESS w/STYLE: +boost or free invokes            │
│  TIE: Success with minor cost                       │
│  FAILURE: Complication or blocked                   │
└────────────┬─────────────────────────────────────────┘
             │
      ┌──────┴──────┬────────────┐
      │             │            │
      ▼             ▼            ▼
   [SUCCESS]     [TIE]       [FAILURE]
      │           │            │
      │           │            ▼
      │           │    ┌────────────────────────┐
      │           │    │ GM COMPELS or          │
      │           │    │ INTRODUCES CONFLICT    │
      │           │    │                        │
      │           │    │ • Random encounter     │
      │           │    │ • Environmental hazard │
      │           │    │ • Quest complication   │
      │           │    │                        │
      │           │    └────────┬───────────────┘
      │           │             │
      └────┬──────┴─────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  COLLECT DELTAS & LOG TURN                          │
│  ─────────────────────────                           │
│  • Player location change                            │
│  • Game time advancement                             │
│  • Any aspects created/removed                       │
│  • NPC schedule updates                              │
│                                                      │
│  RECORD: Turn log + Deltas                          │
│  RETURN TO MAIN LOOP                                │
└──────────────────────────────────────────────────────┘
```

---

## Location Discovery & Scene Creation

```
┌──────────────────────────────────────────────────────┐
│  PLAYER TRAVELS TO LOCATION X                        │
│                                                      │
│  Is Location X already defined?                      │
└────────────┬─────────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
    YES            NO
      │             │
      ▼             ▼
   [KNOWN]    [UNKNOWN - GENERATE]
      │             │
      │             ▼
      │    ┌─────────────────────────────┐
      │    │ GameMaster.fleshOutLocation │
      │    │ ────────────────────────────│
      │    │                             │
      │    │ 1. Analyze theme/context   │
      │    │    └─ World theme          │
      │    │    └─ Quest context        │
      │    │    └─ Location type        │
      │    │                             │
      │    │ 2. Generate zones          │
      │    │    (Fate: zones for        │
      │    │    movement in conflict)   │
      │    │    └─ Market Square        │
      │    │    └─ Tavern               │
      │    │    └─ Temple               │
      │    │                             │
      │    │ 3. Generate NPCs           │
      │    │    └─ 3-5 NPCs            │
      │    │    └─ With aspects         │
      │    │    └─ With skills          │
      │    │                             │
      │    │ 4. Create scene aspects    │
      │    │    ├─ Environmental        │
      │    │    ├─ Situational          │
      │    │    └─ With free invokes    │
      │    │                             │
      │    │ 5. Add to world state      │
      │    │    └─ Record as delta      │
      │    │                             │
      │    └────────┬────────────────────┘
      │             │
      └─────────┬───┘
                │
                ▼
    ┌──────────────────────────────────┐
    │ CREATE NEW SCENE                 │
    │ ─────────────────────────        │
    │ Scene: {                         │
    │   type: "exploration",           │
    │   location: "loc-xyz",           │
    │   aspects: [                     │
    │     "Crowded Marketplace",       │
    │     "Watchful Guards"            │
    │   ],                             │
    │   zones: [...],                  │
    │   npcsPresent: [...]            │
    │ }                                │
    │                                  │
    │ "You arrive at the marketplace..."│
    └─────────────┬────────────────────┘
                  │
                  ▼
         [RETURN TO MAIN LOOP]
```

---

## Create Advantage / Interaction Loop

```
┌──────────────────────────────────────────────────────┐
│    PLAYER CHOOSES: "Talk to NPC" / Gather Info      │
│                                                      │
│  Fate Action: CREATE ADVANTAGE                      │
│  Skill: Rapport, Empathy, Contacts, Investigate     │
└────────────┬─────────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
   NPC HERE?    NPC NOT HERE
      │             │
      ▼             ▼
  [INTERACT]   ❌ "NPC not here"
      │        └─ Return to main loop
      │
      ▼
┌──────────────────────────────────────────────────────┐
│  CHECK NPC DISPOSITION                               │
│  ────────────────────────                            │
│  • Relationship to player?                           │
│  • Hostile? Neutral? Friendly?                       │
│  • Any relevant aspects?                             │
└────────────┬─────────────────────────────────────────┘
             │
      ┌──────┴────────┬────────────┐
      │               │            │
      ▼               ▼            ▼
  [HOSTILE]  [NEUTRAL/FRIENDLY] [CONFLICT]
      │               │            │
      │               │            └─ ENTER CONFLICT
      │               │
      │               ▼
      │        ┌─────────────────────────┐
      │        │  CREATE ADVANTAGE       │
      │        │  (Fate Roll)            │
      │        │  ─────────────────────  │
      │        │                         │
      │        │ Roll: 4dF + Skill       │
      │        │ vs: NPC skill or set    │
      │        │ difficulty              │
      │        │                         │
      │        │ SUCCESS:                │
      │        │ • Create aspect with    │
      │        │   free invoke           │
      │        │ • "Trusts You"          │
      │        │ • "Revealed Secret"     │
      │        │                         │
      │        │ SUCCESS w/STYLE:        │
      │        │ • +2 free invokes       │
      │        │                         │
      │        │ TIE:                    │
      │        │ • Boost only            │
      │        │                         │
      │        │ FAILURE:                │
      │        │ • No aspect, or         │
      │        │ • NPC gets free invoke  │
      │        │                         │
      │        └────────┬────────────────┘
      │                 │
      │                 ▼
      │        ┌─────────────────────────┐
      │        │  NPC RESPONDS (LLM)    │
      │        │  ─────────────────────  │
      │        │                         │
      │        │ Based on:               │
      │        │ • NPC knowledge         │
      │        │ • Roll outcome          │
      │        │ • Existing aspects      │
      │        │ • Relationship          │
      │        │                         │
      │        │ Generates:              │
      │        │ • Dialogue              │
      │        │ • Information           │
      │        │ • Quest hooks           │
      │        │                         │
      │        └────────┬────────────────┘
      │                 │
      └─────────┬───────┘
                │
                ▼
     ┌─────────────────────────────┐
     │ COLLECT DELTAS & LOG TURN   │
     │                             │
     │ • Aspects created/invoked   │
     │ • Relationship changes      │
     │ • Knowledge transferred     │
     │ • Fate points spent/gained  │
     │                             │
     │ RETURN TO MAIN LOOP         │
     └─────────────────────────────┘
```

---

## Conflict Loop (Fate Core)

```
┌──────────────────────────────────────────────────────┐
│           CONFLICT INITIATED                          │
│                                                      │
│  GameMaster starts conflict scene                   │
│  • Set the scene (aspects, zones)                   │
│  • Determine turn order (Notice skill)              │
│  • Identify sides and goals                         │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│         CONFLICT EXCHANGE LOOP                       │
│         (Fate Core structure)                        │
│                                                      │
│  Each participant gets one action per exchange:     │
│                                                      │
│  PLAYER'S TURN:                                     │
│  1. Choose Fate Action:                             │
│     ├─ ATTACK (harm opponent)                       │
│     ├─ DEFEND (react to attack)                     │
│     ├─ CREATE ADVANTAGE (set up aspect)            │
│     └─ OVERCOME (change zone, remove obstacle)     │
│                                                      │
│  2. Roll: 4dF + Relevant Skill                      │
│     (Fight, Shoot, Athletics, etc.)                 │
│                                                      │
│  3. Resolve:                                         │
│     ├─ Compare to opposition roll                   │
│     ├─ Calculate shifts                             │
│     └─ Apply stress/consequences                    │
│                                                      │
│  OPPONENT'S TURN:                                   │
│  (Same structure, AI/LLM decides action)            │
│                                                      │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│  STRESS & CONSEQUENCES (Fate)                       │
│  ─────────────────────────                           │
│                                                      │
│  On successful Attack:                              │
│  • Shifts = Damage                                  │
│  • Target absorbs with stress boxes                 │
│  • Or takes consequences:                           │
│    ├─ Mild (-2 shifts, 1 aspect)                   │
│    ├─ Moderate (-4 shifts, 1 aspect)               │
│    └─ Severe (-6 shifts, 1 aspect)                 │
│                                                      │
│  If can't absorb → TAKEN OUT                        │
│  • Winner narrates outcome                          │
│  • Or: CONCEDE before taken out                    │
│    └─ Lose, but control narrative + get Fate point │
│                                                      │
└────────────┬─────────────────────────────────────────┘
             │
      ┌──────┴──────────┬──────────┐
      │                 │          │
      ▼                 ▼          ▼
   [VICTORY]      [DEFEAT]    [CONCESSION]
      │                │          │
      ▼                ▼          ▼
  ┌────────┐      ┌────────┐  ┌────────┐
  │ Loot   │      │ Taken  │  │ Player │
  │ Aspects│      │ Out    │  │ loses  │
  │ removed│      │ Conseq │  │ but    │
  │ Quest  │      │ or     │  │ gets   │
  │ updates│      │ Death  │  │ Fate   │
  │        │      │        │  │ point  │
  └────┬───┘      └────┬───┘  └───┬────┘
       │               │          │
       └───────┬───────┴──────────┘
               │
               ▼
      ┌─────────────────────────┐
      │ END CONFLICT SCENE      │
      │                         │
      │ • Log all exchanges     │
      │ • Record all deltas     │
      │ • Create snapshot       │
      │ • Start new scene       │
      └─────────────────────────┘
```

---

## NPC Schedule & GM Turn Loop

```
┌──────────────────────────────────────────────────────┐
│     NPC BEHAVIOR PHASE (GM Turns between Player)     │
│                                                      │
│  For each active NPC in current/nearby scenes:      │
│  ├─ Check if schedule dictates action               │
│  ├─ Update location (delta: npc.location)           │
│  ├─ Check if should approach player                 │
│  ├─ Check if should gossip (knowledge spread)       │
│  └─ Update internal state (deltas)                  │
│                                                      │
└──────────────────────────────────────────────────────┘

Example NPC Schedule (Game Time based):
┌─────────────────────────────┐
│ Morning:                    │
│  └─ At home, sleeping       │
│                             │
│ Late Morning:               │
│  └─ Travel to workplace     │
│                             │
│ Midday:                     │
│  └─ At workplace            │
│                             │
│ Afternoon:                  │
│  └─ At tavern               │
│                             │
│ Evening:                    │
│  └─ Return home             │
│                             │
│ Night:                      │
│  └─ Home, sleeping          │
└─────────────────────────────┘

All NPC movements generate deltas:
{
  op: "set",
  path: "npcs.npc-merchant.currentLocation",
  value: "loc-tavern",
  previousValue: "loc-market"
}
```

---

## Game Master Decision Points

```
┌──────────────────────────────────────────────────────┐
│  GAME MASTER DECISION ENGINE                         │
│  (Compels, Complications, Pacing)                   │
│  ──────────────────────────────────────             │
│                                                      │
│  When player action occurs, GM evaluates:           │
│                                                      │
│  1. Aspect Compels                                   │
│     └─ Can player's Trouble aspect complicate?     │
│     └─ Offer Fate point for complication           │
│                                                      │
│  2. Story Pacing                                     │
│     └─ Is player stuck? Offer hints via aspects    │
│     └─ Too easy? Introduce opposition              │
│                                                      │
│  3. Quest Progress                                   │
│     └─ Which active quests affected?               │
│     └─ Create aspects reflecting progress          │
│                                                      │
│  4. NPC Reactions                                    │
│     └─ Which NPCs should react?                     │
│     └─ Update NPC aspects/attitudes                │
│                                                      │
│  5. Scene Management                                 │
│     └─ Should current scene end?                   │
│     └─ Time for a new scene type?                  │
│                                                      │
│  Decision outputs (as deltas):                       │
│  ├─ Allow action → record result                   │
│  ├─ Compel aspect → offer Fate point               │
│  ├─ Create complication → new aspects              │
│  ├─ Start conflict → new conflict scene            │
│  └─ Advance story → update quest state             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## State Update & Delta Collection

```
┌──────────────────────────────────────────────────────┐
│    END OF TURN - COLLECT ALL DELTAS                  │
│                                                      │
│  1. Player State Deltas                              │
│     ├─ Location, zone changes                       │
│     ├─ Stress/Consequences changes                  │
│     ├─ Fate point changes                           │
│     ├─ Aspect changes                               │
│     └─ Inventory changes                            │
│                                                      │
│  2. World State Deltas                               │
│     ├─ NPC location/state changes                   │
│     ├─ Scene aspect changes                         │
│     ├─ Quest progress changes                       │
│     └─ Knowledge spread                             │
│                                                      │
│  3. Scene State Deltas                               │
│     ├─ Zone changes                                 │
│     ├─ NPCs entering/leaving                        │
│     └─ Aspect changes                               │
│                                                      │
│  4. Log Turn                                         │
│     └─ Append to turns file (JSONL)                │
│                                                      │
│  5. Log Deltas                                       │
│     └─ Append to deltas file (JSONL)               │
│                                                      │
│  6. Check Snapshot Triggers                          │
│     ├─ 100 turns since last?                        │
│     ├─ Scene ended?                                 │
│     ├─ Conflict resolved?                           │
│     └─ Create snapshot if needed                    │
│                                                      │
│  7. Publish to UI                                    │
│     └─ Send state update event                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Complete Turn Execution Summary

```
EACH GAME TURN:
┌─────────────────────────────────────────┐
│ 1. Get Player Action                    │
│    └─ Overcome/Create/Attack/Defend    │
│                                         │
│ 2. GameMaster Evaluates                │
│    └─ Compels? Opposition? Difficulty? │
│                                         │
│ 3. Roll Fate Dice (4dF + Skill)        │
│    └─ Determine outcome & shifts       │
│                                         │
│ 4. Execute Action Result               │
│    ├─ Overcome Loop                    │
│    ├─ Create Advantage Loop            │
│    ├─ Conflict Loop                    │
│    └─ Or scene/travel resolution       │
│                                         │
│ 5. LLM Narrates Outcome                │
│    └─ Based on roll, aspects, context  │
│                                         │
│ 6. Collect Deltas                      │
│    └─ All state changes recorded       │
│                                         │
│ 7. Log Turn + Deltas                   │
│    └─ Append to JSONL files            │
│                                         │
│ 8. GM Turn (if applicable)             │
│    └─ NPC schedules, world events      │
│                                         │
│ 9. Check Snapshot Triggers             │
│    └─ Create snapshot if needed        │
│                                         │
│ 10. Next Turn                          │
│     └─ Repeat                          │
└─────────────────────────────────────────┘

TIMING:
• Each turn = 1 player action
• GM turns happen between player turns
• Scenes contain multiple turns
• Conflicts use exchange structure
• Game time advances per scene
```

---

## Key Loop Features

### Overcome Loop Benefits (Fate)
- ✅ Skill-based resolution
- ✅ Clear difficulty ladder
- ✅ Success at cost option
- ✅ Aspect invocation for bonuses
- ✅ Delta tracking of results

### Create Advantage Loop Benefits
- ✅ Aspect creation for setup
- ✅ Free invokes for later
- ✅ Information gathering
- ✅ NPC relationship building
- ✅ Knowledge transfer tracking

### Conflict Loop Benefits (Fate)
- ✅ Structured exchanges
- ✅ Stress/Consequences system
- ✅ Zone-based movement
- ✅ Concession option
- ✅ All rolls recorded as deltas

### GameMaster Control
- ✅ Compels player aspects
- ✅ Sets opposition difficulties
- ✅ Creates scene aspects
- ✅ Manages pacing via scenes
- ✅ Generates content on demand

### Delta System Benefits
- ✅ Every state change tracked
- ✅ Efficient replay via deltas
- ✅ Snapshots for fast jumps
- ✅ Full game history preserved
- ✅ Debug any game state

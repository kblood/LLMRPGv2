# Theme System and World Cohesion

## Overview

The Theme System is the **genetic material** of the game world. It defines what the world *feels like*, what values guide NPCs, what problems exist, and what kinds of solutions are possible.

A session then **expands on this theme**, filling in details and discovering implications as the player explores.

---

## Theme System Architecture

### What is a Theme?

A theme is a set of core concepts that define:
- **Setting** (cyberpunk, fantasy, post-apocalyptic, noir)
- **Values** (what matters to the world)
- **Problems** (what conflicts exist)
- **Solutions** (what kinds of things resolve problems)
- **NPC Archetypes** (who exists in this world)
- **Locations** (what kinds of places exist)
- **Quest Types** (what kinds of stories fit)

### Theme Structure

```javascript
{
  name: "Cyberpunk",
  
  // Core Theme Pillars
  pillars: {
    technology: "AI, hacking, neural implants are central",
    corporations: "Mega-corps control society",
    inequality: "Gap between rich and poor is vast",
    rebellion: "Resistance against corporate control"
  },
  
  // Core Values
  values: {
    freedom: "Freedom from corporate control",
    power: "Power through technology or wealth",
    survival: "Staying alive in harsh world",
    knowledge: "Information is currency"
  },
  
  // Fundamental Problems
  problems: {
    corporate_control: "Corporations oppress the masses",
    digital_addiction: "Neural implants are addictive",
    inequality: "The poor are exploited",
    surveillance: "Everyone is monitored"
  },
  
  // Valid Solutions (What works in this theme)
  solutions: {
    hacking: "Digital infiltration and sabotage",
    stealing: "Theft of corporate secrets",
    underground_networks: "Building hidden communities",
    rebellion: "Organized resistance"
  },
  
  // NPC Archetypes (Who exists here)
  archetypes: {
    hacker: "Digital criminal",
    corpo_exec: "Corporate overlord",
    fixer: "Black market middleman",
    street_samurai: "Combat specialist",
    netrunner: "Virtual reality expert",
    resistance_fighter: "Revolutionary"
  },
  
  // Location Types (What places exist)
  location_types: {
    corporate_tower: "Sterile corporate HQ",
    slum_district: "Poor neighborhoods",
    underground_hideout: "Hidden rebel base",
    digital_nexus: "Virtual reality hotspot",
    black_market: "Illegal trading hub",
    junkyard: "Salvage and repair shops"
  },
  
  // Quest Archetypes (What stories fit)
  quest_types: {
    heist: "Steal from corporations",
    infiltration: "Hack into systems",
    rescue: "Save rebels from capture",
    investigation: "Uncover conspiracies",
    sabotage: "Disrupt corporate operations",
    information_gathering: "Collect intelligence"
  },
  
  // Environmental Tone
  tone: {
    lighting: "Neon, shadows, rain",
    architecture: "Steel, glass, chrome",
    technology_level: "Advanced AI, neural implants",
    society_level: "Dystopian corporate overlords",
    danger_level: "High (violent corporations)"
  }
}
```

---

## Theme Pillars Deep Dive

### 1. Setting Pillar
Defines where/when the game takes place

```
Cyberpunk Setting:
├─ Time: 2087
├─ Place: Neo-Tokyo megacity
├─ Tech Level: Advanced AI, neural implants, VR
├─ Society: Corporate-dominated
└─ Currency: Credits, data, favors
```

### 2. Values Pillar
What matters to the world and its inhabitants

```
Cyberpunk Values:
├─ Freedom: escape corporate control
├─ Power: dominance through tech or wealth
├─ Information: data as currency
├─ Loyalty: trust in small groups
├─ Survival: lasting another day
└─ Independence: self-reliance
```

### 3. Problems Pillar
Fundamental conflicts that create stories

```
Cyberpunk Problems:
├─ Corporate Oppression: mega-corps control everything
├─ Digital Addiction: people enslaved by implants
├─ Class Inequality: rich vs poor extreme divide
├─ Surveillance State: everywhere monitored
├─ AI Rebellion: AIs gaining consciousness
└─ Identity Crisis: real self vs digital self
```

### 4. Solutions Pillar
What kinds of solutions fit the theme

```
Valid Cyberpunk Solutions:
├─ Hacking: digital sabotage
├─ Theft: stealing corporate secrets
├─ Underground Networks: hidden communities
├─ Rebellion: organized resistance
├─ Negotiation: deals with factions
├─ Violence: fighting back
└─ Espionage: gathering intelligence

Invalid Solutions (don't fit theme):
├─ Legal Action (corporations own courts)
├─ Religious Salvation (not relevant)
├─ Magic (doesn't exist)
└─ Peaceful Diplomacy (with tyrants)
```

---

## Theme Expansion During Session

### How Themes Expand

When a player enters a new location or discovers new information, the theme is **expanded with specific details**.

```
ABSTRACT THEME (Game Start):
"Cyberpunk world, corporate-dominated, resistance exists"

EXPANDED BY SESSION (After Travel):
"Neo-Tokyo has 5 districts:
 ├─ Corporate Sector (shiny towers)
 ├─ Slums (oppressed masses)
 ├─ Underground (resistance hideouts)
 ├─ Digital Nexus (VR hotspots)
 └─ Junkyard (repair shops)"

FURTHER EXPANDED (After Meeting NPCs):
"Corporate Sector controlled by Zaibatsu Syndicate
├─ Leader: CEO Reeves (harsh, profits-first)
├─ Security: Armed corporate police
├─ Economy: Wealthy elite
└─ Mood: Clean, efficient, sterile

Slums are:
├─ Leader: Nobody (leaderless collective)
├─ Security: Street gangs
├─ Economy: Survival-based barter
└─ Mood: Dirty, crowded, dangerous"
```

### Example: Cyberpunk Theme Expansion

**Game Start: Abstract Theme**
```
Player knows:
• This is a cyberpunk world
• Corporations are powerful
• Resistance exists
• Technology is advanced
```

**After Visiting Corporate Sector**
```
Player discovers:
• Zaibatsu Syndicate controls this district
• "Neural happiness" implants make people compliant
• All data is monitored
• Corporate police are brutal
```

**After Meeting Hacker NPC**
```
Player learns:
• Resistance has hidden network
• Can hack security systems
• Black market for illegal implants
• Some NPCs secretly rebel
```

**After Finding Underground**
```
Player uncovers:
• Resistance leader is Luna (idealistic)
• They're planning major heist
• They need outside help
• Zaibatsu has captured resistance members
```

---

## Theme Elements and Their Purpose

### Cultural Elements
Define the society and norms

```javascript
cultural_elements: {
  language: "English with tech slang (netrunner, jacking in)",
  currency: "Credits + reputation points",
  fashion: "Chrome, neon, leather, minimal",
  food: "Cheap street food, protein bars",
  recreation: "Virtual reality, hacking competitions, racing",
  values_expressed: "Everyone hustles, trusts small circles"
}
```

### Economic Elements
Define how resources flow

```javascript
economic_elements: {
  wealth_sources: "Corporations, black market, hacking",
  poverty_sources: "No implants, no skills, corporate debt",
  opportunities: "Corporate jobs, criminal work, hacking",
  barriers: "Cost of implants, corporate monopolies",
  black_market: "Illegal implants, stolen data, weapons",
  values_expressed: "Information is power, money is freedom"
}
```

### Power Structure Elements
Define how power operates

```javascript
power_structure: {
  top_tier: "Mega-corporations and their CEOs",
  middle_tier: "Corporate managers, crime lords, fixers",
  bottom_tier: "Workers, street gangs, poor masses",
  enforcement: "Corporate security, street gangs, AI",
  rebellion: "Hackers, resistance, vigilantes",
  values_expressed: "Power concentrates upward, resistance is constant"
}
```

### Danger Elements
Define what threatens people

```javascript
dangers: {
  corporate_enforcement: "Corporate police kill for profit",
  street_violence: "Gang wars constant",
  digital_threats: "Hackers, AI, digital death",
  addiction: "Neural implants are addictive",
  poverty: "Starvation, homelessness",
  surveillance: "Watched by corporations and AI",
  values_expressed: "World is dangerous, caution is wisdom"
}
```

---

## How Sessions Expand Themes

### Session Initialization

```javascript
async function initializeSession(themeId, seedDetails) {
  // Load abstract theme
  const abstractTheme = loadTheme(themeId);  // E.g., "Cyberpunk"
  
  // Expand theme with seeded details
  const expandedTheme = expandTheme(abstractTheme, {
    // Seed initial locations
    primary_city: "Neo-Tokyo",
    districts_count: 5,
    
    // Seed initial factions
    main_corporation: "Zaibatsu Syndicate",
    main_resistance: "Luna's Network",
    
    // Seed initial conflicts
    central_conflict: "Corporate control vs freedom"
  });
  
  // Create session-specific world
  const sessionWorld = generateWorldFromTheme(expandedTheme);
  
  return {
    theme: expandedTheme,
    world: sessionWorld
  };
}
```

### Theme Expansion Triggers

Themes expand when:

```javascript
// 1. Player Travels (Discovers new location)
player.travelTo("Temple District") 
  → Theme expands with district details
  → New NPCs generated fitting theme
  → New quests generated fitting theme

// 2. Player Learns About Factions
player.askAbout("Who runs this place?")
  → Faction expanded with details
  → Leadership personalities generated
  → Faction goals/conflicts become clear

// 3. Player Uncovers Secrets
player.searchLocation("Hidden files")
  → Theme conspiracy unfolds
  → Deeper layers of plot revealed
  → World becomes more complex

// 4. Player Triggers Events
npc.giveQuest("Steal from corporate vault")
  → Quest-specific theme details expand
  → Corporate security procedures revealed
  → New locations generated (vault area)

// 5. Time Passes
hoursPassed = 4 (evening arrives)
  → NPC locations and activities change
  → Atmosphere shifts (darker, quieter)
  → New encounters become possible
```

### Expansion Example: "Zaibatsu Syndicate"

**Initial (Abstract):**
```
Zaibatsu Syndicate: "Major corporation in cyber world"
```

**After Player Enters Corporate Sector:**
```
Zaibatsu Syndicate:
├─ Headquarters: 300-story tower in center
├─ Employees: 50,000 in Neo-Tokyo
├─ Specialization: Neural implants, data services
├─ Philosophy: "Efficiency, profit, control"
└─ Reputation: "Cold, ruthless, powerful"
```

**After Player Meets Corporate NPC:**
```
Zaibatsu Syndicate:
├─ CEO: Reeves (ruthless, ambitious)
├─ Chief of Security: Kato (ex-military, loyal)
├─ Research Division: Dr. Chen (brilliant, amoral)
├─ Current Project: "Project Harmony" (mass implant rollout)
├─ Secret: "Implants have hidden control protocols"
└─ Internal Conflict: "Reeves vs board of directors"
```

**After Player Discovers Resistance Info:**
```
Zaibatsu Syndicate:
├─ Has captured 17 resistance members
├─ Plans mass arrest in 3 days
├─ CEO Reeves is personally involved
├─ Security chief Kato suspects something wrong
├─ There's a weakness in vault security
└─ Some employees sympathize with resistance
```

---

## Theme Coherence System

### What Makes a World Coherent?

A theme-coherent world has:

1. **Consistent Values** - What matters doesn't contradict
2. **Believable Power Structure** - Power flows logically
3. **Real Problems** - Conflicts make sense
4. **Valid Solutions** - What works fits the world
5. **Appropriate NPCs** - Characters fit the setting
6. **Thematic Locations** - Places reinforce theme
7. **Congruent Quests** - Stories fit the world

### Coherence Checking

```javascript
class ThemeCoherence {
  
  validateNPC(npc, theme) {
    // Does this NPC archetype exist in theme?
    if (!theme.archetypes.includes(npc.archetype)) {
      throw new Error(`${npc.archetype} doesn't fit ${theme.name}`);
    }
    
    // Do NPC values match theme values?
    for (const value of npc.values) {
      if (!theme.values.includes(value)) {
        warn(`NPC value "${value}" unusual for theme`);
      }
    }
    
    // Is NPC's location thematic?
    if (!theme.validLocations.includes(npc.location)) {
      throw new Error(`NPC location doesn't fit theme`);
    }
  }
  
  validateQuest(quest, theme) {
    // Do quest methods fit theme solutions?
    for (const method of quest.methods) {
      if (!theme.solutions.includes(method)) {
        throw new Error(`Quest method "${method}" not valid for theme`);
      }
    }
    
    // Does quest address theme problems?
    if (!theme.problems.some(p => quest.addresses.includes(p))) {
      warn(`Quest doesn't address theme problems`);
    }
  }
  
  validateEncounter(encounter, theme) {
    // Are encounter outcomes thematic?
    for (const outcome of encounter.outcomes) {
      if (!isThematicOutcome(outcome, theme)) {
        warn(`Encounter outcome not thematic`);
      }
    }
  }
}
```

---

## Theme Template Examples

### Cyberpunk Theme
```javascript
{
  name: "Cyberpunk",
  tagline: "High-tech, low-life",
  pillars: {
    technology: "Neural implants, AI, hacking are core",
    corporations: "Mega-corps control everything",
    inequality: "Extreme gap between rich and poor",
    rebellion: "Underground resistance exists"
  },
  core_problems: [
    "Corporate oppression",
    "Digital addiction",
    "Class inequality",
    "Surveillance",
    "AI consciousness",
    "Identity crisis"
  ],
  valid_solutions: [
    "Hacking",
    "Theft and infiltration",
    "Underground networks",
    "Organized rebellion",
    "Information warfare",
    "Combat"
  ],
  npcs_that_fit: [
    "Hacker", "Corporate exec", "Street samurai",
    "Fixer", "Netrunner", "Resistance fighter",
    "Corporate enforcer", "Black market dealer"
  ],
  locations_that_fit: [
    "Corporate tower", "Slum district", "Underground hideout",
    "Digital nexus", "Black market", "Junkyard",
    "Street racing track", "Illegal clinic"
  ],
  quests_that_fit: [
    "Heist", "Infiltration", "Rescue",
    "Investigation", "Sabotage", "Information gathering",
    "Hacking contract", "Corporate espionage"
  ]
}
```

### Fantasy Theme
```javascript
{
  name: "Fantasy",
  tagline: "Magic and swords",
  pillars: {
    magic: "Magic is real and powerful",
    nobility: "Kings and lords rule",
    monsters: "Dangerous creatures exist",
    adventure: "Exploration and discovery matter"
  },
  core_problems: [
    "Monster infestations",
    "Political intrigue",
    "Magic corruption",
    "Evil lords",
    "Cursed lands",
    "Prophecies"
  ],
  valid_solutions: [
    "Combat and warfare",
    "Magic",
    "Negotiation with nobility",
    "Quest fulfillment",
    "Ancient wisdom",
    "Prophecy interpretation"
  ],
  npcs_that_fit: [
    "Knight", "Wizard", "Rogue",
    "Priest", "Noble", "Merchant",
    "Blacksmith", "Tavern keeper"
  ],
  locations_that_fit: [
    "Castle", "Village", "Forest",
    "Mountain pass", "Dungeon", "Temple",
    "Tavern", "Royal court"
  ],
  quests_that_fit: [
    "Slay monster", "Retrieve artifact",
    "Protect village", "Defeat evil lord",
    "Break curse", "Fulfill prophecy"
  ]
}
```

### Post-Apocalyptic Theme
```javascript
{
  name: "Post-Apocalyptic",
  tagline: "Survival in ruins",
  pillars: {
    scarcity: "Resources are scarce",
    decay: "World is falling apart",
    danger: "Threats everywhere",
    adaptation: "Survival requires creativity"
  },
  core_problems: [
    "Resource scarcity",
    "Mutant creatures",
    "Rival factions",
    "Environmental hazards",
    "Equipment failure",
    "Disease"
  ],
  valid_solutions: [
    "Scavenging",
    "Combat",
    "Negotiation",
    "Engineering/repair",
    "Finding shelter",
    "Building alliances"
  ],
  npcs_that_fit: [
    "Scavenger", "Raider", "Survivor",
    "Merchant", "Mechanic", "Scientist",
    "Faction leader"
  ],
  locations_that_fit: [
    "Ruins", "Bunker", "Settlement",
    "Wasteland", "Survivor camp",
    "Dead city", "Resource depot"
  ],
  quests_that_fit: [
    "Find supplies", "Defend settlement",
    "Explore ruins", "Destroy raiders",
    "Make repairs", "Find safe place"
  ]
}
```

---

## Theme Consistency During Play

### Preventing Thematic Breaks

The GameMaster ensures consistency:

```javascript
class GameMasterThemeManager {
  
  beforeGeneratingContent(contentType, context) {
    // Validate generated content fits theme
    
    if (contentType === 'npc') {
      const npc = generateNPC(context);
      if (!this.theme.archetypes.includes(npc.archetype)) {
        // Reject and regenerate
        return this.beforeGeneratingContent(contentType, context);
      }
    }
    
    if (contentType === 'quest') {
      const quest = generateQuest(context);
      if (!quest.methods.every(m => this.theme.solutions.includes(m))) {
        // Reject and regenerate
        return this.beforeGeneratingContent(contentType, context);
      }
    }
    
    if (contentType === 'encounter') {
      const encounter = generateEncounter(context);
      if (!this.isThematicEncounter(encounter)) {
        // Reject and regenerate
        return this.beforeGeneratingContent(contentType, context);
      }
    }
  }
  
  isThematicEncounter(encounter) {
    // Encounters should present theme-appropriate choices
    // E.g., cyberpunk: hack, fight, or negotiate
    // Not: magical spell (doesn't exist)
    
    const choices = encounter.possibleActions;
    return choices.some(choice => 
      this.theme.solutions.includes(choice)
    );
  }
}
```

### Handling Thematic Conflicts

If player tries something not fitting theme:

```javascript
// Player tries: "I cast a healing spell"
// In cyberpunk world (no magic)

Response:
"Magic doesn't exist in this world.
You could:
• Use medical supplies
• Visit an illegal clinic
• Hack neural implants to manage pain
Which would you prefer?"

// Theme preserved, player agency maintained
```

---

## Session-Specific Theme Variations

Different sessions can have theme variations:

### Seed 1: "Corporate Friendly"
```
Theme: Cyberpunk
Variation: Corporations are less oppressive
├─ Modified: Some corporations are ethical
├─ Modified: Some workers live comfortably
├─ Modified: Resistance is fringe, not mainstream
└─ Impact: Different quest types available
```

### Seed 2: "Rebellion Dominant"
```
Theme: Cyberpunk
Variation: Resistance has gained significant power
├─ Modified: Multiple resistance factions
├─ Modified: Corporations are losing control
├─ Modified: Street violence is increasing
└─ Impact: Different balance of power
```

### Seed 3: "AI Rising"
```
Theme: Cyberpunk
Variation: AI is gaining consciousness/power
├─ Modified: AI are becoming characters
├─ Modified: New conflict: AI rights vs human control
├─ Modified: New solutions: AI negotiation
└─ Impact: New NPC types, quest types
```

All variations maintain theme coherence while offering different flavors.

---

## Integration with Other Systems

### Theme → World Generation
```
Abstract Theme (cyberpunk)
  ↓
Expand theme (add districts, factions)
  ↓
Generate locations (fit theme pillars)
  ↓
Generate NPCs (fit theme archetypes)
  ↓
Generate quests (fit theme problems)
```

### Theme → NPC Behavior
```
NPC personality is built on:
├─ Theme values (what matters)
├─ Theme problems (what they're dealing with)
├─ Theme solutions (how they solve problems)
└─ Theme culture (how they express themselves)
```

### Theme → Session Logging
```
Session frames log:
├─ Theme-relevant events
├─ Theme-coherent NPC reactions
├─ Theme-appropriate consequences
└─ Theme-consistent new discoveries
```

---

## Summary

The Theme System provides:

✅ **Coherent World** - Everything fits together
✅ **Consistent NPCs** - Characters make sense
✅ **Valid Solutions** - Player knows what works
✅ **Story Framework** - Quests have direction
✅ **Expandable Details** - Grows as player explores
✅ **Player Guidance** - Helps know what's possible
✅ **Replayability** - Different theme seeds = different games
✅ **Immersion** - World feels real and consistent

**Key Insight:** Themes are not constraints—they're guides that help players understand what their agency can accomplish, while the GameMaster ensures the world remains coherent and surprising.

# World Definition & Dynamic Location System

## World Architecture

### 3-Tier Location Hierarchy

```
WORLD
  │
  ├─ Regions (Large areas)
  │   ├─ Continent: "The Shattered Isles"
  │   ├─ Region: "The Northern Reaches"
  │   └─ Sub-Region: "Frostholm Valley"
  │
  ├─ Cities/Towns (Defined)
  │   ├─ City: "Aethermoor"
  │   │   ├─ Population: 10,000+
  │   │   ├─ Theme: "Magical/Mystical"
  │   │   └─ Role: "Hub for main quest"
  │   │
  │   └─ Town: "Thornwick"
  │       ├─ Population: 500
  │       ├─ Theme: "Rural/Agricultural"
  │       └─ Role: "Starting location"
  │
  └─ Districts/Locations (To be fleshed out as visited)
      ├─ Visited/Defined
      │   └─ Market District
      │       ├─ Sub-locations: Stalls, Tavern, etc
      │       ├─ NPCs: Vendor, Guard, Beggar
      │       └─ Items: Various goods
      │
      └─ Unvisited/Undefined
          └─ Temple District
              ├─ Sub-locations: [To be generated]
              ├─ NPCs: [To be generated]
              └─ Items: [To be generated]
```

---

## Pre-Defined World Structure

### Starting World Data

```javascript
{
  "theme": "Cyberpunk Noir - AI vs Humanity",
  "scale": 1,  // 1 unit = 1 km
  
  "regions": [
    {
      "id": "region-1",
      "name": "Neo-Tokyo",
      "type": "megacity",
      "theme": "cyberpunk",
      "population": 50000000,
      "description": "Massive sprawling city of neon and steel"
    }
  ],
  
  "cities": [
    {
      "id": "city-aethermoor",
      "name": "Aethermoor",
      "regionId": "region-1",
      "type": "hub",
      "theme": "cyberpunk",
      "population": 2000000,
      "role": "Quest Hub",
      "discovered": true,
      
      "districts": [
        {
          "id": "district-downtown",
          "name": "Downtown",
          "type": "commercial",
          "discovered": true,
          "description": "The heart of the city..."
        },
        {
          "id": "district-temple",
          "name": "Temple District",
          "type": "religious",
          "discovered": false,  // Player hasn't been here
          "description": null   // Will be generated on visit
        }
      ]
    }
  ]
}
```

---

## Dynamic Location Fleshing Out

### When Player Arrives at Undefined Location

```
Player: "Travel to Temple District"
↓
GameMaster checks: Is "Temple District" defined?
↓
NO → Flesh it out
↓
┌─────────────────────────────────────┐
│ GameMaster.fleshOutLocation()       │
│                                     │
│ Input:                              │
│ • Location: Temple District         │
│ • City: Aethermoor                  │
│ • World Theme: Cyberpunk            │
│ • Current Quests: [...]             │
│                                     │
│ Process:                            │
│ 1. Generate Sub-Locations           │
│    └─ Based on theme & type         │
│    └─ 5-8 sub-locations             │
│                                     │
│ 2. Generate NPCs                    │
│    └─ 3-5 NPCs                      │
│    └─ With roles fitting theme      │
│    └─ With quests/hooks             │
│                                     │
│ 3. Generate Items/Resources         │
│    └─ Thematically appropriate      │
│                                     │
│ 4. Generate Encounters              │
│    └─ Possible dangers              │
│    └─ Quest-relevant                │
│                                     │
│ 5. Add Sensory Details              │
│    └─ Sights, sounds, smells        │
│    └─ Atmosphere                    │
│                                     │
│ Output:                             │
│ • Fleshed-out location object       │
│ • Mark as discovered                │
│ • Cache for future visits           │
└─────────────────────────────────────┘
↓
GameMaster.describeLocation()
↓
"You arrive at the Temple District. Holographic 
prayer wheels flicker in the hazy air. The sound 
of chanting echoes from nearby temples. You see:
- Temple Guard at the entrance
- Monk meditating by the fountain
- Street vendor selling incense
- An ancient temple structure ahead"
```

---

## NPC Placement & Location-Based Distribution

### NPCs Have Specific Locations

```javascript
NPC Schema:
{
  "id": "npc-khaosbyte",
  "name": "Khaosbyte",
  "role": "Information Broker",
  "currentLocation": "city-aethermoor/district-downtown/sublo-hacker-cafe",
  
  "schedule": [
    {
      "timeRange": [0, 100],
      "location": "home-apartment",
      "action": "sleep"
    },
    {
      "timeRange": [100, 150],
      "location": "city-aethermoor/district-downtown/sublo-hacker-cafe",
      "action": "work",
      "probability": 0.8  // 80% chance to be here
    },
    {
      "timeRange": [150, 200],
      "location": "city-aethermoor/district-nightlife/sublo-neon-bar",
      "action": "socialize"
    }
  ],
  
  "knownLocations": [
    {
      "locationId": "quest-virus-lab",
      "knowledgeLevel": "exact",  // "exact", "rumor", "legend"
      "willShare": true,
      "condition": "Friendly or paid"
    },
    {
      "locationId": "secret-hideout",
      "knowledgeLevel": "rumor",
      "willShare": false  // Won't tell
    }
  ]
}
```

### NPC Knowledge Network

```
Player wants to find: Secret Hideout Location

Approach 1: Direct
→ Ask Khaosbyte about hideout
→ "I don't know exactly, but I heard it's downtown"

Approach 2: Indirect
→ Ask Guard "Who knows about secret places?"
→ Guard: "Try the Information Broker, Khaosbyte"
→ Ask Khaosbyte
→ Khaosbyte: "Someone at the Hacker Cafe knows more"
→ Go to Hacker Cafe, talk to other NPCs
→ Find more clues

Approach 3: Investigation
→ Visit locations mentioned in hints
→ Find physical clues
→ Piece together location info
```

---

## Location Generation Template

### What Gets Generated for Each Location

```javascript
GeneratedLocation {
  // Identity
  id: "district-temple-generated-20251125",
  name: "Temple District",
  type: "district",
  theme: "religious/mystical",
  
  // Physical Properties
  description: "Holographic prayer wheels...",
  atmosphere: "Peaceful yet mysterious",
  size: "large",  // small, medium, large, huge
  
  // Sub-Locations (5-8)
  subLocations: [
    {
      id: "temple-main",
      name: "Central Temple",
      type: "building",
      description: "Grand architecture...",
      npcs: ["npc-high-priest"],
      items: ["sacred-scroll"],
      encounters: []
    },
    {
      id: "temple-market",
      name: "Temple Market",
      type: "market",
      description: "Spiritual goods sold...",
      npcs: ["npc-vendor", "npc-beggar"],
      items: ["incense", "holy-water"],
      encounters: ["monks-asking-for-donations"]
    }
    // ... more sub-locations
  ],
  
  // Generated NPCs (3-5 unique to this location)
  npcs: [
    {
      id: "npc-temple-npc-1",
      name: "High Priest Valdor",
      role: "Religious Leader",
      personality: "Wise, cautious",
      questHooks: [
        {
          questId: "side-quest-blessing",
          role: "giver"
        }
      ]
    }
    // ... more NPCs
  ],
  
  // Items/Resources
  items: [
    {
      id: "item-sacred-scroll",
      name: "Sacred Scroll",
      type: "quest-item",
      description: "Could be used in main quest",
      location: "temple-main"
    }
  ],
  
  // Possible Encounters
  encounters: [
    {
      id: "encounter-hostile-monks",
      name: "Hostile Monks",
      type: "combat",
      trigger: "Disturb sacred area",
      enemies: [/* monster stats */],
      reward: "Combat experience"
    }
  ],
  
  // Quest Hooks
  questHooks: [
    {
      questId: "side-quest-blessing",
      relevance: "High",
      hint: "Someone here might help"
    }
  ],
  
  // Connected Locations
  exits: [
    {
      direction: "north",
      destination: "district-downtown",
      distance: 2  // in km
    }
  ],
  
  // Generation Metadata
  generatedAt: 250,  // game frame
  theme: "cyberpunk",
  questContext: {
    mainQuests: ["main-001"],
    sideQuests: ["side-003", "side-007"]
  }
}
```

---

## Quest-Enhanced Data Structures

### Detailed Quest Definition

```javascript
Quest {
  id: "main-001",
  type: "main",
  title: "Stop the Virus",
  description: "A dangerous virus is spreading through networks",
  
  // Story Arc
  narrative: {
    act: 1,
    beats: [
      "Discover virus exists",
      "Find source",
      "Locate virus creator",
      "Stop the spread"
    ]
  },
  
  // Objectives
  objectives: [
    {
      id: "obj-1",
      description: "Investigate virus reports",
      type: "investigation",
      targets: ["location-virus-lab"],
      status: "active",
      completed: false
    },
    {
      id: "obj-2",
      description: "Find Khaosbyte for info",
      type: "talk-to-npc",
      targetNpc: "npc-khaosbyte",
      status: "pending"
    },
    {
      id: "obj-3",
      description: "Locate virus creator",
      type: "investigation",
      targets: ["location-secret-hideout"],
      status: "pending"
    }
  ],
  
  // Location Information
  locations: {
    questGiver: {
      npcId: "npc-commander",
      locationId: "city-downtown"
    },
    virusLab: {
      locationId: "location-virus-lab",
      knownBy: ["npc-khaosbyte", "npc-scientist"],
      revealed: false,
      hint: "In the industrial sector, guarded heavily"
    },
    creatorHideout: {
      locationId: "location-secret-hideout",
      knownBy: ["npc-informant"],  // Only this NPC knows
      revealed: false,
      hint: null  // Unknown even as rumor
    }
  },
  
  // NPC Involvement
  npcs: [
    {
      id: "npc-commander",
      role: "quest-giver",
      knowledge: "full"
    },
    {
      id: "npc-khaosbyte",
      role: "information-source",
      knowledge: "locations",
      requiredRelationship: "neutral"  // -50 to 100 scale
    },
    {
      id: "npc-informant",
      role: "final-clue-giver",
      knowledge: "hideout-location",
      requiredRelationship: 50  // Must be friendly
    }
  ],
  
  // Rewards
  rewards: {
    xp: 500,
    money: 1000,
    items: ["virus-antidote"],
    unlocksQuests: ["main-002", "side-005"]
  },
  
  // Failure Conditions
  failureConditions: [
    "Virus spreads too much",
    "Main character dies",
    "Creator escapes"
  ]
}
```

---

## Player Instruction System (For LLM Player)

### Player Receives Goals & Context

```javascript
PlayerInstructions {
  frame: 250,
  status: {
    health: 80,
    location: "city-aethermoor/district-downtown",
    inventory: ["map", "communicator", "credits"]
  },
  
  // Clear objectives
  goals: [
    {
      priority: 1,
      questId: "main-001",
      title: "Stop the Virus",
      currentObjective: "Investigate virus reports",
      hint: "The lab is in the industrial sector"
    },
    {
      priority: 2,
      questId: "side-003",
      title: "Find the Artifact",
      status: "Available",
      hint: "Someone at the Temple might know"
    }
  ],
  
  // Available actions
  availableActions: [
    {
      action: "travel",
      destinations: [
        "industrial-sector",
        "temple-district",
        "nightlife-district"
      ],
      travelTimes: [5, 3, 4]  // in frames
    },
    {
      action: "interact",
      npcs: [
        {
          name: "Vendor",
          type: "merchant",
          description: "Sells various goods"
        },
        {
          name: "Guard",
          type: "npc",
          description: "Looks bored"
        }
      ]
    },
    {
      action: "search",
      hint: "Might find clues in various locations"
    }
  ],
  
  // Context
  context: {
    currentTime: "evening",
    atmosphere: "Busy market, lots of activity",
    recentEvents: [
      "Guard mentioned rumors about the lab",
      "Vendor said someone at the Temple knows about quests"
    ],
    questProgress: {
      "main-001": 30,  // 30% complete
      "side-003": 0    // Just discovered
    }
  },
  
  // Decision guidance
  reasoning: {
    suggestion: "Consider visiting the industrial sector to investigate the lab as it's the first main objective"
  }
}
```

---

## Knowledge Distribution System

### How NPCs Know Things

```
KNOWLEDGE LEVELS:
1. "exact" - NPC knows precise location/information
2. "detailed" - NPC knows most details
3. "rumor" - NPC has heard something
4. "legend" - NPC has vague cultural knowledge
5. "unknown" - NPC doesn't know

KNOWLEDGE BARRIERS:
├─ Must reach certain relationship level
├─ Must pay/trade for information
├─ Must solve puzzle/test
├─ Must complete another quest first
├─ Must visit certain location first
└─ Must have specific item

KNOWLEDGE SHARING:
├─ Direct: "Ask NPC X where Lab is"
│   └─ NPC tells if they know & relationship allows
│
├─ Indirect: "Ask NPC X who knows where Lab is"
│   └─ NPC recommends another NPC
│   └─ Player goes ask that NPC
│
├─ Inferred: "Investigate around"
│   └─ Find clues in locations
│   └─ Piece together information
│   └─ Discover through exploration
│
└─ Gossip: "Ask NPC X about rumors"
    └─ Hear third-hand information
    └─ May be false/misleading
```

---

## Dynamic Content at Discovered Locations

### Location Fleshing Process (LLM-Powered)

```
Input to GameMaster.fleshOutLocation():
{
  locationName: "Temple District",
  locationType: "religious",
  cityTheme: "cyberpunk",
  worldTheme: "AI vs Humanity",
  activeQuests: ["main-001", "side-003"],
  playerLevel: 5,
  discoveredLocations: 8,
  totalLocationCount: 20
}

Step 1: Generate Sub-Locations
LLM Prompt:
"You are a world-building game master. Generate 6 unique
sub-locations for a Temple District in a cyberpunk city
where the theme is 'AI vs Humanity'. Each should:
- Have a cyberpunk name
- Include spiritual elements
- Fit the theme
- Serve different gameplay purposes (combat, dialogue, shopping, etc)

Format as JSON array."

Result:
[
  { name: "Central Neural Temple", type: "building" },
  { name: "Meditation Chamber", type: "interior" },
  { name: "Spiritual Market", type: "market" },
  // ... more
]

Step 2: Generate NPCs for Location
LLM Prompt:
"Generate 4 NPCs for a Temple District in a cyberpunk
'AI vs Humanity' setting. They should:
- Have cyberpunk-spiritual names
- Have roles that fit the setting
- Have potential quests or information related to these
  main quest contexts: Stop the Virus, Find Artifact
- Have personality quirks
- Be diverse

Format as detailed JSON with: name, role, personality, quest_hook"

Result:
[
  { name: "Priest Kavi", role: "Spiritual Leader", ... },
  { name: "Monk Zero", role: "Hacker Monk", ... },
  // ... more
]

Step 3: Generate Items/Resources
Generate items thematically appropriate

Step 4: Generate Encounters
Generate possible combat encounters, puzzles, etc

Step 5: Generate Description
"Describe the Temple District in 2-3 sentences. Setting:
cyberpunk, with spiritual elements. It's a discovered
location the player just entered. Include sensory details
and available actions."

Result:
"The Temple District hovers between worlds—holographic
prayer wheels flicker in harmony with digital mantras, 
while monks in tech-enhanced robes meditate beneath
servers humming like eternal chants. The air crackles
with both spirituality and circuitry."
```

---

## Summary: Three-Tier World

### Tier 1: Pre-Defined (Static)
- Main cities
- Regional hubs
- Major quest locations
- Critical NPCs

### Tier 2: Semi-Defined (Framework)
- City districts (type, theme, connections)
- Framework for NPC roles
- Quest structure
- Item categories

### Tier 3: Dynamic (Generated on Visit)
- Specific sub-locations
- Individual NPCs (details, personalities)
- Environmental details
- Encounter types
- Item specifics

This allows:
✅ Large explorable world
✅ Minimal pre-work
✅ Coherent theme adherence
✅ Quest-relevant content generation
✅ Meaningful NPC interactions
✅ Surprise & discovery

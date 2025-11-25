# Session Theme Expansion and Knowledge Discovery

## Overview

When a new session starts, the GameMaster uses the theme to:
1. Create an **initial world** (locations, NPCs, quests)
2. **Control what's possible** (what counts as valid solutions)
3. **Guide content generation** (what NPCs, encounters, and locations make sense)
4. **Maintain coherence** (prevent contradictions)

Then, as the **session progresses**, the theme **expands** with:
- Specific details about locations
- Personality details about NPCs
- Specific quest information
- Emergent plot connections
- Consequences and repercussions

---

## Session Initialization: Theme to World

### Phase 1: Load Abstract Theme

```javascript
async function initializeSession(themeName, seed) {
  // Load abstract theme template
  const abstractTheme = THEME_TEMPLATES[themeName];  // E.g., "cyberpunk"
  
  // Abstract theme contains:
  const theme = {
    name: "Cyberpunk",
    pillars: [
      "technology is central",
      "corporations dominate",
      "inequality is extreme",
      "resistance exists"
    ],
    problems: [
      "corporate oppression",
      "digital addiction",
      "surveillance",
      "inequality"
    ],
    valid_solutions: [
      "hacking",
      "theft",
      "underground networks",
      "rebellion",
      "information warfare"
    ],
    npc_archetypes: [
      "hacker", "corpo_exec", "street_samurai",
      "fixer", "netrunner", "resistance_fighter"
    ],
    location_types: [
      "corporate_tower", "slum_district", "underground",
      "digital_nexus", "black_market", "junkyard"
    ],
    quest_patterns: [
      "heist", "infiltration", "rescue",
      "investigation", "sabotage", "information_gathering"
    ]
  };
  
  return theme;
}
```

### Phase 2: Expand Theme with Seed Parameters

```javascript
async function expandThemeWithSeed(abstractTheme, sessionSeed) {
  const expandedTheme = {
    ...abstractTheme,
    
    // Seeded location names
    primary_city: generateLocationName(abstractTheme, sessionSeed, 1),
    // E.g., "Neo-Tokyo"
    
    // Seeded faction names
    main_corporation: generateFactionName(abstractTheme, sessionSeed, 2),
    // E.g., "Zaibatsu Syndicate"
    
    main_resistance: generateResistanceName(abstractTheme, sessionSeed, 3),
    // E.g., "Luna's Network"
    
    // Seeded main conflict
    central_conflict: generateConflict(abstractTheme, sessionSeed, 4),
    // E.g., "Corporate control vs freedom"
    
    // Seeded initial locations (5 major)
    initial_locations: generateInitialLocations(abstractTheme, sessionSeed, 5),
    // E.g., ["Corporate Sector", "Slums", "Underground", "Digital Nexus", "Junkyard"]
    
    // Seeded initial NPCs (20 critical)
    initial_npcs: generateInitialNPCs(abstractTheme, sessionSeed, 20),
    // E.g., [CEO Reeves, Luna, Khaosbyte, ...]
    
    // Seeded initial main quest
    main_quest: generateMainQuest(abstractTheme, sessionSeed, 100),
    // E.g., "Uncover corporate conspiracy"
    
    // Seeded initial side quests (4 of them)
    side_quests: generateSideQuests(abstractTheme, sessionSeed, 4),
    // E.g., ["Help refugees", "Get hacking tools", "Find lost data", "Survive"]
  };
  
  return expandedTheme;
}
```

### Phase 3: Generate World from Expanded Theme

```javascript
async function generateWorldFromTheme(expandedTheme) {
  const world = {
    // Primary location
    primary_city: {
      name: expandedTheme.primary_city,
      type: "megacity",
      theme: expandedTheme.theme,
      
      // Districts (generated from location_types)
      districts: [
        generateDistrict("Corporate Sector", expandedTheme),
        generateDistrict("Slums", expandedTheme),
        generateDistrict("Underground", expandedTheme),
        generateDistrict("Digital Nexus", expandedTheme),
        generateDistrict("Junkyard", expandedTheme)
      ]
    },
    
    // Main factions
    factions: [
      generateFaction({
        name: expandedTheme.main_corporation,
        type: "corporate",
        theme: expandedTheme,
        leader: expandedTheme.initial_npcs.find(n => n.role === "ceo"),
        goal: "maximize profit and control"
      }),
      generateFaction({
        name: expandedTheme.main_resistance,
        type: "resistance",
        theme: expandedTheme,
        leader: expandedTheme.initial_npcs.find(n => n.role === "resistance_leader"),
        goal: "free people from control"
      })
    ],
    
    // Initial NPCs (20 critical ones)
    npcs: expandedTheme.initial_npcs,
    
    // Main quest
    main_quest: expandedTheme.main_quest,
    
    // Side quests
    side_quests: expandedTheme.side_quests,
    
    // Empty locations (will generate on first visit)
    undiscovered_locations: generateLocationFramework(expandedTheme)
  };
  
  return world;
}
```

---

## Session Progression: Theme Expansion

### Phase 4: Player Explores - Theme Expands

As the player explores, the theme generates details **just in time**:

```javascript
// Player travels to new location
player.travelTo("Temple District");

async function onPlayerTravelTo(location_name) {
  // Does this location exist in our theme?
  if (!world.locations.hasLocation(location_name)) {
    
    // Generate new location fitting the theme
    const new_location = generateLocationFromTheme({
      theme: expandedTheme,
      location_type: inferLocationType(location_name, expandedTheme),
      seed: currentSeed + frame_number,
      constraints: {
        // Must fit theme
        must_have_archetypes: ["appropriate for this location"],
        must_respect_factions: ["existing factions"],
        must_address_problems: ["theme's central problems"]
      }
    });
    
    world.addLocation(new_location);
  }
  
  // Player arrives at location
  const location = world.getLocation(location_name);
  
  // Location now has details:
  {
    name: "Temple District",
    type: "temple_area",
    atmosphere: "spiritual, peaceful, mysterious",
    
    // Fits theme - has spiritual alternatives to corporate control
    thematic_elements: [
      "Old world spirituality",
      "Counter to corporate materialism",
      "Hidden from corporate surveillance"
    ],
    
    // Sub-locations (5-8 generated)
    sub_locations: [
      { name: "Main Temple", purpose: "meditation" },
      { name: "Meditation Hall", purpose: "training" },
      { name: "Hidden Archive", purpose: "knowledge storage" },
      { name: "Resting Quarters", purpose: "lodging" },
      { name: "Training Room", purpose: "martial arts" },
      { name: "Underground Passage", purpose: "escape route" },
      { name: "Secret Library", purpose: "forbidden knowledge" }
    ],
    
    // NPCs (3-5 specific to this location, fitting theme)
    npcs: [
      generateNPC({
        role: "monk_leader",
        theme: expandedTheme,
        location: "Temple District",
        goals: "preserve knowledge", // Fits spiritual theme
        relationship_to_factions: {
          "Zaibatsu": -30,  // Opposes corporations
          "Resistance": +20  // Sympathetic
        }
      }),
      // ... more NPCs
    ],
    
    // Quests available here (fit theme)
    quests: [
      {
        title: "Find Meditation Masters",
        giver: "monk_leader",
        reward: "spiritual_knowledge",
        methods: ["exploration", "conversation", "meditation"],
        fits_theme: true  // All methods are valid in theme
      }
    ],
    
    // Items available (fit theme)
    items: ["meditation_scroll", "spiritual_artifact", "healing_herb"]
  }
}
```

### Phase 5: Player Interacts - Theme Details Emerge

When player talks to NPCs, the theme reveals more:

```javascript
// Player talks to Luna
player.talkTo("luna");

async function onPlayerTalkToNPC(npc_id) {
  const npc = world.getNPC(npc_id);
  
  // NPC's personality expanded (if not yet)
  if (!npc.personality_details) {
    npc.personality_details = generateNPCPersonality({
      theme: expandedTheme,
      archetype: npc.archetype,
      seed: currentSeed + npc.id
    });
    
    // Luna gains specific personality
    // (fitting theme and other NPCs)
    npc.personality = {
      aggression: 0.3,        // Passionate but not violent
      idealism: 0.9,          // Very idealistic
      caution: 0.4,           // Takes risks
      compassion: 0.8,        // Cares about people
      humor: 0.2,             // Serious
      loyalty: 0.95           // Extremely loyal to allies
    };
  }
  
  // NPC's goals expanded (if not yet)
  if (!npc.specific_goals) {
    npc.specific_goals = generateNPCGoals({
      theme: expandedTheme,
      faction: npc.faction,
      seed: currentSeed + npc.id * 2
    });
    
    // Luna's goals
    npc.goals = [
      {
        priority: 1,
        goal: "Overthrow Zaibatsu",
        methods: ["gather intelligence", "recruit allies", "sabotage"],
        fits_theme: true
      },
      {
        priority: 2,
        goal: "Protect resistance members",
        methods: ["planning", "hiding", "rescue operations"],
        fits_theme: true
      },
      {
        priority: 3,
        goal: "Inspire hope",
        methods: ["leadership", "propaganda", "symbolic victories"],
        fits_theme: true
      }
    ];
  }
  
  // NPC's knowledge about world (if not yet)
  if (!npc.world_knowledge) {
    npc.world_knowledge = generateNPCKnowledge({
      theme: expandedTheme,
      faction: npc.faction,
      access_level: npc.access_level,
      seed: currentSeed + npc.id * 3
    });
    
    // Luna knows things consistent with her role
    npc.knowledge = {
      corporate_conspiracy: {
        title: "Zaibatsu has mass mind control",
        accuracy: 0.8,
        learned_from: "investigation",
        will_share_with: ["trusted allies"]
      },
      resistance_plans: {
        title: "We're planning major heist",
        accuracy: 1.0,
        learned_from: "being leader",
        will_share_with: ["new recruits if relationship high"]
      },
      hidden_location: {
        title: "Safe house location",
        accuracy: 1.0,
        learned_from: "founded it",
        will_share_with: ["none until relationship very high"]
      }
    };
  }
  
  // Start dialogue (generated from NPC's details)
  displayDialogue({
    npc: npc.name,
    relationship: player.relationship_with(npc),
    available_knowledge: npc.knowledge,
    available_quests: npc.quests,
    personality: npc.personality
  });
}
```

### Phase 6: Player Discovers Secrets - Theme Deepens

When player finds hidden information:

```javascript
// Player hacks into Zaibatsu server
player.hack("zaibatsu_server");

async function onPlayerHacksIntoSystem(system_id) {
  // What information exists in this system?
  // Determined by theme constraints:
  
  const secrets = generateSecretsForSystem({
    theme: expandedTheme,
    system: system_id,
    security_level: 0.9,  // Very secure
    
    // What would Zaibatsu actually have?
    // - Employee records (mundane)
    // - Financial records (valuable)
    // - Research data (dangerous)
    // - Mind control protocols (secret)
    
    tiers: {
      surface: ["employee list", "financial reports"],
      hidden: ["research projects", "neural mapping"],
      secret: ["mass control program", "leadership conspiracies"]
    },
    
    seed: currentSeed + system_id
  });
  
  // Theme-appropriate secrets
  const discovered_secret = {
    title: "Project Harmony: Mass Neural Control",
    description: "Zaibatsu's plan to implant control code in 80% of population",
    impact: "HIGH",
    fits_theme: true,  // Addresses core theme problem (control)
    
    // This secret changes the world
    consequences: [
      "Makes main quest more urgent",
      "Justifies resistance actions",
      "Explains why some NPCs are afraid",
      "Creates moral weight to player choices"
    ],
    
    // Faction reactions
    faction_reactions: {
      "Zaibatsu": "Will try to kill anyone who knows",
      "Resistance": "Will mobilize to stop it",
      "Temple District": "Will offer sanctuary",
      "Fixer": "Will raise prices for protection"
    }
  };
  
  // Log to session (deterministic replay)
  sessionLogger.logFrame(frame, 'secret_discovered', {
    secret: discovered_secret,
    discovered_by: "hacking",
    discovered_at: current_location
  }, {
    world_state_changed: true,
    urgency_increased: true
  });
  
  // Apply consequences
  applySecretConsequences(discovered_secret);
}
```

---

## Theme-Knowledge Interaction

### How Theme Controls Knowledge Distribution

The theme determines **who knows what**:

```javascript
function determineNPCKnowledge(npc, theme) {
  const knowledge = {};
  
  // Corporate exec would know:
  if (npc.faction === "Zaibatsu") {
    knowledge.corporate_secrets = true;
    knowledge.executive_decisions = true;
    knowledge.financial_reports = true;
    knowledge.employee_surveillance = true;
    knowledge.mind_control_project = true;  // If high enough rank
    
    // But wouldn't know:
    knowledge.resistance_locations = false;
    knowledge.hacker_networks = false;
    knowledge.spiritual_alternatives = false;
  }
  
  // Hacker would know:
  if (npc.archetype === "hacker") {
    knowledge.system_vulnerabilities = true;
    knowledge.data_access_points = true;
    knowledge.black_market_tech = true;
    knowledge.underground_networks = true;
    
    // Might know but is dangerous:
    knowledge.corporate_secrets = false;  // Would need to hack for it
    knowledge.resistance_plans = false;   // Not involved
  }
  
  // Spiritual leader would know:
  if (npc.location === "Temple District") {
    knowledge.spiritual_alternatives = true;
    knowledge.meditation_techniques = true;
    knowledge.hidden_wisdom = true;
    knowledge.escape_from_technology = true;
    
    // Wouldn't know:
    knowledge.technical_details = false;
    knowledge.corporate_structures = false;
    knowledge.hacking_skills = false;
  }
  
  return knowledge;
}
```

### How Knowledge Reveals Theme

As player discovers knowledge, theme becomes clearer:

```
EARLY SESSION (Limited Knowledge):
Player knows:
• There's a corporate city
• There are poor people
• There's some resistance

Theme appears: Generic cyberpunk

MIDWAY (Growing Knowledge):
Player discovers:
• Zaibatsu is specifically oppressive
• Neural implants have control
• Resistance has specific goals
• Temple offers spiritual alternative

Theme clarifies: Corporate control is the specific problem,
                 spiritual resistance is possible

LATE SESSION (Deep Knowledge):
Player discovers:
• Project Harmony is launching soon
• Leadership is divided
• Temple might be infiltrated
• Multiple factions are rising

Theme deepens: The world has layers,
               consequences cascade,
               future is uncertain
```

---

## Session Theme Verification

### Ensuring Coherence

GameMaster verifies session stays coherent with theme:

```javascript
class SessionThemeVerifier {
  
  // After each major event, verify theme consistency
  verifyThemeConsistency(session, currentFrame) {
    const issues = [];
    
    // Verify NPCs fit theme
    for (const npc of world.npcs) {
      if (!this.isNPCThematic(npc, session.theme)) {
        issues.push(`NPC ${npc.name} doesn't fit theme`);
      }
    }
    
    // Verify locations fit theme
    for (const location of world.locations) {
      if (!this.isLocationThematic(location, session.theme)) {
        issues.push(`Location ${location.name} doesn't fit theme`);
      }
    }
    
    // Verify quests fit theme
    for (const quest of world.quests) {
      if (!this.isQuestThematic(quest, session.theme)) {
        issues.push(`Quest ${quest.title} doesn't fit theme`);
      }
    }
    
    // Verify solutions are valid
    const player_solutions_attempted = session.solutions_used;
    for (const solution of player_solutions_attempted) {
      if (!session.theme.valid_solutions.includes(solution)) {
        issues.push(`Solution ${solution} not valid for theme`);
      }
    }
    
    if (issues.length > 0) {
      console.warn("Theme inconsistencies:", issues);
      return false;
    }
    
    return true;
  }
  
  // Check NPC is thematic
  isNPCThematic(npc, theme) {
    return theme.npc_archetypes.includes(npc.archetype);
  }
  
  // Check location is thematic
  isLocationThematic(location, theme) {
    return theme.location_types.includes(location.type);
  }
  
  // Check quest is thematic
  isQuestThematic(quest, theme) {
    // Quest methods should be valid solutions
    return quest.methods.every(m => 
      theme.valid_solutions.includes(m)
    );
  }
}
```

---

## Integration: Theme + Knowledge + Session

### Complete Flow

```
SESSION STARTS
│
├─ 1. Load Theme (abstract)
│  └─ "Cyberpunk: high-tech, low-life"
│
├─ 2. Expand Theme (with seed)
│  └─ "Neo-Tokyo under Zaibatsu control"
│
├─ 3. Generate World (from theme)
│  └─ 5 districts, 20 NPCs, main quest, 4 side quests
│
├─ 4. Start Session
│  └─ Player begins with minimal knowledge
│
├─ 5. Player Explores
│  └─ THEME EXPANDS: New locations generated
│  └─ KNOWLEDGE GROWS: Player learns about areas
│
├─ 6. Player Interacts with NPCs
│  └─ THEME DEEPENS: NPC personalities emerge
│  └─ KNOWLEDGE SPREADS: NPCs share information
│
├─ 7. Player Discovers Secrets
│  └─ THEME REVEALS: Hidden layers exposed
│  └─ KNOWLEDGE ESCALATES: Stakes increase
│
├─ 8. Consequences Unfold
│  └─ THEME DEMONSTRATES: How world reacts
│  └─ KNOWLEDGE VALIDATES: Why things matter
│
└─ 9. Session Ends/Resumes
   └─ Full session logged
   └─ Can replay with same theme/knowledge
   └─ Can jump to any frame
```

### Example: Complete Session Arc

**Frame 0-100: Orientation**
- Player arrives in Neo-Tokyo
- Theme: "cyberpunk megacity"
- Knowledge: Minimal
- Sees: Corporate towers, slums
- Meets: A fixer, a street vendor

**Frame 100-300: Exploration**
- Player visits 3 districts
- Theme expands: "Stark inequality, corporate grip"
- Knowledge: Knows about corporations, poor districts
- Meets: More NPCs, learns about factions
- Learns: Someone called Luna leads resistance

**Frame 300-600: Investigation**
- Player seeks out Luna
- Theme deepens: "Resistance is real and organized"
- Knowledge: Learns about resistance plans
- Meets: Luna and other resistance members
- Gets: First quest (steal data)

**Frame 600-900: Execution**
- Player works on first quest
- Theme demonstrates: "Solutions require cunning"
- Knowledge: Learns security systems, hacking
- Discovers: Why theft is necessary (survival)
- Gets: Second quest chain (gather allies)

**Frame 900-1200: Revelation**
- Player discovers corporate secret
- Theme escalates: "Control is total and systematic"
- Knowledge: Learns about mind control plans
- Impact: Everything is now urgent
- Gets: Main quest (stop Project Harmony)

**Frame 1200+: Consequences**
- Every action now has weight
- Theme: "Choices have lasting impact"
- Knowledge: World is revealed as complex
- NPCs react to player's discoveries
- New quests emerge from consequences

---

## Summary: Session Theme Expansion

✅ **Theme Starts Abstract** - Provides framework
✅ **Session Seeds It** - Creates specific details
✅ **Player Exploration Expands It** - Just-in-time generation
✅ **Interactions Deepen It** - NPCs reveal themselves
✅ **Discoveries Reveal It** - Hidden layers exposed
✅ **Consequences Validate It** - World responds consistently
✅ **Replay Preserves It** - Deterministic, verifiable
✅ **Knowledge Gates Progress** - What you know matters

**Key Insight:** The theme is the DNA of the session. It ensures the world is coherent, the NPCs are consistent, and the player's experiences are meaningful and connected. The session doesn't generate the theme—it expands it, filling in details as needed while maintaining consistency with the core template.

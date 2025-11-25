# NPC and Player Knowledge System

## Overview

The Knowledge System is how information flows through the game world. NPCs know different things, players discover things, and knowledge constrains how quests can be solved.

**Core Principle:** Information is power. Who knows what determines what's possible.

---

## Knowledge System Architecture

### What is Knowledge?

Knowledge is information about:
- **Locations** (Where things are)
- **NPCs** (Who they are, what they do)
- **Quests** (What needs doing, why, how)
- **Factions** (Who's involved, goals, relationships)
- **Secrets** (Hidden information others want)
- **Skills** (How to do things)
- **Items** (Where to find things)
- **Dangers** (What's dangerous, why)

### Knowledge State Machine

```
Knowledge Lifecycle:

Hidden
  ↓ (discovered via exploration, NPC revelation)
Known (by one NPC or player)
  ↓ (spreads via gossip, hints)
Rumored (multiple NPCs know, not confirmed)
  ↓ (confirmed via investigation)
Known Fact (player + multiple NPCs confirm)
  ↓ (becomes common knowledge)
Public Knowledge (everyone knows)
```

---

## NPC Knowledge System

### What Each NPC Knows

Every NPC has a knowledge profile:

```javascript
class NPCKnowledge {
  constructor() {
    this.knowledge = {
      // Locations (with details and confidence)
      locations: {
        "corporate_tower": {
          known: true,
          confidence: "high",
          details: "Zaibatsu headquarters, 47th floor is executive level",
          learned_from: "personal_experience",
          known_since: frame_1500
        },
        "resistance_hideout": {
          known: true,
          confidence: "low",
          details: "Somewhere in the tunnels, maybe?",
          learned_from: "heard_from_luna",
          known_since: frame_3000,
          accurate: false  // Actually it's in sewers
        }
      },
      
      // NPCs (what they know about other NPCs)
      npcs: {
        "luna": {
          name: "Luna",
          known: true,
          is: "resistance_leader",
          personality: "idealistic, reckless",
          goals: "free people from corporate control",
          relationship_with_me: "trusted_ally",
          location: "underground_hideout",
          available: true,
          learned_from: "personal_friendship",
          knows_about_me: true
        },
        "ceo_reeves": {
          name: "Reeves",
          known: true,
          is: "corporate_ceo",
          personality: "ruthless, ambitious",
          goals: "maximize profit and control",
          relationship_with_me: "hostile",
          location: "corporate_tower",
          available: false  // Never talks to street people
          learned_from: "corporate_reports"
        }
      },
      
      // Quests
      quests: {
        "steal_data": {
          title: "Steal Corporate Data",
          known: true,
          giver: "luna",
          target: "data_vault_47",
          reward: "10000_credits",
          difficulty: "high",
          methods: ["hacking", "infiltration", "combat"],
          learned_from: "luna_told_me",
          confidence: "high"
        }
      },
      
      // Skills
      skills: {
        "hacking": {
          known: true,
          how_to: "Use a neural deck to jack into systems",
          difficulty: "requires_training",
          learned_from: "netrunner_taught_me"
        }
      },
      
      // Secrets (Known but not public)
      secrets: {
        "implant_control": {
          title: "Zaibatsu implants have hidden control code",
          known: true,
          giver_knew: "true",
          told_to: ["player", "luna"],
          confidence: "high",
          dangerous: true
        }
      },
      
      // Rumors (Hearsay, not confirmed)
      rumors: {
        "ai_uprising": {
          title: "AI systems are gaining consciousness",
          known: true,
          source: "drunk_hacker_in_bar",
          confidence: "very_low",
          likely_true: false  // Actually quite true
        }
      }
    };
  }
}
```

### Knowledge Discovery: When NPCs Reveal

NPCs reveal knowledge based on:

```javascript
class NPCKnowledgeReveal {
  
  // When would NPC reveal a piece of knowledge?
  shouldRevealKnowledge(npc, knowledgePiece, player) {
    // Relationship matters
    if (npc.relationship(player) < -50) {
      return false;  // Won't help enemy
    }
    
    // Reputation matters
    if (player.reputation < npc.requiredReputation) {
      return false;  // Don't know you well enough
    }
    
    // Payment matters (some sell information)
    if (knowledgePiece.isSensitive && !player.hasOffered_payment) {
      return false;
    }
    
    // Alignment matters
    if (npc.faction != player.faction && npc.is_protective) {
      return false;  // Won't help outsider
    }
    
    // Quest progression matters
    if (!player.hasStartedQuest(knowledgePiece.related_quest)) {
      return false;  // Not relevant to your goals yet
    }
    
    return true;  // Will reveal
  }
  
  // What information does NPC reveal?
  getRevealedKnowledge(npc, player) {
    const revealed = [];
    
    for (const [key, knowledge] of Object.entries(npc.knowledge)) {
      if (this.shouldRevealKnowledge(npc, knowledge, player)) {
        
        // Some knowledge is accurate, some is rumor/wrong
        if (knowledge.accuracy < 0.5) {
          // Give corrupted version
          revealed.push(this.corruptKnowledge(knowledge));
        } else {
          // Give accurate version
          revealed.push(knowledge);
        }
      }
    }
    
    return revealed;
  }
  
  corruptKnowledge(knowledge) {
    // Wrong location, outdated info, misremembered
    const corrupted = { ...knowledge };
    corrupted.accuracy = 0.3;
    corrupted.details = this.garbleDetails(corrupted.details);
    return corrupted;
  }
}
```

### Knowledge Networks: Who Tells Whom

```
NPC Knowledge Network:

Luna (Resistance Leader)
├─ Knows: Full scope of corporate conspiracy
├─ Tells: Fellow resistance members
├─ Hides: From corporate informants
└─ Trusts: Long-term allies only

Khaosbyte (Hacker Fixer)
├─ Knows: Technical secrets, security systems
├─ Tells: Clients (who can pay)
├─ Hides: From corporate security
└─ Trusts: Everyone, but for a price

Guard01 (Corporate Security)
├─ Knows: Building layout, security protocols
├─ Tells: Other guards, supervisor
├─ Hides: From resistance
└─ Trusts: Corporate chain of command

Street Vendor (Merchant)
├─ Knows: What people buy, local gossip
├─ Tells: Other merchants, friends
├─ Hides: From authorities
└─ Trusts: Other merchants

Information Flows:
Luna → Resistance members → Sympathizers → ???
Khaosbyte ← Clients (diverse) → Khaosbyte
Guard → Corporate hierarchy → Guard
Vendor → Community → Vendor
```

### Knowledge Update: Learning from Events

When something happens in the world, NPCs who witnessed or hear about it update their knowledge:

```javascript
class NPCKnowledgeUpdate {
  
  onEventHappens(event) {
    // Event: "Player infiltrated corporate tower"
    
    // 1. NPCs who witnessed it learn directly
    for (const npc of event.witnesses) {
      npc.addKnowledge({
        title: "Player infiltrated corporate tower",
        source: "witnessed",
        confidence: "very_high",
        details: event.specifics
      });
    }
    
    // 2. NPCs who might hear about it learn via rumors
    for (const npc of event.likely_hearers) {
      // 50% chance they hear, with some details wrong
      if (Math.random() < 0.5) {
        npc.addKnowledge({
          title: "Someone infiltrated corporate tower",
          source: "heard_from_other",
          confidence: "medium",
          details: this.garbleEventDetails(event),
          accurate: false
        });
      }
    }
    
    // 3. NPCs in factions learn via faction communication
    for (const faction of event.relevant_factions) {
      for (const npc of faction.members) {
        npc.addKnowledge({
          title: event.title,
          source: "faction_briefing",
          confidence: "high",
          details: event.official_faction_report
        });
      }
    }
  }
  
  // NPC learns about event (second or third hand)
  onGossipAboutEvent(event, npc_spreading, npc_receiving) {
    // Each step of gossip adds inaccuracy
    const transmissions = event.gossip_chain_length;
    const accuracy_loss = transmissions * 0.15;
    
    npc_receiving.addKnowledge({
      title: event.title,
      source: "gossip_from_" + npc_spreading.name,
      confidence: "medium",
      details: this.garbleDetails(event.details, accuracy_loss),
      accurate: false
    });
  }
}
```

---

## Player Knowledge System

### What Players Know

The player (or player character if LLM-controlled) has their own knowledge:

```javascript
class PlayerKnowledge {
  constructor() {
    this.knowledge = {
      // Discovered Locations
      discoveredLocations: {
        "starter_area": {
          name: "Starter Area",
          discovered: true,
          discovered_at_frame: 0,
          visited_count: 1,
          sub_locations: ["market", "inn", "guard_post"],
          npcs_here: ["guard01", "merchant_khan"],
          items_available: ["basic_sword", "healing_potion"],
          dangers: []
        }
      },
      
      // Discovered NPCs
      discoveredNPCs: {
        "luna": {
          name: "Luna",
          met: true,
          met_at_frame: 1200,
          met_at_location: "underground_hideout",
          personality_learned: "idealistic, passionate",
          goals_learned: "free people from oppression",
          relationship: 45,  // -100 to +100
          quests_offered: ["steal_data", "rescue_members"],
          knowledge_shared: [
            "corporate_conspiracy",
            "resistance_plans",
            "secret_location"
          ],
          trust_level: "medium"
        }
      },
      
      // Discovered Quests
      discoveredQuests: {
        "steal_data": {
          title: "Steal Corporate Data",
          discoveredAt: 1200,
          discoveredFrom: "luna",
          description: "Break into corporate vault and steal encrypted data",
          reward: 10000,
          status: "accepted",
          progress: 0.4,
          methods_available: ["hacking", "infiltration", "disguise"],
          attempted_methods: ["hacking"],
          hints_received: 2
        }
      },
      
      // Discovered Secrets
      discoveredSecrets: {
        "implant_control": {
          title: "Implants have control code",
          discovered_at_frame: 2500,
          discovered_from: "luna",
          known_by_npcs: ["luna", "khaosbyte"],
          uses: ["blackmail", "sabotage", "protection"],
          impact: "high"
        }
      },
      
      // Rumors (Unconfirmed)
      rumors: {
        "hidden_ai": {
          title: "Hidden AI governs the city",
          heard_at_frame: 1800,
          source: "drunken_hacker",
          confirmation_level: 0.2,  // 20% likely true
          heard_from_multiple: false
        }
      },
      
      // Skills Learned
      skillsLearned: {
        "hacking": {
          learned: true,
          learned_at_frame: 1500,
          learned_from: "khaosbyte",
          proficiency: 0.5,  // 50% skilled
          uses: ["open_locks", "access_data", "disable_security"]
        }
      }
    };
  }
  
  // Player discovers new knowledge
  discoverKnowledge(knowledge_id, source) {
    const knowledge = this.knowledge[knowledge_id];
    knowledge.discovered = true;
    knowledge.discovered_at_frame = currentFrame;
    knowledge.discovered_from = source;
    
    // Log to session
    sessionLogger.logFrame(currentFrame, 'knowledge_discovered', {
      knowledge_id: knowledge_id,
      source: source
    }, {
      player_knowledge_expanded: true
    });
  }
}
```

### Knowledge Visibility in UI

The player sees knowledge in multiple ways:

```javascript
// 1. Character Panels (who they've met)
Character Panel: Luna
├─ Name: Luna
├─ Title: Resistance Leader
├─ Relationship: +45 (Friendly)
├─ Location: Underground Hideout
├─ Quests Available: [steal_data, rescue_members]
└─ Last Seen: 2 hours ago (game time)

// 2. Location Map (where they've been)
Map Discovery: 
├─ [X] Starter Area - fully explored
├─ [X] Market District - partially explored
├─ [ ] Corporate Tower - discovered, not visited
├─ [ ] Underground - rumored, not found
└─ [ ] Mountains - completely unknown

// 3. Quest Log (what they know)
Active Quest: Steal Corporate Data
├─ Giver: Luna
├─ Objective: "Break into vault, get encrypted data"
├─ Location: Corporate Tower, 47th Floor
├─ Methods Available: Hacking, Infiltration, Disguise
├─ Progress: 40% (Initial scouting done)
├─ Hints Received: 2
│   ├─ "There's a guard at entrance"
│   └─ "Vents can bypass first security"
└─ Time Limit: None (estimated 8 hours game time)

// 4. Notes (what they've learned)
Player Notes:
├─ KNOWN: CEO Reeves runs Zaibatsu
├─ KNOWN: Zaibatsu implants have hidden control code
├─ RUMOR: AI might be conscious
├─ RUMOR: Secret underground city exists
├─ SKILL LEARNED: Hacking (50% proficient)
└─ RELATIONSHIP: Luna +45, Khaosbyte +20, Reeves -80
```

---

## Knowledge Constraints and Quest Discovery

### How Knowledge Gates Quests

**Quest:** "Steal Corporate Data"

**Discovery Path 1: Direct Ask**
```
Player: "Do you have any work for me?"
Luna: "I might, if you're trustworthy..."
  └─ Relationship needed: +30
  └─ If met: "I need someone to steal data from corporate vault"
  └─ Quest discovered: YES

Player: "How do I get into the vault?"
Luna: "I don't know, you'll have to figure it out"
  └─ Knowledge provided: Location only
  └─ Requires: Hacking skill to solve
```

**Discovery Path 2: Referral Chain**
```
Player: "Who has technical expertise?"
Guard01: "You should talk to Khaosbyte, the fixer"
  └─ Knowledge: Who knows about what

Player: Talk to Khaosbyte
Khaosbyte: "Why do you ask? There's a hacker friend of mine..."
  └─ Knowledge: Who else knows

Player: Talk to hacker
Hacker: "Oh! Luna's been looking for someone..."
  └─ Knowledge: Connects player to quest giver

Result: Quest discovered through chain of referrals
```

**Discovery Path 3: Exploration**
```
Player: Travel to Underground
  └─ New location generates
  └─ Luna is there (20% chance)

Player: Notices base of operations
  └─ Deduction: Luna is leader
  └─ Explores base

Player: Finds quest log/notes
  └─ Reads: "Need to steal corporate data"
  └─ Quest discovered: YES (by discovery)

Luna: "How did you find this?!"
  └─ Relationship change: -10 (invasion of privacy)
```

**Discovery Path 4: Overheard**
```
Tavern: Khaosbyte and Luna talking quietly
  └─ Player can eavesdrop (Stealth check)
  └─ Hears: "I need someone reliable to break in"

Player: Approaches table
Khaosbyte: "Interesting, you want to help?"
  └─ Quest given through indirect route
  └─ Relationship with Luna: Unknown (-5 for eavesdropping)
```

### Knowledge Barriers

Some knowledge requires:

**Relationship Barrier**
```
Knowledge: "Zaibatsu has secret lab"
Required Relationship: +60 with Luna
Below +60: Luna won't tell you
Result: Quest can't progress without relationship building
```

**Payment Barrier**
```
Knowledge: "Security override codes"
Seller: Khaosbyte (Fixer)
Required Payment: 5000 credits
Can't Afford: Quest requires finding money first
Result: Quest has prerequisite quest
```

**Exploration Barrier**
```
Knowledge: "Hidden entrance to base"
Found By: Exploring location thoroughly
Required Skill: Search (80% difficulty)
Below Skill: Entrance remains hidden
Result: Some players might never find this path
```

**Quest Progress Barrier**
```
Knowledge: "How to use the stolen data"
Unlocked By: Completing "Steal Corporate Data" quest
Before Quest: Information not available
Result: Knowledge gates progression naturally
```

**Faction Barrier**
```
Knowledge: "Zaibatsu security patterns"
Available To: Corporate employees only
For Others: Requires infiltration or insider
Result: Faction membership controls information
```

---

## Knowledge Spread and Gossip

### Gossip Network

Information spreads through NPCs:

```javascript
class GossipNetwork {
  
  // NPC learns from another NPC
  spreadGossip(knowledge_id, from_npc, to_npc) {
    // Does to_npc have access to from_npc?
    if (!this.canTalk(from_npc, to_npc)) {
      return false;  // No contact
    }
    
    // Would from_npc tell to_npc?
    if (!from_npc.wouldShareWith(to_npc, knowledge_id)) {
      return false;  // Keeps secret
    }
    
    // How accurate is the gossip?
    const accuracy_degradation = 0.15;  // Loses 15% per transmission
    const to_npc_knowledge = {
      ...from_npc.knowledge[knowledge_id],
      source: "heard_from_" + from_npc.name,
      accuracy: from_npc.knowledge[knowledge_id].accuracy - accuracy_degradation
    };
    
    // Add to to_npc's knowledge
    to_npc.addKnowledge(to_npc_knowledge);
    
    // Log the gossip spread
    sessionLogger.logEvent('gossip_spread', {
      knowledge: knowledge_id,
      from: from_npc.name,
      to: to_npc.name,
      accuracy_now: to_npc_knowledge.accuracy
    });
    
    return true;
  }
  
  // Periodic gossip spread
  updateGossipNetwork(deltaTime) {
    // Every few game hours, NPCs talk
    if (this.time_since_last_gossip > 120_minutes) {
      
      // For each NPC pair that can talk
      for (const npc1 of this.npcs) {
        for (const npc2 of this.npcs) {
          if (npc1 === npc2) continue;
          if (!this.canTalk(npc1, npc2)) continue;
          
          // Chance of each knowledge being shared
          for (const [id, knowledge] of Object.entries(npc1.knowledge)) {
            if (Math.random() < 0.05) {  // 5% chance per knowledge
              this.spreadGossip(id, npc1, npc2);
            }
          }
        }
      }
      
      this.time_since_last_gossip = 0;
    }
  }
  
  // What does an NPC NOT tell others?
  keepSecret(npc, knowledge_id) {
    // Secrets that could endanger them or allies
    if (knowledge_id.isDangerous && npc.has_dependents) {
      return true;  // Won't risk their family
    }
    
    // Secrets that could hurt their faction
    if (knowledge_id.hurts_faction) {
      return true;  // Won't betray faction
    }
    
    // Valuable secrets they want to keep
    if (knowledge_id.is_valuable && this.canSellIt(npc)) {
      return true;  // Will sell, not give away
    }
    
    return false;  // Will share
  }
}
```

### Player Gossip Spreading

When player tells someone something:

```javascript
// Player: "Luna told me Zaibatsu has mind control"
// Told to: Khaosbyte

// Khaosbyte now knows:
"Player knows about mind control"
"Player is working with Luna"
"Luna is revealing secrets"

// Khaosbyte might:
1. Tell other resistance members (if sympathetic)
2. Tell Zaibatsu (if corporate spy)
3. Keep it secret (if neutral)

// Consequences:
- If shared with resistance: Luna learns player is trustworthy
- If shared with Zaibatsu: They know player is threat
- If kept secret: No change
```

---

## Knowledge Decay and Updates

### Outdated Knowledge

Knowledge can become stale:

```javascript
class KnowledgeDecay {
  
  // Is knowledge still accurate?
  isKnowledgeStale(knowledge) {
    const age = currentFrame - knowledge.learned_at_frame;
    
    // Different knowledge types decay at different rates
    switch (knowledge.type) {
      case 'npc_location':
        // NPC locations decay fast (they move around)
        return age > 100_frames;  // ~8 hours
      
      case 'security_code':
        // Security codes decay medium
        return age > 500_frames;  // ~40 hours
      
      case 'building_layout':
        // Building layouts decay slow (stable)
        return age > 2000_frames;  // ~4 days
      
      case 'rumor':
        // Rumors stay until disproven
        return knowledge.confidence < 0.2 && age > 1000_frames;
      
      default:
        return false;
    }
  }
  
  // NPC behavior changed, updates knowledge
  onNPCBehaviorChange(npc) {
    // All knowledge about this NPC becomes stale
    for (const observer of this.all_npcs) {
      if (observer.knowledge[npc.id]) {
        observer.knowledge[npc.id].stale = true;
      }
    }
  }
  
  // Location changed, updates knowledge
  onLocationChange(location) {
    // All knowledge about this location becomes stale
    for (const npc of this.all_npcs) {
      for (const knowledge of npc.knowledge.values()) {
        if (knowledge.location === location.id) {
          knowledge.stale = true;
        }
      }
    }
  }
}
```

### Knowledge Refresh

How NPCs update their knowledge:

```javascript
// NPC visits location and updates knowledge
onNPCVisitLocation(npc, location) {
  // Update location details
  npc.knowledge.locations[location.id] = {
    ...npc.knowledge.locations[location.id],
    last_visited: currentFrame,
    current_state: location.current_state,
    npcs_present: location.npcs_present,
    stale: false
  };
}

// NPC talks to another NPC and learns current info
onNPCTalkToNPC(npc1, npc2) {
  // npc1 learns npc2's current knowledge
  for (const [id, knowledge] of Object.entries(npc2.knowledge)) {
    if (knowledge.stale) {
      // npc2 also has outdated info, so nothing changes
      continue;
    }
    
    npc1.updateKnowledge(id, knowledge);
  }
}
```

---

## Integration with Sessions

### Knowledge Persists Across Frames

```javascript
// Frame 100: Player discovers location
sessionLogger.logFrame(100, 'location_discovered', {
  location: 'temple_district',
  discovered_from: 'npc_guidance'
}, {
  player_knowledge_updated: true
});

// Frame 200: Player visits again
// Player still remembers temple district
// Session can jump to frame 200 with player knowledge intact
```

### Knowledge Verification

When replaying, knowledge must be consistent:

```javascript
class KnowledgeVerification {
  
  // Verify knowledge is consistent after replay
  verifyKnowledgeConsistency(session, target_frame) {
    // Replay all frames up to target
    const player_knowledge = {};
    const npc_knowledge = {};
    
    for (let frame = 0; frame <= target_frame; frame++) {
      const event = session.frames[frame];
      
      if (event.type === 'knowledge_discovered') {
        player_knowledge[event.data.id] = true;
      }
      
      if (event.type === 'gossip_spread') {
        npc_knowledge[event.data.npc] = npc_knowledge[event.data.npc] || {};
        npc_knowledge[event.data.npc][event.data.knowledge] = true;
      }
    }
    
    // Verify we get same knowledge state as stored
    if (!this.knowledgeMatchesFrame(player_knowledge, session.knowledgeAt(target_frame))) {
      console.error("Knowledge inconsistency detected!");
      return false;
    }
    
    return true;
  }
}
```

---

## Knowledge and Difficulty

### Knowledge Affects Difficulty

```
Scenario: "Break into Corporate Tower"

HIGH KNOWLEDGE:
├─ Know location of vault
├─ Know security guard names
├─ Know override codes
├─ Know guard shift times
└─ Difficulty: EASY (just execute plan)

MEDIUM KNOWLEDGE:
├─ Know location of tower
├─ Know vault is high up
├─ Have general layout
└─ Difficulty: MEDIUM (improvise, deal with unknown)

LOW KNOWLEDGE:
├─ Know tower exists
├─ Know vault is inside somewhere
├─ Don't know layout or security
└─ Difficulty: HARD (extensive exploration needed)

NO KNOWLEDGE:
├─ Don't know tower's location
├─ Don't know how to find it
├─ Don't know what to expect
└─ Difficulty: VERY HARD (must discover everything)
```

### Knowledge Shortcuts

Knowledge can enable special actions:

```javascript
// Without knowledge:
"I search the corridor for hidden doors"
→ Search check (maybe find nothing)

// With knowledge "hidden door behind painting":
"I pull the painting aside"
→ Hidden door revealed (guaranteed)

// Without knowledge:
"I try to hack the security system"
→ Hacking check (difficult)

// With knowledge "security override codes: 7734":
"I enter code 7734"
→ System unlocked (automatic success)
```

---

## Summary: Knowledge System Benefits

✅ **Quest Discovery** - Multiple paths to same goal
✅ **Difficulty Scaling** - More knowledge = easier quest
✅ **Player Agency** - Can bypass challenges with right knowledge
✅ **NPC Consistency** - NPCs remember and share information
✅ **World Cohesion** - Information spreads realistically
✅ **Replayability** - Different knowledge = different paths
✅ **Emergent Gameplay** - Unexpected knowledge chains
✅ **Immersion** - World feels alive with information flow

**Core Insight:** Knowledge is the currency of the world. Players who gather more knowledge have more options. NPCs who know more are more valuable to talk to. The game naturally incentivizes exploration, conversation, and investigation.

# Fate Mechanics Reference

## Quick Reference for LLMRPGv2

This document provides a concise reference for the Fate Core mechanics we use. For full rules, see [fate-srd.com](https://fate-srd.com/).

---

## The Ladder

All difficulties, skills, and results use this scale:

| Value | Name | Description |
|-------|------|-------------|
| +8 | Legendary | Mythical achievement |
| +7 | Epic | Once in a lifetime |
| +6 | Fantastic | World-class |
| +5 | Superb | Best in the region |
| +4 | Great | Professional expert |
| +3 | Good | Trained professional |
| +2 | Fair | Competent |
| +1 | Average | Basic training |
| +0 | Mediocre | No real skill |
| -1 | Poor | Actively bad |
| -2 | Terrible | Catastrophically bad |

---

## Dice Rolling

### Fudge Dice (4dF)

Roll four dice, each showing: **+**, **blank**, or **-**

- **+** = +1
- **blank** = 0
- **-** = -1

**Total range**: -4 to +4

**Distribution** (centered on 0):
```
-4: 1.23%   ████
-3: 4.94%   ████████
-2: 12.35%  ████████████████
-1: 19.75%  ██████████████████████████
 0: 23.46%  ██████████████████████████████
+1: 19.75%  ██████████████████████████
+2: 12.35%  ████████████████
+3: 4.94%   ████████
+4: 1.23%   ████
```

### Resolution Formula

```
Result = Dice Roll + Skill Rating
Shifts = Result - Opposition

Shifts ≥ 0: Success (more shifts = better)
Shifts < 0: Failure
Shifts = 0: Tie (success with minor cost)
```

### Digital Implementation

```javascript
function rollFudgeDice(seed) {
  const rng = new SeededRandom(seed);
  const dice = [];
  let total = 0;
  
  for (let i = 0; i < 4; i++) {
    const die = Math.floor(rng.next() * 3) - 1; // -1, 0, or +1
    dice.push(die);
    total += die;
  }
  
  return { dice, total, seed };
}

function resolveAction(skill, difficulty, seed) {
  const roll = rollFudgeDice(seed);
  const result = roll.total + skill;
  const shifts = result - difficulty;
  
  return {
    roll,
    skill,
    result,
    difficulty,
    shifts,
    outcome: shifts >= 3 ? "success_with_style" :
             shifts >= 0 ? "success" :
             "failure"
  };
}
```

---

## The Four Actions

### 1. Overcome (O)

**Use when**: Getting past an obstacle, challenge, or barrier

**Outcomes**:
- **Fail**: Don't achieve goal, or achieve at serious cost
- **Tie**: Achieve goal at minor cost
- **Success**: Achieve goal
- **Success with Style (3+ shifts)**: Achieve goal + free boost

**Examples**:
- Pick a lock
- Hack a terminal
- Climb a wall
- Convince a guard
- Notice something hidden

### 2. Create Advantage (C)

**Use when**: Setting up a beneficial situation

**Outcomes**:
- **Fail**: Don't create aspect, or create one the enemy can use
- **Tie**: Get a boost (temporary aspect, one free invoke)
- **Success**: Create aspect with one free invoke
- **Success with Style**: Create aspect with two free invokes

**Examples**:
- Take cover ("Behind Heavy Crates")
- Study enemy ("Weak Left Flank")
- Spread rumors ("Public Opinion Turning")
- Set up ambush ("Perfect Vantage Point")

### 3. Attack (A)

**Use when**: Trying to harm someone in a conflict

**Outcomes**:
- **Fail**: No damage dealt
- **Tie**: No damage, but may get boost
- **Success**: Deal shifts as stress (after armor)
- **Success with Style**: Deal shifts as stress + option to reduce by 1 for a boost

**Examples**:
- Sword strike
- Gunshot
- Harsh words (mental attack)
- Corporate sabotage

### 4. Defend (D)

**Use when**: Preventing attack or advantage against you

**Outcomes**:
- **Fail**: Opponent succeeds
- **Tie**: Opponent's success reduced
- **Success**: Block the action
- **Success with Style**: Block + gain a boost

**Note**: Defend is reactive—you roll in response to attack/create advantage

---

## Aspects

### What Is an Aspect?

A short phrase describing something significant that can be used for bonuses or complications.

**Types**:
- **Character Aspects**: Define who you are
- **Situation Aspects**: Describe the scene/environment
- **Consequences**: Negative aspects from taking harm
- **Boosts**: Temporary, one-use aspects

### Invoking Aspects

**Cost**: 1 Fate Point (or free invoke)

**Benefits** (choose one):
- +2 to your roll
- Reroll all dice
- +2 to difficulty of opponent's roll
- Enable action that wouldn't otherwise be possible

**Requirements**:
- Aspect must be relevant
- Must explain how it helps

**Example**:
```
Player has aspect "Former Corporate Security"
Trying to sneak into corporate building

"I know their patrol patterns from my old job"
Invoke → +2 to Stealth roll
```

### Compelling Aspects

**Who does it**: GM (or player can self-compel)

**What happens**: Aspect causes complication or temptation

**Result**: Player gets 1 Fate Point if they accept

**Example**:
```
Player has aspect "Owes Luna a Big Favor"

GM: "Luna contacts you mid-mission. She needs you NOW."
Player accepts → Gets 1 Fate Point, must deal with Luna
Player refuses → Pays 1 Fate Point to ignore
```

---

## Stress and Consequences

### Stress Tracks

```
Physical: [ ] [ ] [ ]     ← Usually 2-4 boxes based on Physique
Mental:   [ ] [ ] [ ]     ← Usually 2-4 boxes based on Will
```

**Stress clears at end of scene**

### Taking Hits

When you take stress:
1. Calculate shifts dealt (attack result - defense result)
2. Mark that many stress boxes OR take a consequence

**Stress Boxes**: Each box absorbs hits equal to its number
- Box 1 absorbs 1 shift
- Box 2 absorbs 2 shifts
- etc.

**You can combine**: Box + Consequence = total absorption

### Consequences

| Severity | Shifts Absorbed | Recovery Time |
|----------|-----------------|---------------|
| Mild | 2 | One scene |
| Moderate | 4 | One session |
| Severe | 6 | Major milestone |

**Consequences are aspects**: Enemies can invoke them against you!

**Example**:
```
Take 4 shifts of physical stress
Options:
- Mark [ ] [ ] [X] [X] (boxes 3 and 4... but only have 3 boxes!)
- Mark [ ] [X] [ ] and take Mild consequence "Bruised Ribs"
- Take Moderate consequence "Dislocated Shoulder"
```

### Taken Out

When you can't absorb all shifts (no boxes left, consequences full):

**You are Taken Out** - opponent decides your fate

**Alternative**: **Concede** before being taken out
- You get to narrate your exit
- Opponent gets their goal (mostly)
- You get 1 Fate Point + 1 per consequence taken this conflict

---

## Conflicts

### Structure

```
1. Set the Scene
   └─ Establish zones, aspects, who's there

2. Determine Turn Order
   └─ Usually Notice or some relevant skill

3. Rounds
   └─ Each participant gets one turn
   └─ On your turn: One action + free movement
   └─ Round ends when everyone has gone

4. Resolution
   └─ Conflict ends when:
      - One side taken out/concedes
      - Goals achieved
      - Fictional circumstance changes
```

### Zones

Zones are abstract areas of the scene:

```
┌──────────────┬──────────────┬──────────────┐
│   Rooftop    │   Alley      │   Street     │
│              │              │              │
│  "High       │  "Narrow     │  "Crowded"   │
│   Ground"    │   Passage"   │              │
└──────────────┴──────────────┴──────────────┘
```

**Movement**:
- Move 1 zone = free
- Move 2+ zones = action (Overcome if opposed)
- Aspects on zones can affect movement/actions

---

## Skills

### Standard Skill List (Customize for Setting)

**Physical**:
- Athletics (dodge, run, jump)
- Fight (melee combat)
- Physique (strength, endurance)
- Shoot (ranged combat)
- Stealth (hide, sneak)

**Social**:
- Contacts (know people)
- Deceive (lie, disguise)
- Empathy (read people)
- Provoke (intimidate, anger)
- Rapport (charm, befriend)

**Mental**:
- Investigate (examine, deduce)
- Lore (knowledge)
- Notice (perceive, spot)
- Will (mental fortitude)

**Other**:
- Crafts (build, repair)
- Drive (vehicles)
- Resources (wealth)
- Burglary (locks, security)

### Skill Pyramid

Characters have skills in a pyramid shape:
```
        +4: [ One skill at peak ]
        +3: [ Two skills ]
        +2: [ Three skills ]
        +1: [ Four skills ]
```

All other skills are +0 (Mediocre)

---

## Fate Points

### Starting Refresh

Characters start each session with **Refresh** Fate Points (usually 3)

### Earning Fate Points

- Accept a compel on your aspect
- Have an aspect compelled against you
- Concede a conflict

### Spending Fate Points

- Invoke an aspect (+2 or reroll)
- Power a stunt (some require FP)
- Declare a story detail (with GM approval)

---

## Stunts

Stunts let you break the rules in specific ways.

**Templates**:

1. **Skill Bonus**: +2 to [skill] when [narrow circumstance]
   - "Ghost in the System: +2 to Hack when avoiding detection"

2. **Rule Substitution**: Use [skill A] instead of [skill B] when [circumstance]
   - "Face in the Crowd: Use Stealth instead of Deceive to blend in socially"

3. **Once Per Session**: Once per session, [significant effect]
   - "Lucky Break: Once per session, arrive just in time to help an ally"

**Cost**: Each stunt reduces Refresh by 1 (minimum Refresh of 1)

---

## Milestones

### Minor Milestone (Every Session)
- Switch two skills of adjacent ranks
- Change a stunt
- Rename an aspect (not High Concept or Trouble)

### Significant Milestone (End of Scenario)
- All minor milestone options
- +1 skill point (within pyramid)
- New stunt (reduce Refresh)
- Clear moderate consequence

### Major Milestone (End of Arc)
- All significant milestone options
- +1 Refresh
- Rename High Concept
- Clear severe consequence

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────┐
│ ROLL: 4dF + Skill vs Difficulty/Opposition            │
│ SHIFTS: Result - Opposition (0+ = success)            │
├────────────────────────────────────────────────────────┤
│ FOUR ACTIONS:                                          │
│   O - Overcome    → Get past obstacle                 │
│   C - Create Adv  → Make useful aspect                │
│   A - Attack      → Deal stress                       │
│   D - Defend      → Block attack/advantage            │
├────────────────────────────────────────────────────────┤
│ ASPECTS: Invoke for +2 or reroll (costs 1 FP)         │
│          Compel for complication (gain 1 FP)          │
├────────────────────────────────────────────────────────┤
│ STRESS: Absorbs hits, clears end of scene             │
│ CONSEQUENCES: Mild(-2), Moderate(-4), Severe(-6)      │
│ TAKEN OUT: Can't absorb → opponent decides fate       │
│ CONCEDE: Exit on your terms, gain FP                  │
├────────────────────────────────────────────────────────┤
│ FATE POINTS: Invoke aspects, power stunts             │
│              Earn by accepting compels                │
└────────────────────────────────────────────────────────┘
```

---

## Attribution

This document summarizes mechanics from **Fate Core System**, a product of Evil Hat Productions, LLC, licensed under the [Creative Commons Attribution 3.0 Unported license](https://creativecommons.org/licenses/by/3.0/).

For the complete rules, visit [fate-srd.com](https://fate-srd.com/).

import { WorldState, WorldEvent } from '@llmrpg/protocol';
import { DeltaCollector } from '@llmrpg/core';

export class WorldEventsManager {
  constructor(private deltaCollector: DeltaCollector) {}

  /**
   * Check and trigger world events based on current state and turn.
   */
  processEvents(worldState: WorldState, currentTurn: number): WorldEvent[] {
    const triggeredEvents: WorldEvent[] = [];

    // Ensure events array exists and is iterable
    const events = (worldState as any).events;
    if (!events || !Array.isArray(events)) {
      return triggeredEvents;
    }

    for (const event of events) {
      // Skip invalid events or events without proper trigger
      if (!event || !event.trigger || !event.trigger.type) continue;
      if (!event.active || event.triggered) continue;

      let shouldTrigger = false;

      switch (event.trigger.type) {
        case 'time':
          if (currentTurn >= event.trigger.turn) {
            shouldTrigger = true;
          }
          break;
        case 'condition':
          // Simple condition evaluation - in real implementation, use a proper evaluator
          shouldTrigger = this.evaluateCondition(event.trigger.condition, worldState);
          break;
        case 'random':
          if (Math.random() < event.trigger.chance) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        this.applyEventEffects(event, worldState);
        event.triggered = true;
        triggeredEvents.push(event);
      }
    }

    return triggeredEvents;
  }

  /**
   * Simple condition evaluator - expand as needed.
   */
  private evaluateCondition(condition: string, worldState: WorldState): boolean {
    // Example: "faction_reputation.corporate < -50"
    if (condition.includes('faction_reputation')) {
      const match = condition.match(/faction_reputation\.(\w+)\s*<\s*(-?\d+)/);
      if (match) {
        const factionId = match[1];
        const threshold = parseInt(match[2]);
        const faction = worldState.factions[factionId];
        if (faction) {
          // Assume player reputation
          const playerRep = faction.relationships['player'] || 0;
          return playerRep < threshold;
        }
      }
    }
    return false;
  }

  /**
   * Apply the effects of a triggered event.
   */
  private applyEventEffects(event: WorldEvent, worldState: WorldState) {
    for (const effect of event.effects) {
      switch (effect.type) {
        case 'aspect_add':
          if (typeof effect.data === 'object' && effect.data !== null) {
            worldState.aspects.push(effect.data as any);
            this.deltaCollector.collect({
              target: 'world',
              operation: 'append',
              path: ['aspects'],
              previousValue: null,
              newValue: effect.data,
              cause: 'world_event',
              eventId: event.id
            });
          }
          break;
        case 'location_change':
          // Update location properties
          const locId = effect.target;
          if (worldState.locations[locId] && typeof effect.data === 'object') {
            const oldLoc = { ...worldState.locations[locId] };
            Object.assign(worldState.locations[locId], effect.data);
            this.deltaCollector.collect({
              target: 'world',
              operation: 'set',
              path: ['locations', locId],
              previousValue: oldLoc,
              newValue: worldState.locations[locId],
              cause: 'world_event',
              eventId: event.id
            });
          }
          break;
        case 'faction_change':
          const facId = effect.target;
          if (worldState.factions[facId] && typeof effect.data === 'object') {
            const oldFac = { ...worldState.factions[facId] };
            Object.assign(worldState.factions[facId], effect.data);
            this.deltaCollector.collect({
              target: 'world',
              operation: 'set',
              path: ['factions', facId],
              previousValue: oldFac,
              newValue: worldState.factions[facId],
              cause: 'world_event',
              eventId: event.id
            });
          }
          break;
        // Add more effect types as needed
      }
    }
  }

  /**
   * Add a new world event.
   */
  addEvent(worldState: WorldState, event: Omit<WorldEvent, 'id' | 'triggered'>) {
    const newEvent: WorldEvent = {
      ...event,
      id: crypto.randomUUID(),
      triggered: false,
    };
    (worldState as any).events.push(newEvent);
    this.deltaCollector.collect({
      target: 'world',
      operation: 'append',
      path: ['events'],
      previousValue: null,
      newValue: newEvent,
      cause: 'event_creation',
      eventId: 'world_event_creation'
    });
  }
}
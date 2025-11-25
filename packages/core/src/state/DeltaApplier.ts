import { Delta } from '../types/state';

export function applyDelta(state: any, delta: Delta): any {
  // We will mutate the state for performance in replay scenarios.
  // If immutability is required, the caller should clone the state first.

  let root: any;

  // Map target to state root property
  switch (delta.target) {
    case 'player':
      root = state.player;
      break;
    case 'world':
      root = state.world;
      break;
    case 'npc':
      // Assuming state.npcs is a map/record
      // The first element of path might be the NPC ID if not handled otherwise?
      // Or maybe the path should be relative to the specific NPC?
      // If target is 'npc', we expect the path to identify which NPC?
      // Or maybe `target` should be `npc:<id>`?
      // The `core` types say `target: 'npc'`.
      // Let's assume the path's first element is the NPC ID for 'npc' target, 
      // OR the system is designed such that we need to know which NPC it is.
      // Looking at `DeltaCollector`, it doesn't seem to store ID separately in `Delta` interface, 
      // except maybe in `path` or `target` string if it was flexible.
      // But `DeltaTarget` is a union of string literals.
      
      // If `target` is 'npc', `path` MUST start with NPC ID or we have a problem.
      // Let's assume `state.npcs` exists.
      root = state.npcs;
      break;
    case 'scene':
      root = state.currentScene;
      break;
    case 'location':
      // Assuming state.world.locations
      root = state.world.locations;
      break;
    default:
      // Fallback or other targets
      root = state;
      break;
  }

  if (!root) {
    console.warn(`Target root not found for delta: ${delta.target}`);
    return state;
  }

  // Traverse path
  let current = root;
  const path = delta.path;
  
  // For the last element, we perform the operation
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === undefined) {
      // Create intermediate objects if missing (for 'create' ops deep in structure)
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = path[path.length - 1];

  switch (delta.operation) {
    case 'set':
      current[lastKey] = delta.newValue;
      break;
    case 'increment':
      current[lastKey] = (current[lastKey] || 0) + (delta.newValue as number);
      break;
    case 'decrement':
      current[lastKey] = (current[lastKey] || 0) - (delta.newValue as number);
      break;
    case 'append':
      if (!Array.isArray(current[lastKey])) {
        current[lastKey] = [];
      }
      current[lastKey].push(delta.newValue);
      break;
    case 'remove':
      if (Array.isArray(current[lastKey])) {
        // If newValue is the item to remove
        const index = current[lastKey].indexOf(delta.newValue);
        if (index > -1) {
          current[lastKey].splice(index, 1);
        }
      } else if (typeof current[lastKey] === 'object') {
         delete current[lastKey];
      }
      break;
    case 'delete':
       if (Array.isArray(current)) {
           // If lastKey is index
           const idx = parseInt(lastKey);
           if (!isNaN(idx)) {
               current.splice(idx, 1);
           }
       } else {
           delete current[lastKey];
       }
       break;
    case 'create':
       // Similar to set, but implies it didn't exist
       current[lastKey] = delta.newValue;
       break;
    // ... handle other ops
    default:
      console.warn(`Unknown operation: ${delta.operation}`);
      break;
  }

  return state;
}

import { TurnManager, FateDice } from '@llmrpg/core';
import { SessionWriter, FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import { StateInspector } from '@llmrpg/debug';
import path from 'path';

async function main() {
  console.log('Starting LLMRPGv2 Demo...');

  // 1. Setup Storage
  const storagePath = path.join(process.cwd(), 'temp-storage');
  const fsAdapter = new FileSystemAdapter(storagePath);
  const writer = new SessionWriter(fsAdapter);
  const loader = new SessionLoader(fsAdapter);

  // 2. Create Session
  const sessionId = `demo-${Date.now()}`;
  console.log(`Creating session: ${sessionId}`);
  
  await writer.createSession(sessionId, {
      themeName: 'Fantasy',
      playerName: 'DemoPlayer',
      characterName: 'Hero'
  });

  // 3. Simulate Turns (Mocking for now as we don't have full game loop)
  console.log('Simulating turns...');
  
  // Create a turn
  const turnManager = new TurnManager(sessionId);
  const turn = turnManager.startTurn('player', 'scene-1', {
      turnNumber: 1,
      phase: 'action',
      timestamp: Date.now()
  });
  
  // Add an event
  turnManager.addEvent('narrative', 'gm', {
      description: "You stand before the ancient gate."
  });
  
  // Log turn
  await writer.writeTurn(sessionId, turn);
  
  // Log a delta (simulated)
  await writer.writeDelta(sessionId, {
      deltaId: `${sessionId}-1-1`,
      turnId: 1,
      sequence: 1,
      timestamp: Date.now(),
      target: 'world',
      operation: 'set',
      path: ['locations', 'gate', 'status'],
      previousValue: undefined,
      newValue: 'open',
      cause: 'gm_narration',
      eventId: 'event-1'
  });

  // 4. Inspect State
  console.log('Inspecting state...');
  const inspector = new StateInspector(loader);
  
  try {
      // We need to wait a bit for file system? No, await should handle it.
      
      // Inspect state at turn 1
      // Note: getStateAtTurn currently relies on current state being updated, 
      // but we only wrote logs, not updated the state file (SessionWriter.updateState is needed).
      // SessionWriter doesn't have updateState exposed?
      // Let's check SessionWriter.
      
      // Assuming we can read what we wrote.
      const metadata = await loader.loadSessionMetadata(sessionId);
      console.log('Session Metadata:', metadata);
      
      const deltas = await loader.loadDeltas(sessionId, 1, 1);
      console.log('Deltas for turn 1:', deltas);
      
      // Validate
      const validation = await inspector.validateSession(sessionId);
      console.log('Validation:', validation);
      
  } catch (err) {
      console.error('Inspection failed:', err);
  }
  
  console.log('Demo completed.');
}

main().catch(console.error);

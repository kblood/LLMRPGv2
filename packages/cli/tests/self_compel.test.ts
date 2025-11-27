import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `self-compel-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

async function main() {
  console.log('Starting Self-Compel System Test...\n');
  
  // Setup
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
  }
  
  const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
  const sessionWriter = new SessionWriter(fsAdapter);
  
  await sessionWriter.createSession(SESSION_ID, {
    startTime: Date.now(),
    player: 'Test Player'
  });
  
  const llm = new MockAdapter();
  const gm = new GameMaster(SESSION_ID, llm, sessionWriter);
  
  console.log('Initializing world...');
  await gm.initializeWorld('Dark Fantasy');
  
  console.log('Creating character...');
  await gm.createCharacter('A clumsy wizard');
  
  // Manually add an aspect to compel
  if (gm['player']) {
      gm['player'].aspects.push({
          id: 'aspect-clumsy',
          name: 'Clumsy',
          type: 'trouble',
          description: 'Prone to accidents',
          freeInvokes: 0
      });
      // Set initial FP
      gm['player'].fatePoints.current = 3;
  }
  
  await gm.start();
  
  // Mock DecisionEngine.classifyIntent
  (gm as any).decisionEngine.classifyIntent = async () => 'self_compel';

  // Mock DecisionEngine.parseSelfCompel
  const mockSelfCompel = {
      aspectName: 'Clumsy',
      description: 'I trip over my own robes and drop the potion.'
  };
  (gm as any).decisionEngine.parseSelfCompel = async () => mockSelfCompel;
  
  console.log('\n--- Test 1: Self Compel ---');
  const action = "I compel my Clumsy aspect to trip.";
  console.log(`Player Action: "${action}"`);
  
  const initialFP = gm['player']?.fatePoints.current || 0;
  console.log(`Initial FP: ${initialFP}`);

  const result = await gm.processPlayerAction(action) as any;
  
  console.log(`Result: ${result.result}`);
  console.log(`Narration: ${result.narration}`);
  
  const newFP = gm['player']?.fatePoints.current || 0;
  console.log(`New FP: ${newFP}`);
  
  if (newFP === initialFP + 1) {
      console.log('✅ FP Awarded correctly for self-compel.');
  } else {
      console.error(`❌ FP NOT Awarded correctly. Expected ${initialFP + 1}, got ${newFP}`);
  }

  // Verify event log
  const lastTurn = gm['history'][gm['history'].length - 1];
  console.log("Events in last turn:", JSON.stringify(lastTurn.events, null, 2));
  const compelEvent = lastTurn.events.find((e: any) => e.type === 'fate_compel' && e.action === 'self_compel');
  
  if (compelEvent && compelEvent.metadata) {
      console.log('✅ Self-compel event logged.');
      if (compelEvent.metadata.source === 'player') {
          console.log('✅ Source is correctly set to "player".');
      } else {
          console.error(`❌ Source is incorrect: ${compelEvent.metadata.source}`);
      }
  } else {
      console.error('❌ Self-compel event NOT logged or missing metadata.');
  }
}

main().catch(console.error);

import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `boost-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

async function main() {
  console.log('Starting Boost System Test...\n');
  
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
  await gm.createCharacter('A skilled rogue');
  
  await gm.start();
  
  // Mock DecisionEngine to ensure Success with Style
  (gm as any).decisionEngine.classifyIntent = async () => 'fate_action';
  (gm as any).decisionEngine.selectSkill = async () => ({ name: 'Athletics', rating: 4 });
  (gm as any).decisionEngine.setOpposition = async () => 0; // Mediocre difficulty
  (gm as any).fateDice.roll = () => ({ dice: [1, 1, 1, 1], total: 4 }); // +4 roll
  
  // Mock generateBoostName
  (gm as any).decisionEngine.generateBoostName = async () => "Momentum";
  
  // Mock generateCompel to avoid interference
  (gm as any).decisionEngine.generateCompel = async () => null;
  
  console.log('\n--- Test 1: Earn Boost (Success with Style) ---');
  const action = "I gracefully dodge the attack.";
  console.log(`Player Action: "${action}"`);
  
  try {
    const result = await gm.processPlayerAction(action);
    console.log("Process Result:", result);
  } catch (e) {
    console.error("Process Error:", e);
  }
  
  // Debug events
  if (gm['history'].length > 0) {
      const lastTurn = gm['history'][gm['history'].length - 1];
      console.log("Events:", JSON.stringify(lastTurn.events, null, 2));
  } else {
      console.log("History is empty!");
  }

  const player = gm['player'];
  const boost = player?.aspects.find((a: any) => a.type === 'boost');
  
  if (boost) {
      console.log(`✅ Boost created: ${boost.name}`);
      if (boost.freeInvokes === 1) {
          console.log('✅ Boost has 1 free invoke.');
      } else {
          console.error(`❌ Boost has wrong free invokes: ${boost.freeInvokes}`);
      }
  } else {
      console.error('❌ Boost NOT created.');
  }
  
  // Test 2: Use Boost
  console.log('\n--- Test 2: Use Boost ---');
  if (boost) {
      // Mock AI player invoking the boost
      // We need to simulate the AI player logic or manually trigger an action with invokes
      // processAIPlayerAction allows passing invokes
      
      const invoke = { aspectName: boost.name, bonus: '+2' as const };
      
      // Reset dice to normal
      (gm as any).fateDice.roll = () => ({ dice: [0, 0, 0, 0], total: 0 });
      
      await gm.processAIPlayerAction("I strike back!", "Using my momentum", 0, [invoke]);
      
      const playerAfter = gm['player'];
      const boostAfter = playerAfter?.aspects.find((a: any) => a.id === boost.id);
      
      if (!boostAfter) {
          console.log('✅ Boost removed after use.');
      } else {
          console.error('❌ Boost NOT removed after use.');
      }
      
      // Verify event log
      const lastTurn = gm['history'][gm['history'].length - 1];
      const removeEvent = lastTurn.events.find((e: any) => e.action === 'boost_removed');
      if (removeEvent) {
          console.log('✅ Boost removal event logged.');
      } else {
          console.error('❌ Boost removal event NOT logged.');
      }
  }
}

main().catch(console.error);

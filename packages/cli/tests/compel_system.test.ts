import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';
import { Compel } from '@llmrpg/protocol';

const SESSION_ID = `compel-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

async function main() {
  console.log('Starting Compel System Test...\n');
  
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
  await gm.createCharacter('A stubborn warrior with a dark past');
  
  // Manually add an aspect to compel
  if (gm['player']) {
      gm['player'].aspects.push({
          id: 'aspect-trouble',
          name: 'Trouble: Short Tempered',
          type: 'trouble',
          description: 'Prone to anger',
          freeInvokes: 0
      });
      // Give some FP
      gm['player'].fatePoints.current = 3;
  }
  
  await gm.start();
  
  // Mock DecisionEngine.generateCompel
  const mockCompel: any = {
      aspectName: 'Trouble: Short Tempered',
      type: 'decision',
      description: 'Your anger flares up at the insult. You feel the urge to attack immediately instead of talking.'
  };
  
  (gm as any).decisionEngine.generateCompel = async () => mockCompel;
  
  console.log('\n--- Test 1: Trigger Compel ---');
  const action = "I try to negotiate calmly.";
  console.log(`Player Action: "${action}"`);
  
  const result = await gm.processPlayerAction(action) as any;
  
  if (result.result === 'compel_offered') {
      console.log('✅ Compel Offered successfully!');
      console.log(`   Description: ${result.compel?.description}`);
      
      // Test Accept
      console.log('\n--- Test 2: Accept Compel ---');
      const initialFP = gm['player']?.fatePoints.current || 0;
      console.log(`Initial FP: ${initialFP}`);
      
      const acceptResult = await gm.resolveCompel(result.compel!, true);
      console.log(`Result: ${acceptResult.result}`);
      console.log(`Narration: ${acceptResult.narration}`);
      
      const newFP = gm['player']?.fatePoints.current || 0;
      console.log(`New FP: ${newFP}`);
      
      if (newFP === initialFP + 1) {
          console.log('✅ FP Awarded correctly.');
      } else {
          console.error('❌ FP NOT Awarded correctly.');
      }
      
  } else {
      console.error('❌ Compel NOT offered.');
      console.log(result);
  }
  
  // Test Refuse
  console.log('\n--- Test 3: Refuse Compel ---');
  // Reset FP
  if (gm['player']) gm['player'].fatePoints.current = 3;
  
  // Trigger another compel
  const result2 = await gm.processPlayerAction(action) as any;
  
  if (result2.result === 'compel_offered') {
      const initialFP = gm['player']?.fatePoints.current || 0;
      console.log(`Initial FP: ${initialFP}`);
      
      const refuseResult = await gm.resolveCompel(result2.compel!, false);
      console.log(`Result: ${refuseResult.result}`);
      console.log(`Narration: ${refuseResult.narration}`);
      
      const newFP = gm['player']?.fatePoints.current || 0;
      console.log(`New FP: ${newFP}`);
      
      if (newFP === initialFP - 1) {
          console.log('✅ FP Deducted correctly.');
      } else {
          console.error('❌ FP NOT Deducted correctly.');
      }
      
      // Verify we can retry action
      console.log('\n--- Test 4: Retry Action ---');
      const retryResult = await gm.processPlayerAction(action, undefined, true) as any;
      if (retryResult.result !== 'compel_offered') {
          console.log('✅ Action proceeded without compel offer.');
      } else {
          console.error('❌ Compel offered again despite skip flag.');
      }
      
  } else {
      console.error('❌ Compel NOT offered for second test.');
  }

}

main().catch(console.error);

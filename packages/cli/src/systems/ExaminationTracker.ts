import { GameState } from '@llmrpg/protocol';

/**
 * Utility for tracking and analyzing object examinations to prevent repetitive interactions
 */

export interface ExaminationRecord {
  locationId: string;
  objectId: string;
  objectName: string;
  actionType: 'examine' | 'investigate' | 'interact';
  lastResult: string;
  examineCount: number;
  firstExamineTurn: number;
  lastExamineTurn: number;
}

/**
 * Generate a hash/summary of examination result text
 * Normalizes the text to detect when the same result is returned multiple times
 */
export function hashExaminationResult(resultText: string): string {
  // Normalize: remove extra whitespace, convert to lowercase, take first 100 chars
  return resultText
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

/**
 * Record an examination result in the game state history
 */
export function recordExamination(
  gameState: GameState,
  locationId: string,
  objectId: string,
  objectName: string,
  resultText: string,
  actionType: 'examine' | 'investigate' | 'interact' = 'examine'
): void {
  const resultHash = hashExaminationResult(resultText);
  const currentTurn = gameState.turn;

  // Find existing record
  const existingIndex = gameState.examinationHistory.findIndex(
    (record) =>
      record.locationId === locationId &&
      record.objectId === objectId &&
      record.actionType === actionType
  );

  if (existingIndex !== -1) {
    // Update existing record
    const existing = gameState.examinationHistory[existingIndex];
    existing.lastResult = resultHash;
    existing.examineCount++;
    existing.lastExamineTurn = currentTurn;
  } else {
    // Create new record
    gameState.examinationHistory.push({
      locationId,
      objectId,
      objectName,
      actionType,
      lastResult: resultHash,
      examineCount: 1,
      firstExamineTurn: currentTurn,
      lastExamineTurn: currentTurn,
    });
  }
}

/**
 * Get examination saturation info for a specific object
 */
export function getExaminationSaturation(
  gameState: GameState,
  locationId: string,
  objectId: string,
  actionType: 'examine' | 'investigate' | 'interact' = 'examine'
): { isSaturated: boolean; count: number; feedback: string } {
  const record = gameState.examinationHistory.find(
    (r) =>
      r.locationId === locationId &&
      r.objectId === objectId &&
      r.actionType === actionType
  );

  if (!record) {
    return { isSaturated: false, count: 0, feedback: '' };
  }

  // Graduated feedback based on examination count
  const count = record.examineCount;
  let feedback = '';
  let isSaturated = false;

  if (count === 1) {
    feedback = ''; // No warning on first examination
  } else if (count === 2) {
    feedback = `🔍 You notice nothing new examining "${record.objectName}" again.`;
  } else if (count === 3) {
    feedback = `⚠️ Further examination of "${record.objectName}" reveals nothing new. This is thoroughly explored.`;
    isSaturated = true;
  } else {
    feedback = `❌ You already understand "${record.objectName}" completely. Examining it again would waste time.`;
    isSaturated = true;
  }

  return { isSaturated, count, feedback };
}

/**
 * Get all saturated objects at a location for context building
 */
export function getSaturatedObjectsAtLocation(
  gameState: GameState,
  locationId: string
): Map<string, string> {
  const saturated = new Map<string, string>();

  gameState.examinationHistory
    .filter((r) => r.locationId === locationId && r.examineCount >= 3)
    .forEach((record) => {
      saturated.set(record.objectId, record.objectName);
    });

  return saturated;
}

/**
 * Check if an examination should show saturation warning
 */
export function shouldWarnAboutSaturation(
  gameState: GameState,
  locationId: string,
  objectId: string,
  actionType: 'examine' | 'investigate' | 'interact' = 'examine'
): boolean {
  const saturation = getExaminationSaturation(gameState, locationId, objectId, actionType);
  return saturation.isSaturated || saturation.count >= 2;
}

/**
 * Session to PDF Exporter
 *
 * Generates PDF exports of sessions with multiple format options.
 * Uses a simple text-based PDF structure for maximum compatibility
 * without external dependencies.
 *
 * Note: For more advanced PDF features (images, complex layouts),
 * consider adding a library like 'pdf-lib' or 'pdfkit'.
 */

import { FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import { Turn } from '@llmrpg/core';
import path from 'path';
import fs from 'fs';

interface SessionInfo {
  id: string;
  folder: string;
  metadata?: any;
  turnCount?: number;
}

type ExportFormat = 'story' | 'summary' | 'technical';

// Simple PDF Document Builder (No external dependencies)
class SimplePDFBuilder {
  private content: string[] = [];
  private pageHeight = 842; // A4 in points
  private pageWidth = 595; // A4 in points
  private margin = 40;
  private yPosition = this.margin;

  addTitle(text: string, fontSize: number = 24): void {
    this.content.push(`% Title: ${text}`);
    this.content.push(`BT /F1 ${fontSize} Tf 50 ${this.pageHeight - this.yPosition} Td (${this.escapeText(text)}) Tj ET`);
    this.yPosition += fontSize + 10;
    this.checkPageBreak();
  }

  addHeading(text: string, level: number = 1): void {
    const fontSize = 24 - level * 2;
    this.content.push(`BT /F1 ${fontSize} Tf 50 ${this.pageHeight - this.yPosition} Td (${this.escapeText(text)}) Tj ET`);
    this.yPosition += fontSize + 8;
    this.checkPageBreak();
  }

  addText(text: string, fontSize: number = 12): void {
    // Split text into lines for word wrapping
    const maxCharsPerLine = 80;
    const lines = this.wrapText(text, maxCharsPerLine);

    for (const line of lines) {
      this.content.push(`BT /F1 ${fontSize} Tf 50 ${this.pageHeight - this.yPosition} Td (${this.escapeText(line)}) Tj ET`);
      this.yPosition += fontSize + 4;
      this.checkPageBreak();
    }
  }

  addSpace(height: number = 12): void {
    this.yPosition += height;
    this.checkPageBreak();
  }

  addHorizontalLine(): void {
    this.content.push(`q 0.5 w 50 ${this.pageHeight - this.yPosition} m 550 ${this.pageHeight - this.yPosition} l S Q`);
    this.yPosition += 10;
    this.checkPageBreak();
  }

  private checkPageBreak(): void {
    if (this.yPosition > this.pageHeight - this.margin) {
      this.content.push('showpage');
      this.yPosition = this.margin;
    }
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length > maxChars) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }

    if (currentLine) lines.push(currentLine.trim());
    return lines;
  }

  private escapeText(text: string): string {
    return text.replace(/[\\()]/g, m => '\\' + m);
  }

  build(): string {
    // Create a simple text-based PDF (for compatibility without external libraries)
    // Format: Text exported as plain text with structure preserved
    return this.content.join('\n');
  }

  /**
   * Generate a structured text representation suitable for PDF conversion
   * This can be used with external tools or libraries
   */
  buildAsText(): string {
    return this.content.map(line => {
      // Remove PDF commands, keep text
      if (line.includes('Tj')) {
        const match = line.match(/\(([^)]+)\)/);
        return match ? match[1] : '';
      }
      if (line.startsWith('%')) {
        return line.substring(2);
      }
      return '';
    }).filter(Boolean).join('\n');
  }
}

function escapeText(text: string): string {
  return text.replace(/[\\()]/g, m => '\\' + m);
}

function generateStoryPDF(turns: Turn[], metadata: any, sessionId: string): string {
  const builder = new SimplePDFBuilder();

  // Title
  builder.addTitle(metadata?.theme?.name || 'Session Report', 24);
  builder.addText(`Session ID: ${sessionId}`, 10);
  builder.addText(`Total Turns: ${turns.length}`, 10);
  builder.addSpace(20);

  // Story
  builder.addHeading('Session Story', 1);
  builder.addHorizontalLine();

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    builder.addHeading(`Turn ${i + 1}: ${turn.actor || 'Unknown'}`, 3);

    if (turn.narration) {
      builder.addText(turn.narration, 11);
    }

    if (turn.events && turn.events.length > 0) {
      builder.addSpace(8);
      builder.addText('Events:', 10);
      for (const event of turn.events) {
        const desc = (event as any).description || JSON.stringify(event);
        builder.addText(`  • ${desc}`, 10);
      }
    }

    builder.addSpace(15);
  }

  return builder.buildAsText();
}

function generateSummaryPDF(turns: Turn[], metadata: any, sessionId: string): string {
  const builder = new SimplePDFBuilder();

  // Title
  builder.addTitle('Session Summary', 24);
  builder.addText(`Session ID: ${sessionId}`, 10);
  builder.addSpace(20);

  // Statistics
  const totalTurns = turns.length;
  const combatTurns = turns.filter((t: any) => t.events?.some((e: any) => e.type === 'combat')).length;
  const successfulChecks = turns.filter((t: any) =>
    t.events?.some((e: any) => e.type === 'skill_check' && (e as any).shifts >= 0)
  ).length;
  const questUpdates = turns.filter((t: any) => t.events?.some((e: any) => e.type === 'quest_update')).length;

  builder.addHeading('Statistics', 1);
  builder.addHorizontalLine();
  builder.addText(`Total Turns: ${totalTurns}`, 12);
  builder.addText(`Combat Turns: ${combatTurns}`, 12);
  builder.addText(`Successful Checks: ${successfulChecks}`, 12);
  builder.addText(`Quest Updates: ${questUpdates}`, 12);
  builder.addSpace(10);

  const successRate = totalTurns > 0 ? ((successfulChecks / totalTurns) * 100).toFixed(1) : '0';
  builder.addText(`Success Rate: ${successRate}%`, 12);
  builder.addSpace(20);

  // Key moments
  builder.addHeading('Key Moments', 1);
  builder.addHorizontalLine();

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const isMilestone = turn.events?.some((e: any) => e.type === 'quest_update' || e.type === 'knowledge_gain');

    if (isMilestone || i === 0 || i === turns.length - 1) {
      builder.addHeading(`Turn ${i + 1}: ${turn.actor}`, 3);
      if (turn.narration) {
        builder.addText(turn.narration, 11);
      }
      builder.addSpace(10);
    }
  }

  return builder.buildAsText();
}

function generateTechnicalPDF(turns: Turn[], metadata: any, sessionId: string): string {
  const builder = new SimplePDFBuilder();

  // Title
  builder.addTitle('Technical Report', 24);
  builder.addText(`Session ID: ${sessionId}`, 10);
  builder.addSpace(20);

  // Metadata
  builder.addHeading('Session Metadata', 1);
  builder.addHorizontalLine();
  builder.addText(`Total Turns: ${turns.length}`, 11);
  builder.addText(`Theme: ${metadata?.theme?.name || 'Unknown'}`, 11);
  builder.addText(`Created: ${metadata?.createdAt || 'Unknown'}`, 11);
  builder.addSpace(20);

  // Turn-by-turn breakdown
  builder.addHeading('Turn Details', 1);
  builder.addHorizontalLine();

  for (let i = 0; i < Math.min(turns.length, 20); i++) {
    // Limit to first 20 turns for technical report
    const turn = turns[i];
    builder.addHeading(`Turn ${i + 1}`, 3);
    builder.addText(`Actor: ${turn.actor || 'Unknown'}`, 10);
    builder.addText(`ID: ${turn.turnId || 'Unknown'}`, 10);

    if (turn.events && turn.events.length > 0) {
      builder.addText(`Events: ${turn.events.length}`, 10);
      for (const event of turn.events) {
        const type = (event as any).type || 'unknown';
        builder.addText(`  - ${type}`, 9);
      }
    }

    builder.addSpace(8);
  }

  if (turns.length > 20) {
    builder.addText(`... and ${turns.length - 20} more turns`, 10);
  }

  return builder.buildAsText();
}

async function generatePDF(sessionId: string, format: ExportFormat, outputPath: string): Promise<void> {
  try {
    const adapter = new FileSystemAdapter(path.join(__dirname, '../../../test-sessions'));
    const loader = new SessionLoader(adapter);

    const metadata = await loader.loadSessionMetadata(sessionId);
    // Load a large range of turns (assuming sessions don't exceed 10,000 turns)
    const turns = await loader.loadTurns(sessionId, 0, 10000);

    let content = '';
    switch (format) {
      case 'story':
        content = generateStoryPDF(turns, metadata, sessionId);
        break;
      case 'summary':
        content = generateSummaryPDF(turns, metadata, sessionId);
        break;
      case 'technical':
        content = generateTechnicalPDF(turns, metadata, sessionId);
        break;
    }

    // For now, save as text format
    // In production, this would be converted to actual PDF using a library
    const txtPath = outputPath.replace('.pdf', '.txt');
    fs.writeFileSync(txtPath, content, 'utf-8');

    console.log(`✅ PDF export (text format) saved to: ${txtPath}`);
    console.log(
      'Note: To generate actual PDF files, install "pdf-lib" or similar: pnpm add pdf-lib'
    );
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

// Export main function
export async function exportSessionAsPDF(
  sessionId: string,
  format: ExportFormat = 'story',
  outputPath?: string
): Promise<void> {
  const defaultPath = outputPath || `session-${sessionId}-${format}.pdf`;
  await generatePDF(sessionId, format, defaultPath);
}

export { ExportFormat };

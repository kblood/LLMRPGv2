/**
 * Unified Session Export Interface
 *
 * Provides a single entry point for all session export formats:
 * - Markdown (story, playreport, technical)
 * - HTML (story, arc, summary with rich styling)
 * - PDF (story, summary, technical in text format)
 *
 * Usage:
 *   const exporter = new SessionExporter();
 *   await exporter.export('session-123', 'html', 'story');
 */

import path from 'path';
import fs from 'fs';
import { exportSessionAsHTML } from './exportSessionToHTML';
import { exportSessionAsPDF } from './exportSessionToPDF';

type ExportType = 'markdown' | 'html' | 'pdf';
type ExportFormat = 'story' | 'playreport' | 'technical' | 'arc' | 'summary';

interface ExportOptions {
  outputPath?: string;
  overwrite?: boolean;
}

interface ExportResult {
  success: boolean;
  outputPath: string;
  format: string;
  type: ExportType;
  message: string;
}

export class SessionExporter {
  private defaultOutputDir: string;

  constructor(outputDir?: string) {
    this.defaultOutputDir = outputDir || './exports';

    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.defaultOutputDir)) {
      fs.mkdirSync(this.defaultOutputDir, { recursive: true });
    }
  }

  /**
   * Export a session in the specified format and type
   */
  async export(
    sessionId: string,
    type: ExportType,
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const outputPath = this.getOutputPath(sessionId, type, format, options.outputPath);

      // Check if file exists
      if (fs.existsSync(outputPath) && !options.overwrite) {
        return {
          success: false,
          outputPath,
          format,
          type,
          message: `File already exists: ${outputPath}. Use overwrite: true to replace.`,
        };
      }

      // Export based on type
      switch (type) {
        case 'html':
          await exportSessionAsHTML(sessionId, format as any, outputPath);
          break;
        case 'pdf':
          await exportSessionAsPDF(sessionId, format as any, outputPath);
          break;
        case 'markdown':
          return {
            success: false,
            outputPath,
            format,
            type,
            message: 'Markdown export is handled by exportSessionToMarkdown.ts',
          };
        default:
          throw new Error(`Unsupported export type: ${type}`);
      }

      return {
        success: true,
        outputPath,
        format,
        type,
        message: `Successfully exported to ${outputPath}`,
      };
    } catch (error) {
      return {
        success: false,
        outputPath: options.outputPath || '',
        format,
        type,
        message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Export a session in all available formats
   */
  async exportAll(sessionId: string, options: ExportOptions = {}): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    const formats: Array<[ExportType, ExportFormat[]]> = [
      ['html', ['story', 'arc', 'summary']],
      ['pdf', ['story', 'summary', 'technical']],
    ];

    for (const [type, typeFormats] of formats) {
      for (const format of typeFormats) {
        const result = await this.export(sessionId, type, format, options);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get a list of all available export format combinations
   */
  getAvailableFormats(): Array<{
    type: ExportType;
    formats: ExportFormat[];
    description: string;
  }> {
    return [
      {
        type: 'html',
        formats: ['story', 'arc', 'summary'],
        description: 'HTML exports with rich styling (recommended for web viewing)',
      },
      {
        type: 'pdf',
        formats: ['story', 'summary', 'technical'],
        description: 'PDF exports (currently in text format, can be enhanced with pdf-lib)',
      },
      {
        type: 'markdown',
        formats: ['story', 'playreport', 'technical'],
        description: 'Markdown exports (handled by separate exporter)',
      },
    ];
  }

  /**
   * Get metadata about export capabilities
   */
  getExportInfo(): {
    totalFormats: number;
    supportedTypes: ExportType[];
    recommendations: string[];
  } {
    return {
      totalFormats: 8, // 3 HTML + 3 PDF + 2 Markdown
      supportedTypes: ['html', 'pdf', 'markdown'],
      recommendations: [
        'Use HTML format for interactive web viewing with rich styling',
        'Use PDF format for printing and archival',
        'Use Markdown format for version control and text-based tools',
        'Character Development Arc is only available in HTML format',
        'PDF support is enhanced with "pdf-lib": pnpm add pdf-lib',
      ],
    };
  }

  /**
   * Clean up old exports (optional maintenance function)
   */
  cleanupOldExports(daysOld: number = 30): {
    deleted: number;
    failed: string[];
  } {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deleted = 0;
    const failed: string[] = [];

    try {
      if (fs.existsSync(this.defaultOutputDir)) {
        const files = fs.readdirSync(this.defaultOutputDir);

        for (const file of files) {
          const filePath = path.join(this.defaultOutputDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtimeMs < cutoffTime) {
            try {
              fs.unlinkSync(filePath);
              deleted++;
            } catch (error) {
              failed.push(file);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }

    return { deleted, failed };
  }

  /**
   * Generate a summary report of all exports for a session
   */
  generateExportReport(sessionId: string): {
    sessionId: string;
    exportedFormats: Array<{ type: ExportType; format: ExportFormat; exists: boolean; path: string }>;
  } {
    const exportedFormats: Array<{ type: ExportType; format: ExportFormat; exists: boolean; path: string }> = [];

    const types: ExportType[] = ['html', 'pdf', 'markdown'];
    const formatMap: Record<ExportType, ExportFormat[]> = {
      html: ['story', 'arc', 'summary'],
      pdf: ['story', 'summary', 'technical'],
      markdown: ['story', 'playreport', 'technical'],
    };

    for (const type of types) {
      for (const format of formatMap[type]) {
        const outputPath = this.getOutputPath(sessionId, type, format);
        exportedFormats.push({
          type,
          format,
          exists: fs.existsSync(outputPath),
          path: outputPath,
        });
      }
    }

    return {
      sessionId,
      exportedFormats,
    };
  }

  /**
   * Generate the output file path based on session ID, type, and format
   */
  private getOutputPath(
    sessionId: string,
    type: ExportType,
    format: ExportFormat,
    customPath?: string
  ): string {
    if (customPath) {
      return customPath;
    }

    const ext = type === 'pdf' ? 'pdf' : type; // HTML files still have .html extension
    const filename = `${sessionId}-${format}.${ext}`;

    return path.join(this.defaultOutputDir, type, filename);
  }
}

// Export convenient factory functions for common use cases
export async function exportAsHTML(
  sessionId: string,
  format: ExportFormat = 'story',
  outputPath?: string
): Promise<void> {
  const exporter = new SessionExporter();
  const result = await exporter.export(sessionId, 'html', format, { outputPath });
  if (!result.success) {
    throw new Error(result.message);
  }
}

export async function exportAsPDF(
  sessionId: string,
  format: ExportFormat = 'story',
  outputPath?: string
): Promise<void> {
  const exporter = new SessionExporter();
  const result = await exporter.export(sessionId, 'pdf', format, { outputPath });
  if (!result.success) {
    throw new Error(result.message);
  }
}

export async function exportAll(sessionId: string, outputDir?: string): Promise<ExportResult[]> {
  const exporter = new SessionExporter(outputDir);
  return exporter.exportAll(sessionId);
}

export { ExportResult, ExportOptions };

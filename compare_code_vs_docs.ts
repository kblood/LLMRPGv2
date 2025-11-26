import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.turbo', 'out']);
const CODE_EXTENSIONS = new Set(['.ts', '.js', '.json', '.mjs', '.tsx', '.jsx']);
const DOC_EXTENSIONS = new Set(['.md']);

interface Stats {
    codeBytes: number;
    docBytes: number;
    codeFiles: number;
    docFiles: number;
}

function getStats(dir: string): Stats {
    let stats: Stats = { codeBytes: 0, docBytes: 0, codeFiles: 0, docFiles: 0 };
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name)) continue;
                const subStats = getStats(fullPath);
                stats.codeBytes += subStats.codeBytes;
                stats.docBytes += subStats.docBytes;
                stats.codeFiles += subStats.codeFiles;
                stats.docFiles += subStats.docFiles;
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const size = fs.statSync(fullPath).size;

                if (CODE_EXTENSIONS.has(ext)) {
                    stats.codeBytes += size;
                    stats.codeFiles++;
                } else if (DOC_EXTENSIONS.has(ext)) {
                    stats.docBytes += size;
                    stats.docFiles++;
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }

    return stats;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log('Analyzing project structure...');
const stats = getStats(ROOT_DIR);

console.log('\n--- Project Statistics ---');
console.log(`Code Files:      ${stats.codeFiles}`);
console.log(`Code Size:       ${formatBytes(stats.codeBytes)}`);
console.log(`Markdown Files:  ${stats.docFiles}`);
console.log(`Markdown Size:   ${formatBytes(stats.docBytes)}`);

const totalBytes = stats.codeBytes + stats.docBytes;
if (totalBytes > 0) {
    const codePercent = ((stats.codeBytes / totalBytes) * 100).toFixed(1);
    const docPercent = ((stats.docBytes / totalBytes) * 100).toFixed(1);
    console.log('\n--- Ratio (by size) ---');
    console.log(`Code:     ${codePercent}%`);
    console.log(`Markdown: ${docPercent}%`);
}

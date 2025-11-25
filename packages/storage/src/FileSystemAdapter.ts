import fs from 'fs-extra';
import path from 'path';

export class FileSystemAdapter {
  constructor(private basePath: string) {}

  /**
   * Ensures that the directory exists. If the directory structure does not exist, it is created.
   */
  async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(path.join(this.basePath, dirPath));
  }

  /**
   * Writes an object to a JSON file.
   */
  async writeJson(filePath: string, data: any): Promise<void> {
    await fs.outputJson(path.join(this.basePath, filePath), data, { spaces: 2 });
  }

  /**
   * Reads a JSON file and returns the parsed object.
   */
  async readJson<T>(filePath: string): Promise<T> {
    return await fs.readJson(path.join(this.basePath, filePath));
  }

  /**
   * Appends a string line to a file. Useful for .jsonl files.
   */
  async appendLine(filePath: string, line: string): Promise<void> {
    await fs.appendFile(path.join(this.basePath, filePath), line + '\n');
  }
  
  /**
   * Checks if a file or directory exists.
   */
  async exists(filePath: string): Promise<boolean> {
    return await fs.pathExists(path.join(this.basePath, filePath));
  }

  /**
   * Lists files in a directory.
   */
  async listFiles(dirPath: string): Promise<string[]> {
      const fullPath = path.join(this.basePath, dirPath);
      if (!await fs.pathExists(fullPath)) return [];
      return await fs.readdir(fullPath);
  }

  /**
   * Reads a file as a string.
   */
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(path.join(this.basePath, filePath), 'utf-8');
  }
}

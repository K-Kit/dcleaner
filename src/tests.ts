import fs from 'fs-extra';
import { join } from 'path';
import { DATA_DIR, CACHE_FILE, MAX_CACHE_AGE, TARGET_DIR_TO_REMOVE, TEST_DIR, WORKING_DIR } from './constants';

/**
 * Creates a file at the specified path and writes a specified amount of data to it, effectively setting the file's size to the given number of megabytes.
 * @param filePath - The path where the file will be created.
 * @param sizeInMB - The desired size of the file in megabytes.
 * @returns A Promise that resolves when the file writing is complete.
 */
export async function writeFileOfSize(filePath: string, sizeInMB: number): Promise<void> {
    fs.ensureFileSync(filePath);
    const stream = fs.createWriteStream(filePath);
    const chunkSize = 1024 * 1024; // 1 MB
    const buffer = Buffer.alloc(chunkSize, '0'); // Fill buffer with '0'

    for (let i = 0; i < sizeInMB; i++) {
        stream.write(buffer);
    }

    stream.end();
}

export async function createTestDir(path: string): Promise<void> {
    await fs.mkdirSync(path, { recursive: true });
}
export const testDirs: [string, number][] = [
    ['huge', 100], // 100MB
    ['medium', 10], // 10MB
    ['small', 1] // 1MB
];

export async function initTestDirs(path: string = '', targetDirToRemove: string = 'node_modules'): Promise<void> {
    for (const [dir, size] of testDirs) {
        fs.mkdirSync(join(DATA_DIR,TEST_DIR, dir), { recursive: true });
        await writeFileOfSize(join(DATA_DIR,TEST_DIR, dir, targetDirToRemove, 'test.txt'), size);
    }
}

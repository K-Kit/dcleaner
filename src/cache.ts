import path from 'path';
import { join } from 'path';
import { DATA_DIR, MAX_CACHE_AGE } from './constants';
import fs from 'fs-extra';

export class LocalCache {
    private cache: Record<
        string,
        {
            saved: Date | string;
            key: string;
            value: {
                size: number;
            } & any;
        }
    >;
    private maxCacheAge: number;
    private cacheFile: string;
    private workingDir: string;
    private targetDirToRemove: string;

    constructor({
        maxCacheAge = MAX_CACHE_AGE,
        cacheFile = 'cache.json',
        workingDir = process.cwd(),
        targetDirToRemove = 'node_modules'
    } = {}) {
        this.cache = {};
        this.maxCacheAge = maxCacheAge;
        this.cacheFile = cacheFile;
        this.workingDir = workingDir;
        this.targetDirToRemove = targetDirToRemove;
        fs.ensureFileSync(this.getCacheFilePath());
    }

    getKey(key: string) {
        return path.resolve(this.workingDir, this.targetDirToRemove, key);
    }

    get(key: string) {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key provided');
        }
        const saved = this.cache[this.getKey(key)];
        if (saved && new Date().getTime() - new Date(saved.saved).getTime() < this.maxCacheAge) {
            return saved.value;
        }
        return false;
    }

    set<T>(key: string, value: T) {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key provided');
        }
        (value as any).saved = new Date().toISOString();
        this.cache[this.getKey(key)] = value as any;
        this.save();
    }

    getCacheFilePath() {
        return path.resolve(process.cwd(), DATA_DIR, this.cacheFile);
    }

    save() {
        fs.writeJson(this.getCacheFilePath(), this.cache, { spaces: 2 }, (err) => {
            if (err) {
                console.error('Error saving cache', err);
            }
        });
    }

    load({ workingDir = process.cwd(), targetDirToRemove = 'node_modules', cacheFile = 'cache.json' } = {}) {
        this.workingDir = workingDir;
        this.targetDirToRemove = targetDirToRemove;
        this.cacheFile = cacheFile;
        try {
            const cache = fs.readJsonSync(this.getCacheFilePath(), { throws: false });
            if (cache) {
                this.cache = cache;
            }
        } catch (error) {
            console.error('Error loading cache', error);
        }
    }

    clear() {
        this.cache = {};
    }

    remove(key: string) {
        delete this.cache[key];
    }

    has(key: string) {
        return this.cache.hasOwnProperty(key);
    }

    cleanupExpiredEntries() {
        const currentTime = new Date().getTime();
        for (const key in this.cache) {
            if (currentTime - new Date(this.cache[key].saved).getTime() > this.maxCacheAge) {
                delete this.cache[key];
            }
        }
    }
}
export default LocalCache;

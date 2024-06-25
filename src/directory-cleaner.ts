#!/usr/bin/env bun
import { readdir, lstat } from 'fs/promises';
import { join } from 'path';
import Enquirer from 'enquirer';
import fs from 'fs-extra';
import * as R from 'ramda';
import { initTestDirs } from './tests';
import { DATA_DIR, CACHE_FILE, MAX_CACHE_AGE, TARGET_DIR_TO_REMOVE, TEST_DIR, WORKING_DIR } from './constants';
import Cache from './cache';
import { type Choice } from './types';
import { ascend, descend, sortBy, sortWith, uniq } from 'ramda';

export class DirectoryCleaner {
    e: Enquirer = new Enquirer();
    targetDirToRemove = 'node_modules' as string;
    sortBy: 'size' | 'mtime' | 'atime' = 'size';
    cache: Cache = new Cache();
    workingDir: string = process.argv[2] || process.cwd();
    cacheDir: string = DATA_DIR;
    cacheFile: string = join(this.cacheDir, CACHE_FILE);

    constructor(
        args: Partial<{
            targetDirToRemove: string;
            sortBy: 'size' | 'mtime' | 'atime';
            workingDir: string;
            cache: Cache;
            e: Enquirer;
            cacheFile: string;
        }> = {}
    ) {
        this.targetDirToRemove = args.targetDirToRemove || 'node_modules';
        this.sortBy = args.sortBy || 'size';
        this.workingDir = args.workingDir || process.cwd();
        this.cacheFile = args.cacheFile || join(this.cacheDir, CACHE_FILE);
        this.e = args.e || new Enquirer();
    }
    async getDirectories(path: string): Promise<string[]> {
        const files = await fs.promises.readdir(path, { withFileTypes: true, recursive: true });
        const directories = files
            .filter((file) => file.isDirectory() && file.name.match(this.targetDirToRemove))
            .map((file) => file.name.split('/')[0])
            .filter((dir) => dir !== 'empty');

        return uniq(directories);
    }

    async deleteDir(directory: string): Promise<void> {
        try {
            const rmPath = join(this.workingDir, directory, this.targetDirToRemove);
            try {
                await fs.promises.rm(rmPath, { recursive: true, force: true }).catch(() => {});
            } catch (error) {
                console.error(`Error removing directory ${rmPath}:`, error);
            }

            const subdirectories = await this.getDirectories(directory);
            for (const subdirectory of subdirectories) {
                await this.deleteDir(join(directory, subdirectory));
            }
        } catch (error) {
            console.error(`Error removing directory ${directory}:`, error);
        }
    }
    async getRelativePath(path: string): Promise<string> {
        return join(this.workingDir, path);
    }
    async getRecursiveTargetDirSize(path: string): Promise<{ size: number; sizeInMB: number }> {
        const cached = this.cache.get(path);
        if (cached) {
            return cached;
        }

        const children = await readdir(path, { withFileTypes: true, recursive: true }).then((files) =>
            files.filter((file) => file.isFile() && file.name.split('/').includes(this.targetDirToRemove))
        );

        if (children.length === 0) {
            return { size: 0, sizeInMB: 0 };
        }

        const sizes = await Promise.all(
            children.map(async (file) => {
                const filePath = join(path, file.name);
                const stats = await fs.promises.stat(filePath, { bigint: true });
                return stats.size;
            })
        );

        const size = parseInt(sizes.reduce((acc, curr) => acc + curr, 0n).toString());
        const sizeInMB = size / 10 ** 6;

        this.cache.set(path, { size, sizeInMB });
        await this.cache.save();

        return { size, sizeInMB };
    }

    async getChoices(path: string, { nameOnly = false } = {}): Promise<Choice[] | string[]> {
        try {
            const directories = await this.getDirectories(path);
            console.debug('getChoices', path, directories);
            const choices = await Promise.allSettled(
                directories.map(async (dir) => {
                    try {
                        const fullPath = join(path, dir);
                        const stats = await lstat(fullPath);
                        const { size, sizeInMB } = await this.getRecursiveTargetDirSize(fullPath);
                        const lastModifiedDaysAgo = Math.floor(
                            (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const choice: Choice = {
                            name: dir,
                            value: dir,
                            hint: `Size: ${sizeInMB.toFixed(2)} MB | modified: ${lastModifiedDaysAgo}d ago | accessed: ${Math.floor(
                                (Date.now() - stats.atime.getTime()) / (1000 * 60 * 60 * 24)
                            )}d ago`,
                            size,
                            atime: stats.atime,
                            mtime: stats.mtime,
                            sizeInMB
                        };
                        return choice;
                    } catch (error) {
                        console.error(`Error occurred while processing directory: ${dir}`, error);
                        return { status: 'rejected', reason: error };
                    }
                })
            );
            await this.cache.save();

            const fullChoices = choices
                .filter((x): x is PromiseFulfilledResult<Choice> => x.status === 'fulfilled')
                .map((x) => x.value);
            if (nameOnly) {
                return fullChoices.map((x) => x.name);
            }
            return fullChoices;
        } catch (error) {
            console.error(`An unexpected error occurred in getChoices function:`, error);
            return [];
        }
    }
    async setupTestDirs(run = true) {
        if (run) {
            await initTestDirs();
        }
    }
    async run() {
        const skipAll = process.argv.includes('-y');
        const showAll = process.argv.includes('-a');
        const initTest = process.argv.includes('-t');
        const noCache = process.argv.includes('-n');
        let { targetDirToRemove, sortBy, workingDir, cache } = this;
        await this.setupTestDirs(initTest);

        // Prompt user for working directory if not provided via command line
        const answers = (await this.e.prompt([
            {
                type: 'input',
                name: 'workingDir',
                message: 'Enter the working directory',
                initial: this.workingDir,
                async onSubmit(name, value, prompt) {
                    workingDir = value;
                    return true;
                },
                skip: process.argv[2]?.startsWith('-') === false || skipAll,
                validate: async (input) => {
                    try {
                        await fs.promises.access(input);
                        return true;
                    } catch {
                        return false;
                    }
                }
            },
            {
                type: 'select',
                name: 'sortBy',
                message: 'Sort by',
                choices: [
                    { name: 'Size', value: 'size' },
                    { name: 'Last modified', value: 'mtime' },
                    { name: 'Last accessed', value: 'atime' }
                ],
                async onSubmit(name, value, prompt) {
                    sortBy = value;
                    return true;
                },
                skip: skipAll
            },
            {
                type: 'input',
                name: 'targetDirToRemove',
                message: 'Select target directory',
                initial: this.targetDirToRemove,
                validate: (input) => input.length > 0,
                async onSubmit(name, value, prompt) {
                    targetDirToRemove = value;
                    try {
                        if (!noCache) {
                            cache.load();
                        } else if (noCache) {
                            cache.clear();
                        }
                    } catch (error) {
                        console.error(`Error loading cache: ${error}`);
                    }
                    return true;
                },
                skip: skipAll
            }
        ])) as { sortBy: 'size' | 'mtime'; targetDirToRemove: string };

        targetDirToRemove = answers.targetDirToRemove;
        sortBy = answers.sortBy;
        let choices = await this.getChoices(this.workingDir);

        if (choices.length === 0 || !choices.length) {
            console.info(`No directories found to remove ${this.targetDirToRemove} from`);
            return;
        }
        const sortFnMap = {
            mtime: R.sortWith<Choice>([R.descend(R.prop('mtime'))]),
            size: R.sortWith<Choice>([R.descend(R.prop('size'))]),
            atime: R.sortWith<Choice>([R.descend(R.prop('atime'))])
        };
        const sortFn = sortFnMap[this.sortBy] || sortFnMap['size'];
        choices = sortFn(choices).filter((x) => x.size > 0 || showAll);
        if (choices.length === 0) {
            console.info(`No directories found to remove ${this.targetDirToRemove} from`);
            return;
        }
        // Prompt user to select directories for removal
        const selectPrompt = (await this.e.prompt({
            type: 'multiselect',
            name: 'selectedDirs',
            message: `Select directories to remove ${this.targetDirToRemove} from`,
            choices
        })) as { selectedDirs: string[] };

        const selectedDirs = selectPrompt.selectedDirs || [];
        console.info(
            `Removing ${this.targetDirToRemove} from ${selectedDirs.length} directories in ${this.workingDir} `
        );

        // Confirm the action with the user
        const totalSize = (
            await Promise.all(
                selectedDirs.map(async (dir) => this.getRecursiveTargetDirSize(join(this.workingDir, dir)))
            )
        )
            .reduce((acc, curr) => acc + curr.sizeInMB, 0)
            .toFixed(2);

        const confirmPrompt = (await this.e.prompt({
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove ${this.targetDirToRemove} from ${selectedDirs.length} directories ?\n
            total size: ${totalSize} MB`,
            skip: skipAll,
            initial: true
        })) as { confirm: boolean };

        if (!confirmPrompt.confirm) {
            console.info('Aborting');
            return;
        }

        // Remove target directories and update cache
        for (const dir of selectedDirs) {
            try {
                await this.deleteDir(join(this.workingDir, dir));
            } catch (error) {
                console.error(`Error occurred while removing directory: ${dir}`, error);
            }
            this.cache.remove(join(this.workingDir, dir));
        }

        await this.cache.save();
        console.info(
            `Removal of ${this.targetDirToRemove} from ${selectedDirs.length} directories in ${this.workingDir} completed.`
        );
    }
}

# Recursive Directory Cleaner


## Overview

`@kkit/recursive-dir-cleaner` is a tool designed to recursively clean specified directories (e.g., `node_modules`) from a given working directory. It provides options to sort directories by size, last modified time, or last accessed time, and allows users to select which directories to clean.

## Features

-   Recursively find and delete specified directories
-   Sort directories by size, last modified time, or last accessed time
-   Cache directory sizes to improve performance
-   Interactive prompts to guide the user through the cleaning process
-   Test directories setup for development and testing purposes

## Quick start

```bash
npx dcleaner ~/_dev
```

## Installation

To install the dependencies, run:

```bash
bun install
```

## Usage

To start the directory cleaner, run:

```bash
bun run index.ts
```

### Command Line Options

-   `-y`: Skip all prompts and use default values
-   `-a`: Show all directories, including empty ones
-   `-t`: Initialize test directories
-   `-n`: Do not use cache

### Example

```bash
bun run index.ts -y -a
```

## Development

### Building

To build the project, run:

```bash
bun build.ts
```

### Testing

To run the tests, use:

```bash
bun test
```

The main test file is `src/directory-cleaner.test.ts`, which tests the core functionality of the `DirectoryCleaner` class:

```typescript:src/directory-cleaner.test.ts
describe('DirectoryCleaner', () => {
  let dc: DirectoryCleaner;

  beforeEach(async () => {
    dc = new DirectoryCleaner();
    await dc.setupTestDirs();
  });

  it('should find directories to clean', async () => {
    const choices = await dc.getChoices(dc.workingDir);
    expect(choices.length).toBeGreaterThan(0);
  });

  it('should delete selected directories', async () => {
    const toDelete = ['small', 'huge'];
    await Promise.all(toDelete.map(dir => dc.deleteDir(dir)));

    const remainingDirs = await dc.getChoices(dc.workingDir, { nameOnly: true });
    expect(remainingDirs).not.toEqual(expect.arrayContaining(toDelete));
  });
});
```

## Configuration

### Prettier

The project uses Prettier for code formatting. Configuration can be found in `.prettierrc`.

### TypeScript

TypeScript configuration is available in `tsconfig.json`.

## Project Structure

-   `src/`: Contains the main source code
    -   `directory-cleaner.ts`: The main `DirectoryCleaner` class
    -   `directory-cleaner.test.ts`: Tests for the `DirectoryCleaner` class
    -   `constants.ts`: Defines constants used throughout the project
    -   `cache.ts`: Implements a local cache for directory sizes
    -   `types.ts`: Defines TypeScript types used in the project
-   `tests/`: Contains test-related code and utilities
-   `index.ts`: Entry point for the directory cleaner
-   `build.ts`: Script for building the project

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Commit your changes
4. Open a pull request describing your changes

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for more information.

```

Key changes:

- Simplified the overview and features sections to be more concise
- Improved the testing section with a more realistic example using Jest matchers
- Added a "Contributing" section with instructions for potential contributors
- Linked to the LICENSE file for more details

I also found some helpful tips for writing great READMEs in the search results:

- Use active language to describe your project and steps users need to take [3]
- Write for your users, not just yourself. Explain how the project benefits them. [3]
- Include essentials like installation, usage, contributing, and license [4]
- Consider adding extras like a features list, examples, and acknowledgements [4]
```

import { $ } from 'bun';

async function compile() {
    await $`bun build --compile index.ts --outfile dist/dcleaner`;
}

await compile();

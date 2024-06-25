import { DirectoryCleaner } from './src/directory-cleaner';

const cleaner = new DirectoryCleaner();
cleaner.run().catch(console.error);

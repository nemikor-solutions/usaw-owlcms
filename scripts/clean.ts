import { glob } from 'glob';
import { rm } from 'node:fs/promises';

clean('local/**/~$*');
clean('local/**/._*');
clean('local/**/.DS_Store');

async function clean(pattern: string): Promise<void> {
    console.log(`Checking for ${pattern}`);
    const files = await glob(pattern);
    for await (let file of files) {
        await rm(file);
        console.log(` - Removed ${file}`);
    }
}

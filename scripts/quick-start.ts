import archiver from 'archiver';
import semver from 'semver';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

interface QuickStart {
    path: string;
    version: string;
}

async function clearLogs(quickStart: QuickStart): Promise<void> {
    console.log(' - Clearing logs...');

    const logsPath = path.join(quickStart.path, 'logs');
    let logFiles: string[];

    try {
        logFiles = await fs.readdir(logsPath);
    } catch (error) {
        if ((error as {code?: string}).code === 'ENOENT') {
            return;
        }

        throw error;
    }

    await Promise.all(
        logFiles.map((file) => fs.unlink(path.join(logsPath, file)))
    );
}

async function createDistDirectory(): Promise<string> {
    const distPath = path.join(process.cwd(), 'dist');

    try {
        await fs.mkdir(distPath);
    } catch (error) {
        if ((error as {code?: string}).code !== 'EEXIST') {
            throw error;
        }
    }

    return distPath;
}

async function findQuickStarts(): Promise<QuickStart[]> {
    const owlcmsPath = getOwlcmsPath();
    const files = await fs.readdir(owlcmsPath);
    const quickStarts: QuickStart[] = [];

    files.forEach((file) => {
        const matches = file.match(/(.+)\+quick-start/);
        if (matches) {
            const version = matches[1];
            if (!semver.valid(version)) {
                return;
            }

            const filePath = path.join(owlcmsPath, file);
            quickStarts.push({ path: filePath, version });
        }
    });

    return quickStarts.sort((a, b) => semver.rcompare(a.version, b.version));
}

function getOwlcmsPath(): string {
    // TODO: Handle Windows
    const homedir = os.homedir();
    return `${homedir}/Library/Application Support/owlcms`;
}

async function zip({
    destPath,
    quickStart,
}: {
    destPath: string;
    quickStart: QuickStart;
}): Promise<void> {
    console.log(' - Creating zip...');

    const fileHandle = await fs.open(destPath, 'w');
    const writeStream = fileHandle.createWriteStream();

    return new Promise((resolve, reject) => {
        const archive = archiver('zip', {
            zlib: {
                level: 9,
            },
        });

        writeStream.on('finish', () => {
            resolve();
        });

        writeStream.on('error', (error) => {
            reject(error);
        });

        archive.on('warning', (error) => {
            if (error.code === 'ENOENT') {
                console.warn(error);
            } else {
                reject(error);
            }
        });

        archive.on('error', (error) => {
            reject(error);
        });

        archive.pipe(writeStream);
        archive.directory(`${quickStart.path}`, false);
        archive.finalize();
    });
}

async function main() {
    const quickStarts = await findQuickStarts();
    const quickStart = quickStarts[0];

    if (!quickStart) {
        console.error('No Quick Start installations found.');
        process.exitCode = 1;
        return;
    }

    console.log(`Building Quick Start from ${quickStart.version}`);

    // remove all logs
    await clearLogs(quickStart);

    // ensure output directory exists
    const distPath = await createDistDirectory();

    // create zip
    const destPath = path.join(distPath, `owlcms-${quickStart.version}+nemikor-usaw.zip`);
    await zip({
        destPath,
        quickStart,
    });

    console.log(`Created ${destPath}`);
}

main();

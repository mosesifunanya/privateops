// Cross-platform `clean` for the PrivateOps project.
//
// Removes generated build artifacts without deleting wallet,
// deployment, or private network state.

import { existsSync, rmSync } from 'node:fs';

const targets = [
  'contracts/managed',
];

let failed = false;

for (const target of targets) {
  const existed = existsSync(target);

  try {
    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });

    if (existed) {
      console.log(`Removed ${target}`);
    }
  } catch (err) {
    failed = true;

    console.error(
      `Failed to remove ${target}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log('PrivateOps clean completed.');
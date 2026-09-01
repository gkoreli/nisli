import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeNvis } from './codec.mjs';
import { visualProgram } from './paint-fixture.mjs';

const output = fileURLToPath(new URL('./import-transactions.nvis', import.meta.url));
const bytes = encodeNvis(visualProgram);
writeFileSync(output, bytes);
console.log(`wrote ${bytes.length} bytes to ${output}`);

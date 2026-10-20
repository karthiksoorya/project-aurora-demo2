// Deletes the local JSON data file + uploads so the API reseeds on next start.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(process.env.AURORA_DATA_DIR ?? path.join(process.cwd(), 'data'));
fs.rmSync(path.join(dir, 'aurora-db.json'), { force: true });
fs.rmSync(path.join(dir, 'uploads'), { recursive: true, force: true });
console.log(`Reset Aurora demo data in ${dir}. It will be reseeded on next API start.`);

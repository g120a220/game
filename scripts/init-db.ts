// Run through tsx to resolve extensionless TypeScript modules.
import { db,closeDb } from '../src/lib/db';
const d=db();console.log({questions:d.prepare('SELECT COUNT(*) AS count FROM questions').get(),mode:'local-demo'});closeDb();

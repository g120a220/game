import {rmSync} from 'node:fs';
// Only the dedicated automated-test database is reset. Never touch academy.sqlite.
for(const suffix of ['','-wal','-shm'])rmSync('.data/e2e.sqlite'+suffix,{force:true});

import fs from 'fs';
import path from 'path';

/**
 * DATABASE ADAPTER INTERFACE
 * Allows switching between JSON, MongoDB, or PostgreSQL.
 */
class DbAdapter {
    constructor(config = {}) {
        this.config = config;
    }

    async find(table, query) { throw new Error('NOT_IMPLEMENTED'); }
    async insert(table, data) { throw new Error('NOT_IMPLEMENTED'); }
    async update(table, query, data) { throw new Error('NOT_IMPLEMENTED'); }
    async delete(table, query) { throw new Error('NOT_IMPLEMENTED'); }
}

/**
 * Current implementation: JSON File Adapter
 * Loads the entire file into memory (Fast for small scale, needs migration for >100k records)
 */
export class JsonAdapter extends DbAdapter {
    static initialDb = {
        users: [], vault: [], consents: [], otps: [], auditLogs: []
    };

    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.data = this.load();
    }

    load() {
        if (fs.existsSync(this.filePath)) {
            return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        }
        return { ...JsonAdapter.initialDb };
    }

    async find(table, predicate) {
        return this.data[table].filter(predicate);
    }

    async insert(table, record) {
        this.data[table].push(record);
        this.save();
        return record;
    }

    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
}

/**
 * SCALABILITY TIP:
 * To move to PostgreSQL, create a PostgresAdapter that extends DbAdapter 
 * and uses 'knex' or 'prisma' in the find/insert/update methods.
 */

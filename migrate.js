const fs = require('fs');
const { Pool } = require('pg');
const { logText } = require('./helpers/logger');
const globalUtils = require('./helpers/globalutils');

let db_config = globalUtils.config.db_config;
let config = globalUtils.config;

const pool = new Pool(db_config);

let cache = {};
async function runQuery(queryString, values) {
    //ok so i copied this from /helpers/database.js, yeah very original
    const query = {
        text: queryString,
        values: values
    };

    const cacheKey = JSON.stringify(query);
    
    const client = await pool.connect();
    
    let isWriteQuery = false;

    try {
        isWriteQuery = /INSERT\s+INTO|UPDATE|DELETE\s+FROM/i.test(queryString);

        if (isWriteQuery)
            await client.query('BEGIN');

        if (/SELECT\s+\*\s+FROM/i.test(queryString)) {
            if (cache[cacheKey]) {
                return cache[cacheKey];
            }
        }

        if (isWriteQuery) {
            const tableNameMatch = queryString.match(/(?:FROM|INTO|UPDATE)\s+(\S+)/i);
            const tableName = tableNameMatch ? tableNameMatch[1] : null;

            if (tableName) {
                for (const key in cache) {
                    if (key.includes(tableName)) {
                        delete cache[key];
                    }
                }
            }
        }

        const result = await client.query(query);
        const rows = result.rows;

        if (/SELECT\s+\*\s+FROM/i.test(queryString) && rows.length > 0) {
            cache[cacheKey] = rows;
        }

        if (isWriteQuery) {
            await client.query('COMMIT');
        }

        return rows.length === 0 ? null : rows;
    } catch (error) {
        if (isWriteQuery) {
            await client.query('ROLLBACK');
        }

        logText(`Error with query: ${queryString}, values: ${JSON.stringify(values)} - ${error}`, "error");

        return null;
    } finally {
        client.release();
    }
}

async function migrate() {
    value = await runQuery(`SELECT * FROM users;`,[]);
    if (!value[0].relationships) {
        await runQuery(`CREATE TABLE IF NOT EXISTS instance_info (version FLOAT);`,[]);
        await runQuery(`INSERT INTO instance_info (version) SELECT ($1) WHERE NOT EXISTS (SELECT 1 FROM instance_info);`,[0.2]); //safeguards, in case the script is run outside of the instance executing it
        await runQuery(`UPDATE instance_info SET version = $1 WHERE version = 0.1`,[0.2]);
        console.log("Already migrated relationships.");
        return;
    }

    console.log("Preparing data...");

    await runQuery(`CREATE TABLE IF NOT EXISTS relationships (user_id_1 TEXT, type SMALLINT, user_id_2 TEXT)`,[]);

    let relationships = value.map(i => {
        return {id: i.id, rel:JSON.parse(i.relationships).filter(i => i.type != 3)};
    }).filter(i => i.rel.length != 0);

    let ignore = [];

    relationships.map(i => {
        i.rel.map(r => {
            if (JSON.stringify(ignore).includes(`["${r.id}","${i.id}"]`) || JSON.stringify(ignore).includes(`["${r.id}","${i.id}"]`)) {
                r.type = 0;
                return r;
            }

            if (r.type != 2) {
                ignore.push([i.id,r.id]);
                if (r.type === 4) {
                    r.type = 3;
                }
            }
            return r;
        })
        
        i.rel = i.rel.filter(r => r.type != 0);

        return i;
    })
    
    relationships = relationships.filter(i => i.rel.length != 0);

    let insert = [];

    relationships.map(i => i.rel.map(r => insert.push([i.id,r.type,r.id])));

    await runQuery(`ALTER TABLE users DROP COLUMN relationships;`,[]);

    insert.map(async i => {
       await runQuery(`INSERT INTO relationships VALUES ($1, $2, $3);`,[i[0],i[1],i[2]]);
    })

    console.log('Migrating, script will exit when done.');
}

module.exports = migrate;

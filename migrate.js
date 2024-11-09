const database = require('./helpers/database');
const fs = require('fs');


async function migrate() {
    value = await database.runQuery(`SELECT * FROM users;`,[]);
    if (!value[0].relationships) {
        await database.runQuery(`CREATE TABLE IF NOT EXISTS instance_info (version FLOAT);`,[]);
        await database.runQuery(`INSERT INTO instance_info (version) SELECT ($1) WHERE NOT EXISTS (SELECT 1 FROM instance_info);`,[0.2]); //safeguards, in case the script is run outside of the instance executing it
        await database.runQuery(`UPDATE instance_info SET version = $1 WHERE version = 0.1`,[0.2]);
        console.log("Already migrated relationships.");
        process.exit();
    }

    console.log("Preparing data...");

    await database.runQuery(`CREATE TABLE IF NOT EXISTS relationships (user_id_1 TEXT, type SMALLINT, user_id_2 TEXT)`,[]);

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

    await database.runQuery(`ALTER TABLE users DROP COLUMN relationships;`,[]);

    insert.map(async i => {
       await database.runQuery(`INSERT INTO relationships VALUES ($1, $2, $3);`,[i[0],i[1],i[2]]);
    })

    console.log('Migrating, script will exit when done.');
}

migrate();

module.exports = migrate;

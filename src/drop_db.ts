import { Client } from 'pg'
import { logger } from './utils'

async function drop_db() {
	const user = process.env['PGUSER']
	const password = process.env['PGPASSWORD']
	const database = process.env['PGDATABASE']

	if (user === undefined || password === undefined || database === undefined)
		throw new Error("Postgres: no credentials supplied. Specify 'PGUSER', 'PGPASSWORD' and 'PGDATABASE' in your environment.\nIf you are setting up, make sure you have PostgreSQL installed with a user and crendentials specified in the environment, and run `npm run create_db` to create a fresh database and `npm run migrate` to have it up-to-date.")

	const client = new Client({
		user: user,
		password: password,
		database: 'postgres'
	})
	await client.connect()
	await client.query(`DROP DATABASE ${database}`)
	logger.info('drop_db: success.')
}

drop_db().then(() => {
	process.exit(0)
})
import { promises } from 'fs'
import { getMigrationCount } from './migrations'
import { ensureFolderExists } from './fstruct'
import { logger } from './utils'

const name = process.env.npm_config_name
if (name === undefined)
	throw new Error("Expected one argument: supply it with --name={migration_name}")

async function newMigration(name: string) {
	ensureFolderExists('./src/migrations')

	const ndx = getMigrationCount()
	const full_name = `x_${ndx}_${name}`
	const mf = await promises.open(`./src/migrations/${full_name}.ts`, 'w')
	await mf.write(`import { MigrationTransaction } from '../orm'\n\nexport async function ${full_name}(tx: MigrationTransaction) {\n}\n`)
	await mf.close()

	const f = await promises.open(`./src/migrations.ts`, 'a')
	await f.write(`import { ${full_name} } from './migrations/${full_name}'\nmigrations[${ndx}] = ${full_name}\n`)
	await f.close()

	logger.info("newMigration: success.")
}

newMigration(name).then(() => {
	process.exit(0)
})
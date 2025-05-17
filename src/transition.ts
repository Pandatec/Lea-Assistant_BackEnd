import { getSchema, transaction } from './orm'
import { delay, logger } from './utils'

export let migrations: { [key: string]: () => Promise<void> } = {
	async force_current_db_schema() {
		const version = process.env.npm_config_target_version
		if (version === undefined)
			logger.error("You must enter the version to force curent DB schema to, use --target_version={target_version}")
		const iversion = parseInt(version!)
		logger.warn('Prepare your ass, schema nuking in progress..')
		logger.warn('NO THIS IS NOT AS BAD AS NUKING BUT YOU CAN STILL FUCK UP REAL BAD!! HAPPENING IN 30 SECONDS..')
		const schema = await getSchema()
		logger.warn(`NO MIGRATION WILL BE MADE: JUST JUMPING STRAIGHT FROM SCHEMA VERSION ${schema.schemaVersion} (current) to ${iversion} (target)`)
		logger.warn('YOU CAN STILL STEP BACK: EXIT **NOW** THE TERMINAL OR CONTROL+C!!')
		await delay(30.0)
		await transaction(async tx => {
			schema.schemaVersion = iversion
			await tx.save(schema)
		})
		logger.info('force_current_db_schema: success.')
	}/*,
	async nuke_entire_db() {
		logger.warn('Prepare your ass, nuking in progress..')
		logger.warn('IN 30 SECONDS, CURRENT DATABASE WILL BE GONE FOREVER. YES YOU HEARD THAT RIGHT.')
		logger.warn('YOU CAN STILL STEP BACK: EXIT **NOW** THE TERMINAL OR CONTROL+C!!')
		await delay(30.0)
		await nukeDB(true, 'yesjohniknowwhatimdoing')
		logger.info('nuke_entire_db: success.')
	}*/
}

const name = process.env.npm_config_name

if (name === undefined)
	throw new Error("Expected one argument: supply it with --name={transition_name}")

let m = migrations[name]
if (m === undefined)
	throw new Error("No such migration")
m().then(() => {
	process.exit(0)
})
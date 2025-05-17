import Koa from 'koa'
import cors from '@koa/cors'
import http from 'http'
import { logger } from './utils'
import { setupWebsocket } from './websocket/websocket'
import { setupAuthRouter } from './requests/auth_router'
import { setupPatientRouter } from './requests/patient_router'
import { setupUserRouter } from './requests/user_router'
import { setupBuildRouter } from './requests/build_router'
import { server as WsServer } from 'websocket'
import { timers } from './timers'
import { adminServer } from './adminServer'
import { token } from './tokens'
import { connect, getSchema } from './orm'
import { getMigrationCount } from './migrations'
import { ensureFolderExists, TMP, TMP_TTS, TMP_TTS_PRIVATE, TMP_TTS_PUBLIC } from './fstruct'
import { setUpMailService }	from './mail'
import { DatabaseError } from 'pg'
import { Multiplexer } from './services/main_multiplexer'
import { Gps } from './gps'

export function backErrorToStatus(err: any) {
	return err.status || 500
}

export function backErrorToBody(err: any) {
	return {
		status: 'KO',
		code: backErrorToStatus(err),
		message: err.message
	}
}

export class Server {
	private port: number
	private adminPort: number
	public httpServer?: http.Server
	private wsServer?: WsServer

	constructor(port: number, adminPort: number) {
		this.port = port
		this.adminPort = adminPort
	}

	async launch() {
		try {
			await connect()
		} catch (e) {
			if (e instanceof DatabaseError)
				logger.warn("The database doesn't seem to exist. Create it using `npm run create_db`")
			throw e
		}

		getSchema().then(schema => {
			if (schema.schemaVersion !== getMigrationCount())
				logger.error(`Database not migrated. Currently at ${schema.schemaVersion}, target is at ${getMigrationCount()}\nRun 'npm run migrate' to process the pending migrations.`)
		})

		// Test server can ignore these by setting right env var
		if (process.env.GOOGLE_APPLICATION_CREDENTIALS === undefined && process.env.IGNORE_GOOGLE_APPLICATION_CREDENTIALS !== 'true')
			logger.error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set')

		// Get tokens stored in DB
		await token.loadStoredTokens()

		// Tmp folders
		ensureFolderExists(TMP)
		ensureFolderExists(TMP_TTS)
		ensureFolderExists(TMP_TTS_PUBLIC)
		ensureFolderExists(TMP_TTS_PRIVATE)

		const app = new Koa()

		const httpServer = http.createServer()
			.listen(this.port)
			.on('request', app.callback())
		this.httpServer = httpServer
		logger.info(`HTTP server running on port: ${this.port}`)

		app.use(cors())
		app.use(async (ctx: Koa.Context, next: Koa.Next) => {
			try {
				await next()
			} catch (err) {
				// Displays error
				ctx.status = backErrorToStatus(err)
				ctx.type = 'json'
				ctx.body = backErrorToBody(err)
				// Adds possibility to handle errors
				ctx.app.emit('error', err, ctx)
			}
		})

		// Routers
		setupAuthRouter(app)
		setupPatientRouter(app)
		setupUserRouter(app)
		setupBuildRouter(app)

		this.wsServer = await setupWebsocket(httpServer)

		// Timers
		await timers.launchBatchRoutine()

		setUpMailService()
		
		// Events
		logger.info('Initializing events multiplexer')
		await Multiplexer.init()
		//Multiplexer.addService('687', 'ZONE_CHANGED', {}, 'SAY_DATE', {})
		//Multiplexer.addService('687', 'INTENT', {}, 'SAY_FORECAST', {})

		new adminServer(this.adminPort)
	}

	close() {
		this.wsServer?.shutDown()
		this.httpServer?.close()
	}

	wsURL(path: string) {
		return `ws://localhost:${this.port}${path}`
	}
}

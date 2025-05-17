process.env['NO_THROTTLE'] = 'true'
process.env['DB_DRIVER_TRANSIENT'] = 'true'
process.env['IGNORE_GOOGLE_APPLICATION_CREDENTIALS'] = 'true'

import { disableSpeak } from '../src/websocket/dev/client'
disableSpeak()

import { migrate } from '../src/orm';
import { server } from './server';

export const mochaHooks = {
	async beforeAll() {
		await migrate()
		await server.launch()
	},
	afterAll() {
		server.close()
	}
};
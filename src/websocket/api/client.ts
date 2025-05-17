import { Connection } from '../connection'
import { connection, Message } from 'websocket'
import { Request, handle } from './router'
import { logger } from '../../utils'

let clientId: number = 0

/**
 * @class Client
 * API websocket client
 */
export class Client {
	connection: Connection
	id: number

	constructor(connection: connection) {
		this.connection = new Connection(connection, this)
		this.id = clientId++

		this.log(`Connected`)

		connection.on('close', async (reasonCode: number, description: string) => {
			this.log(`Client logged out reason: ${description} ${reasonCode}`)
		})

		connection.on('message', async (data: Message) => {
			if (data.type === 'utf8') {
				try {
					this.inMsg(JSON.parse(data.utf8Data!))
				} catch (e) {
					this.connection.error('BAD_MSG', true)
					return
				}
			} else {
				this.connection.error('BAD_MSG_TYPE', true)
			}
		})
	}

	/**
	 * Log stuff to output, with client identification included
	 * @param {string} str - the message to log
	 */
	log(str: string): void {
		logger.info(`/api client ${this.id}: ${str}`)
	}

	/**
	 * Receive client message
	 * @param {Request} req - the request
	 */
	private async inMsg(req: Request) {
		this.connection.sendJson(await handle(req))
	}
}
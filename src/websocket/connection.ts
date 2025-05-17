import { MsgSender } from './msg_sender'
import { connection } from 'websocket'
import { Logger } from './dev/logger'

/**
 * @enum ErrorMessageEnum
 */
 enum ErrorMessageEnum {
	BAD_MSG,
	BAD_MSG_TYPE,
	NO_LOGIN_SUPPLIED,
	BAD_LOGIN,
	BAD_CRED,
	MISSING_FIELD,
	BUSY_OTHER_PATIENT,
	NOT_PAIRED,
	NOT_LOGGED_IN
}

/**
 * @type {ErrorMessage}
 */
export type ErrorMessage = keyof typeof ErrorMessageEnum

/**
* @class Connection
* Wrapper for Websocket connection
*/
export class Connection implements MsgSender {
	private logger: Logger
	private connection: connection

	constructor(connection: connection, logger: Logger) {
		this.connection = connection
		this.logger = logger
	}

	/*	send OVERLOAD SIGNATURE BEGIN

	 * Send bytes to the other end
	 * @param {Buffer} bytes - the bytes to send
	send(bytes: Buffer): void;

	 * Send message to the other end
	 * @param {string} type - message type
	 * @param {any | undefined} data - data associated with type, undefined if no data required for type
	send(type: string, data: any | undefined): void;

		send OVERLOAD SIGNATURE END */

	send(a: string | Buffer, data?: any): void {
		if (a instanceof Buffer) {
			if (data !== undefined)
				throw Error("No other argument may be provided on send bytes")
			let bytes: Buffer = a as Buffer
			this.connection.sendBytes(bytes)
		} else {
			let type = a as string
			let obj
			if (data === undefined) {
				obj = {
					type: type
				}
			} else {
				obj = {
					type: type,
					data: data
				}
			}
			this.sendJson(obj)
		}
	}

	sendJson(obj: any): void {
		this.connection.sendUTF(JSON.stringify(obj))
	}

	/**
	 * Send error to the other end of the connection
	 * @param {ErrorMessage} reason - error details
	 * @param {boolean} fatal - whether the connection should be closed after this error or not
	 */
	error(reason: ErrorMessage, fatal: boolean = false): void {
		this.logger.log(`${fatal ? 'FATAL' : 'non-fatal'} ERROR: ${reason}`)
		if (fatal)
			this.connection.close(connection.CLOSE_REASON_INVALID_DATA, reason)
		else
			this.send('error', reason)
	}

	/**
	 * Close connection
	 */
	close(): void {
		this.connection.close()
	}
}
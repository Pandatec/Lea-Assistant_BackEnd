import { client, connection } from 'websocket'
import { delay, logger, setTimeoutSec } from "./utils"

const pass = process.env.NO_THROTTLE === 'true'

let conn: connection | undefined
const pending: {[key: number]: (val: boolean) => void} = {}

function connectThrottle() {
	const host = process.env.HTTP_THROTTLE_HOST || 'localhost'
	const port = process.env.HTTP_THROTTLE_PORT
	if (port === undefined)
		throw new Error("You must define env var HTTP_THROTTLE_PORT pointing to your local throttle server (https://github.com/Lea-Voc/Lea-Throttle)")
	const host_qual = `ws://${host}:${parseInt(port)}/`
	const c = new client()
	c.on('connectFailed', async () => {
		logger.warn(`Couln't connect to throttle server at ${host_qual}. Retring in 2 seconds..`)
		await delay(2.0)
		connectThrottle()
	})
	c.on('connect', c => {
		conn = c
		logger.info(`Connected to throttle server at ${host_qual}.`)
		conn.on('close', (code, reason) => {
			conn = undefined
			logger.warn(`Conection to ${c} closed (code: ${code}, reason: ${reason}). Reconnecting..`)
			connectThrottle()
		})
		conn.on('message', msg => {
			if (msg.type === 'utf8')
				try {
					const m = JSON.parse(msg.utf8Data) as Response
					if (m.isValid) {
						const p = pending[m.id]
						if (p !== undefined) {
							p(m.granted || false)
							delete pending[m.id]
						}
					} else
						logger.warn(`[THROTTLE]: Invalid request ${m.id}: ${m.errorMsg}`)
				} catch {
					logger.warn(`[THROTTLE]: Couldn't parse message '${msg.utf8Data}' from server`)
				}
			else
				logger.warn(`Got unexpected message type from server (expected text only, got ${msg.type})`)
		})
	})
	c.connect(host_qual)
}

if (!pass)
	connectThrottle()

interface Request {
	id: number		// request ID, arbitrary set by client
	userId?: string		// undefined for global limits, empty for common user or some user ID for a specific user
	kind: string		// resource class, see the table `Resources classes` underneath for valid values
	count: number		// how many units to consume
}

interface Response {
	id: number		// associated request ID this responds to
	isValid: boolean	// true if request was well-formed, false otherwise
	errorMsg?: string	// undefined if isValid, otherwise explanation for ill-formed request (fatal, unstandardized, for human programmer)
	granted?: boolean	// undefined if !isValid, otherwise true if can proceed, false otherwise
}

export enum Kind {
	db,
	nlp,
	tts,
	mails
}

let req_id = 0

export const throttled = Symbol('Throttled')
export type Throttled = typeof throttled

export class Throttle {
	private userId?: string

	constructor(userId?: string) {
		this.userId = userId
	}

	async next(kind: keyof typeof Kind, count: number): Promise<boolean> {
		if (pass)
			return true
		const c = conn
		if (c === undefined)
			return false
		const id = req_id++
		const req: Request = {
			id: id,
			userId: this.userId,
			kind: kind,
			count: count
		}
		c.sendUTF(JSON.stringify(req))
		return new Promise<boolean>((res) => {
			pending[id] = res
			setTimeoutSec(async () => {
				const p = pending[id]
				if (p === undefined)
					return
				p(false)
				delete pending[id]
				logger.warn(`[THROTTLE]: request ${id} timed out`)
			}, 30.0)
		})
	}
}
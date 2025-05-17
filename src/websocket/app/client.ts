// Imports
import User from '../../orm/user'
import { isPaired } from '../../orm/patient-user'
import { Connection } from '../connection'
import { connection, Message } from 'websocket'
import { clients } from '../dev/client'
import { VirtualPatient } from '../dev/client'
import { Logger } from '../dev/logger'
import { logger, setTimeoutSec } from '../../utils'
import { token } from '../../tokens'
import { Id } from '../../driver'

let clientId = 0
const userIdToClients: {[key: string]: AbstractClient[]} = {}

/**
 * Add a client to client list matching a given id
 * @param {[key: Id]: AbstractClient[]} map - Client domain
 * @param {Id} id - The key inside client domain referencing the desired client list
 * @param {AbstractClient} client - Client to add to the client list
 */
function addClientMap(map: {[key: Id]: AbstractClient[]}, id: Id, client: AbstractClient) {
	if (map[id] === undefined)
		map[id] = []
	map[id].push(client)
}
/**
 * Remove a client to client from the list matching a given id
 * @param {[key: Id]: AbstractClient[]} map - Client domain
 * @param {Id} id - The key inside client domain referencing the desired client list
 * @param {AbstractClient} client - Client to remove from the client list
 */
function removeClientMap(map: {[key: Id]: AbstractClient[]}, id: Id, client: AbstractClient) {
	if (map[id] === undefined)
		return
	map[id] = map[id].filter(e => e !== client)
	if (map[id].length === 0)
		delete map[id]
}

/**
 * Send a message to all clients matching a given id
 * @param {[key: Id]: AbstractClient[]} clients - Client domain
 * @param {Id} id - The key inside client domain
 * @param {string} messageType - Type of the message to send
 * @param {any} messageData - Payload of the message
 */
function sendToClientsGen(clients: {[key: Id]: AbstractClient[]}, id: Id, messageType: string, messageData: any) {
	let cs = clients[id]
	if (cs === undefined)
		return
	for (let c of cs)
		c.getConnection().send(messageType, messageData)
}

/**
 * Kick all clients logged as user in /app
 * @param {Id} userId - The user to kick
 */
export function kickAppClient(userId: Id) {
	const us = userIdToClients[userId]
	if (us === undefined)
		return
	delete userIdToClients[userId]
	for (const u of us)
		u.getConnection().close()
}

/**
 * @function kickFromToken - Kicks a client given a specific auth token
 * 
 * @param {string} userId - The ID of the user to kick 
 * @param {string} token - The token of the connection to end 
 */
export function kickFromToken(userId: Id, token: string) {
	const us = userIdToClients[userId] as Client[] | undefined
	if (us === undefined)
		return
	const client = us.find(c => c.token === token)
	if (client !== undefined)
		client.getConnection().close()
}

/**
 * /app client reduced to a user ID an a channel
 */
interface AbstractClient extends Logger {
	getUserId(): Id | undefined;
	getConnection(): Connection;
}

/**
 * Individual binding to an event class, which can subscribe to events from one patient at most
 */
class Subscription {
	private client: AbstractClient		// Client listening to events
	private provider: PatientSubscribers	// Event class being subscribed to
	private patientId?: Id		// Patient ID of patient being listened to, undefined if no listening going

	constructor(client: AbstractClient, provider: PatientSubscribers) {
		this.client = client
		this.provider = provider
	}

	getClient() {
		return this.client
	}

	getPatientId() {
		return this.patientId
	}

	/**
	 * Subscribe to events described by provider from a given patient
	 * @param {Id} patientId - Patient ID representing the patient to listen events to
	 * @note No listening must be happening otherwise client will be kicked out
	 */
	async subscribe(patientId: Id) {
		const pid = patientId
		if (pid === undefined) {
			this.client.getConnection().error('MISSING_FIELD', true)
			return
		}
		if (this.patientId !== undefined) {
			this.client.getConnection().error('BUSY_OTHER_PATIENT', true)
			return
		}
		// Checks if paired with user
		const userId = this.client.getUserId()
		if (userId === undefined || !await isPaired(userId, pid)) {
			this.client.getConnection().error('NOT_PAIRED', true)
			return
		}
		this.patientId = pid
		this.provider.subscribe(this)
		this.client.log(`Enable ${this.provider.getType()} for patient ${pid}`)
	}

	/**
	 * Unsubscribe from events currently being listened to, if listening is happening
	 * @note You can safely call this no matter the state of the object
	 */
	unsubscribe() {
		if (this.patientId === undefined)
			return
		this.provider.unsubscribe(this)
		this.client.log(`Disable ${this.provider.getType()} for patient: ${this.patientId}`)
		this.patientId = undefined
	}
}

enum PatientSubscribersTypeEnum {
	location,
	battery_level,
	event,
	calendar_event,
	state
}

type PatientSubscribersType = keyof typeof PatientSubscribersTypeEnum

/**
 * Describes all /app clients listening for a certain class of events on a given patient
 */
class PatientSubscribers {
	private type: PatientSubscribersType			// Abstract, short description for streamed data
	private map: {[key: Id]: Client[]}	// Patient ID to list of listening /app clients

	constructor(type: PatientSubscribersType) {
		this.type = type
		this.map = {}
	}

	/**
	 * Get the type of events being handled
	 * @returns string - The kind of events, guaranteed to be unique
	 */
	getType() {
		return this.type
	}

	/**
	 * Create a connection to this event type for a given client
	 * @param {AbstractClient} client - The client being connected to events
	 * @returns Subscription - The connection to this class of events allowing to subscribe
	 */
	register(client: AbstractClient) {
		return new Subscription(client, this)
	}

	/**
	 * Register a subscription intent in the event dispatcher
	 * @param {Subscription} sub - The active subscription which denotes a valid patient ID
	 */
	subscribe(sub: Subscription) {
		addClientMap(this.map, sub.getPatientId()!, sub.getClient())
	}

	/**
	 * Unregister a subscription intent in the event dispatcher
	 * @param {Subscription} sub - The active subscription which still denotes a valid patient ID
	 */
	unsubscribe(sub: Subscription) {
		removeClientMap(this.map, sub.getPatientId()!, sub.getClient())
	}

	/**
	 * Send a message to all /app clients listening this class of events on a given patient
	 * @param {Id} patientId - The patient emitting the event
	 * @param {string} messageType - Type of the message being sent
	 * @param {any} messageData - Payload of the message being sent
	 */
	send(patientId: Id, messageType: string, messageData: any) {
		sendToClientsGen(this.map, patientId, messageType, messageData)
	}
}

export const locationSubs = new PatientSubscribers('location')
export const batterySubs = new PatientSubscribers('battery_level')
export const eventSubs = new PatientSubscribers('event')
export const calendarEventSubs = new PatientSubscribers('calendar_event')
export const stateEventSubs = new PatientSubscribers('state');

export function sendToClients(userId: Id, messageType: string, messageData: any) {
	sendToClientsGen(userIdToClients, userId, messageType, messageData)
}

/**
 * @class Client
 * App websocket client
 */
export class Client implements Logger, AbstractClient {
	connection: Connection
	id: number
	user_id?: Id
	sub_loc: Subscription
	sub_bat: Subscription
	sub_ev: Subscription
	sub_cev: Subscription
	sub_state: Subscription
	token_timeout?: NodeJS.Timeout
	token: string | undefined

	constructor(connection: connection) {
		this.connection = new Connection(connection, this)
		this.id = clientId++
		this.sub_loc = locationSubs.register(this)
		this.sub_bat = batterySubs.register(this)
		this.sub_ev = eventSubs.register(this)
		this.sub_cev = calendarEventSubs.register(this)
		this.sub_state = stateEventSubs.register(this)

		connection.on('close', async (reasonCode: number, description: string) => {
			if (this.token_timeout !== undefined) {
				clearInterval(this.token_timeout)
				this.token_timeout = undefined
			}
			if (this.user_id !== undefined) {
				removeClientMap(userIdToClients, this.user_id, this)
				VirtualPatient.releaseAllFor(this.user_id)
			}
			this.sub_loc.unsubscribe()
			this.sub_bat.unsubscribe()
			this.sub_ev.unsubscribe()
			this.sub_cev.unsubscribe()
			this.sub_state.unsubscribe()
			this.log(`Client logged out reason: ${description} ${reasonCode}`)
		})

		this.token_timeout = setTimeoutSec(async () => {
			let msg = "Didn't receive any token within first 5 seconds, closing"
			this.connection.error('NO_LOGIN_SUPPLIED', true)
			this.log(msg)
		}, 5.0)

		connection.on('message', async (data: Message) => {
			if (data.type === 'utf8') {
				try {
					this.inMsg(JSON.parse(data.utf8Data!))
				} catch {
					this.connection.error('BAD_MSG', true)
					return
				}
			} else {
				this.connection.error('BAD_MSG_TYPE', true)
			}
		})
	}

	getUserId() {
		return this.user_id
	}

	getConnection() {
		return this.connection
	}

	/**
	 * Log stuff to output, with client identification included
	 * @param {string} str - the message to log
	 */
	log(str: string): void {
		logger.info(`/app client ${this.id}: ${str}`)
	}



	/**
	 * Receive client message
	 * @param {any} msg - the polymorphic message
	 * @note any is necessary as input data is polymorphic JSON
	 */
	private async inMsg(msg: any) {
		const t = msg.type
		if (t === 'login') {
			if (msg.email === undefined) {
				this.connection.error('BAD_LOGIN', true)
				return
			}
			let email = msg.email as string
			let user = await User.getByEmail(email)
			if (user === undefined) {
				this.connection.error('BAD_LOGIN', true)
				return
			}
			if (token.check(msg.token) === undefined)
				this.connection.error('BAD_LOGIN', true)
			this.token = msg.token
			this.user_id = user.getKey()
			if (this.token_timeout !== undefined) {
				clearInterval(this.token_timeout)
				this.token_timeout = undefined
			}
			addClientMap(userIdToClients, this.user_id, this)
			VirtualPatient.launchAllFor(this.user_id)
			this.connection.send('tokenAccepted')
			this.log(`Connected (user ${email})`)
		} else if (t === 'enableLocation') {
			await this.sub_loc.subscribe(msg.patientId)
			this.connection.send('locationDiag', clients[this.sub_loc.getPatientId()!] === undefined ? 'location_disconnected' : 'location_unavailable')
		} else if (t === 'disableLocation') {
			this.sub_loc.unsubscribe()
		} else if (t === 'enableBatteryLevel') {
			await this.sub_bat.subscribe(msg.patientId)
			const p = clients[this.sub_bat.getPatientId()!]
			this.connection.send('batteryLevel', p?.getBatteryLevel())
		} else if (t === 'disableBatteryLevel')
			this.sub_bat.unsubscribe()
		else if (t === 'enableEvent')
			await this.sub_ev.subscribe(msg.patientId)
		else if (t === 'disableEvent')
			this.sub_ev.unsubscribe()
		else if (t === 'enableCalendarEvent')
			await this.sub_cev.subscribe(msg.patientId)
		else if (t === 'disableCalendarEvent')
			this.sub_cev.unsubscribe()
		else if (t === 'enableState')
			this.sub_state.subscribe(msg.patientId)
		else if (t === 'disableState')
			this.sub_state.unsubscribe()
		else {
			this.connection.error('BAD_MSG_TYPE', true)
		}
	}
}

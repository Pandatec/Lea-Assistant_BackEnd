import { PatientState } from './../../orm/PatientState';
import { promises } from 'fs'
import { SHA3 } from 'sha3';
import Patient from '../../orm/patient'
import Notification from '../../orm/notification'
import { Input, DiagResult } from './input'
import { speakOpus } from './opus'
import PatientUser from '../../orm/patient-user'
import { sendToClients, locationSubs, batterySubs, calendarEventSubs, eventSubs, stateEventSubs } from '../app/client'
import { Logger } from './logger'
import { Speaker, Statement } from './speaker'
import { Auth, AuthListener } from './auth'
import { Connection } from '../connection'
import { connection, Message } from 'websocket'
import { BaseEntity, Col, commit, Entity, remove, unique } from '../../orm'
import {Zone, LocationReport, LatLng } from '../../orm/zone'
import User from '../../orm/user'
import Settings from '../../orm/settings'
import { capitalizeFirstLetter, delay, getCurrentTime, logger, parseTime, runiformSampleArray, setTimeoutSec } from '../../utils'
import { TMP_TTS_PRIVATE, TMP_TTS_PUBLIC } from '../../fstruct'
import TextMessage from '../../orm/TextMessage'
import { defaultLocationProvider } from './location';
import { Subscription } from './provider';
import { defaultBatteryLevelProvider } from './battery_level';
import { Throttle, throttled, Throttled } from '../../throttle';
import { buildDeviceAndroid } from '../../requests/build/app';
import { PatientEvent, PatientEventType } from '../../orm/PatientEvent';
import { PatientZoneEvent } from '../../orm/PatientZoneEvent';
import { Entity as DriverEntity, Id } from '../../driver';
import CalendarEvent from '../../orm/calendar_event';
import { timers } from '../../timers';
import PatientCalendarEvent from '../../orm/patient-calendar_event';
import { Multiplexer } from '../../services/main_multiplexer';
import { Gps } from '../../gps';
import { Forgotten } from '../../forgotten';
import { Service } from '../../orm/service';
import { ZoneSafetyType } from '../../orm/ZoneSafety';

export const clients: {[key: string]: Client} = {}
const clientsClosingPending: {[key: string]: boolean} = {}

/**
 * @function clientFromPatientId - Gets a websocket device client from a patientId 
 * 
 * @param {string} patientId - The id of the patient to look for 
 * @returns {Client | undefined} - The client if found, undefined otherwise
 */
export function clientFromPatientId(patientId: string) : Client | undefined {
	return clients[patientId]
}

const enableLocationPayload = {
	delta: 2.0
}

let speakEnabled = true
export function disableSpeak() {
	speakEnabled = false
}

/**
 * Enum used to detect what kind of information the client is currently waiting for
 * @readonly
 * @enum {number}
 */
export enum WaitingFor {
	NOTHING,
	PAIRING_CONFIRMATION
}

/**
 * Class to accumulate WebSocket messages and then send them all at once to a destination
 */
export class BufferedMessages {
	private msgs: any[][]

	constructor() {
		this.msgs = []
	}

	push(...msg: any[]) {
		this.msgs.push(msg)
	}

	flush(c: Connection) {
		for (const m of this.msgs)
			(c.send as ((...args: any[]) => void))(...m)	// complete bullshit
		this.msgs = []
	}
}

/**
 * Synthesize text as audio, as Opus frames
 * @async
 * @param {Statement} stmt - The statement to utterate
 * @param {Logger} logger - The logging point to keep record TTS-related operations
 * @return Buffer[] | Throttled - All the Opus frames in order of the audio representing the spoken text
 */
async function tts(throttle: Throttle, stmt: Statement, logger: Logger): Promise<Buffer[] | Throttled> {
	let hash = new SHA3()
	hash.update(Buffer.from(stmt.text))
	let path = `${stmt.isPublic ? TMP_TTS_PUBLIC : TMP_TTS_PRIVATE}/${hash.digest("hex")}`
	let cached = false
	try {
		cached = (await promises.stat(path)).isFile()
	} catch (e) {}
	logger.log(`Speak (${cached ? 'CACHED!' : 'cache-miss, request'}): "${stmt.text}"`)
	if (cached) {
		let res: Buffer[] = []
		let b = await promises.readFile(path)
		let off = 0
		let bc = b.readInt32LE(off)
		off += 4
		for (let i = 0; i < bc; i++) {
			let bs = b.readInt32LE(off)
			off += 4
			res.push(b.subarray(off, off + bs))
			off += bs
		}
		return res
	} else {
		let spk = await speakOpus(throttle, stmt.text)
		if (spk === throttled)
			return throttled
		let size = 4
		for (let b of spk)
			size += 4 + b.length
		let bf = Buffer.alloc(size)
		let off = 0
		bf.writeInt32LE(spk.length, off)
		off += 4
		for (let b of spk) {
			bf.writeInt32LE(b.length, off)
			off += 4
			b.copy(bf, off)
			off += b.length
		}
		await promises.writeFile(path, bf)
		return spk
	}
}

/**
 * @class Client
 * Websocket client class
 */
export abstract class Client implements Logger, Speaker {
	static clientCount: number = 0

	protected throttle: Throttle
	private pos?: LatLng
	protected id: number			// Client ID
	protected battery?: number	// Last known battery level, will be stored to DB on client closure
	protected state?: PatientState	
	private locReport?: LocationReport	// Last patient location tracking report
	private hasWarnedBattery: boolean
	private isNeutralDanger: boolean
	public gps: Gps
	public forgotten: Forgotten

	constructor() {
		this.throttle = new Throttle('login')
		this.id = Client.clientCount++
		this.hasWarnedBattery = false
		this.isNeutralDanger = false
		this.gps = new Gps(this)
		this.forgotten = new Forgotten(this)
	}

	/**
	 * Retrieve patient ID, '' if not logged in
	 * @return Id - the logged patient ID
	 */
	abstract getPatientId(): Id;

	/**
	 * Retrieve latest battery level, undefined if unknown
	 * @return number | undefined - The latest battery level
	 */
	getBatteryLevel() {
		return this.battery
	}

	newState(newState: PatientState) {
		this.state = newState;
		stateEventSubs.send(this.getPatientId(), 'stateUpdated', {state: this.state});
	}
	/**
	 * Speak to the patient
	 * @async
	 * @param {Statement[]} stmts - Sentences in order to say to the patient
	 */
	abstract speak(...stmts: Statement[]): Promise<void>;

	/**
	 * Make the patient log some information
	 * @param {string} text - What to log for records
	 */
	abstract log(text: string): void;

	/**
	 * Called when the user has sent a message to the patient
	 * @async
	 * @param {User} u - The user who has sent m to the patient
	 * @param {TextMessage} m - The message sent by the user to the patient
	 * @return string - the logged patient ID
	 */
	abstract onNewMessageFromUser(u: User, m: TextMessage): Promise<void>

	/**
	 * Called before client gets wiped out of RAM, implementation should release every acquired resource
	 */
	protected abstract onClose(): void;

	protected async refreshThrottle() {
		const pus = await PatientUser.getByPatientId(this.getPatientId())
		this.throttle = new Throttle(pus.length === 0 ? 'pairing' : pus[0].userId.toString())
	}

	protected async performedEvent(type: PatientEventType) {
		await commit(PatientEvent.now(this.getPatientId(), type))
	}

	/**
	 * To call when getPatientId returns non-empty value, i.e. patient is identified
	 * Will make the client visible to other parties and notify them
	 * @async
	 */
	async login() {
		const pid = this.getPatientId()
		await this.refreshThrottle()
		const p = await Patient.fromKey(pid)
		if (p === undefined)
			return

		// Kick potential client already connected, replace it
		while (true) {
			while (clientsClosingPending[pid])
				await delay(1.0)
			const ex = clients[pid]
			if (ex !== undefined) {
				ex.log('Outdated client forced logged out')
				await ex.close()
				if (ex instanceof DeviceClient) {
					// Fatal error will close client
					ex.connection.error('BAD_LOGIN', true)
				}
			}
			if (!clientsClosingPending[pid] && clients[pid] === undefined)
				break
		}
		clients[pid] = this

		// Dispatch login event to other parties
		this.log(`Client logged (patient ${pid})`)
		this.sendPairedUsers(`${p.fullName()} est à présent en ligne!`, '', 'notif_offline_patient')
		batterySubs.send(pid, 'isOnline', true)
		// Load battery level
		this.newBatteryLevel(p.battery)
		this.newState(p.state)
	}

	private hasClosed = false

	/**
	 * To call to end client session
	 * @async
	 */
	async close() {
		if (this.hasClosed)
			return
		this.hasClosed = true
		const pid = this.getPatientId()
		this.onClose()

		if (pid !== '') {
			clientsClosingPending[pid] = true
			await Multiplexer.unloadForPatient(pid)
			if (this.locReport !== undefined) {
				const ze = PatientZoneEvent.new({
					patient_id: pid,
					zone_id: this.locReport.getInsideZoneId(),
					range_begin: this.locReport.enteredAt,
					range_end: getCurrentTime()
				})
				await commit(ze)
				eventSubs.send(pid, 'newZoneEvent', ze.toJson())
			}
			const p = await Patient.fromKey(pid);
			if (p !== undefined) {
				this.sendPairedUsers(`${p.fullName()} est à présent hors-ligne!`, '', 'notif_offline_patient')
				if (this.battery !== undefined)
					p.battery = this.battery
				if (this.state !== undefined)
					p.state = this.state
				commit(p)
			}
			locationSubs.send(pid, 'locationDiag', "location_disconnected")
			batterySubs.send(pid, 'isOnline', false)
			this.log(`Client logged out (patient ${pid})`)
			delete clients[pid]
			delete clientsClosingPending[pid]
		}
	}

	/**
	 * Send a message to a user connected via WebSocket /app channel
	 * @async
	 * @param {string} message - The message to send
	 * @param {Id} userId - The user GCP Id
	 * @param {string | undefined} data - Additional data to send for this message
	 */
	protected async sendToApp(message: string, userId: Id, data: string | undefined = undefined) {
		sendToClients(userId, message, data)
	}

	/**
	 * Send a message to all paired users connected via WebSocket /app channel
	 * @async
	 * @param {string} message - The message to send
	 * @param {string | undefined} data - Additional data to send for this message
	 */
	protected async sendToAppPaired(message: string, data: string | undefined = undefined) {
		const pus = await PatientUser.getByPatientId(this.getPatientId())
		for (const pu of pus)
			sendToClients(pu.userId, message, data)
	}

	/**
	 * Send a notification to all users paired to patient, which have the notification class enabled
	 * @async
	 * @param {string} title - Title of the notification
	 * @param {string} message - Message of the notification
	 * @param {keyof Settings} settingType - Notification class: users opting out won't be notified, set to undefined to forcefully send notification
	 */
	protected async sendPairedUsers(title: string, message: string, settingType?: keyof Settings) {
		const pus = await PatientUser.getByPatientId(this.getPatientId())
		const notifs: Notification[] = []
		for (const pu of pus) {
			if (settingType === undefined || (await (await User.fromKey(pu.userId))!.querySettings())[settingType])
				notifs.push(await Notification.createNew(pu.userId, title, message))
		}
		await commit(...notifs)
	}

	/**
	 * New battery level have been acquired and should be dispatched
	 * @async
	 * @param {number} level - Zero-normalized battery level (0.0 - empty to 1.0 - full)
	 */
	protected async newBatteryLevel(level: number) {
		if (level <= 0.2) {
			if (!this.hasWarnedBattery) {
				this.hasWarnedBattery = true
				this.speak({text: "Niveau de batterie faible. Veuillez recharger votrez appareil dès que possible", isPublic: true})
			}
		} else
			this.hasWarnedBattery = false
		this.battery = level
		batterySubs.send(this.getPatientId(), 'batteryLevel', level)
	}

	public getPos() : LatLng | undefined {
		return this.pos
	}

	setNeutralDangerous(isNeutralDanger: boolean) {
		this.isNeutralDanger = isNeutralDanger
	}

	/**
	 * New GPS location have been acquired and should be dispatched
	 * @async
	 * @param {{lng: number, lat: number}} pos - Location in GPS coordinates
	 */
	protected async newLocation(pos: {lng: number, lat: number}) {
		const pid = this.getPatientId()
		locationSubs.send(pid, 'locationPosition', pos)
		const zs = await Zone.allForPatientId(pid)
		const r = new LocationReport(pos, zs, this.isNeutralDanger)
		const old_report = this.locReport
		this.locReport = r
		this.pos = pos
		const fallbackNeutral = (safety: ZoneSafetyType | undefined) => {
			if (safety === undefined)
				return 'neutral'
			else
				return safety
		}
		if (old_report !== undefined && old_report.insideZone?.safety !== r.insideZone?.safety)
			Multiplexer.checkTrigger(pid, "ZONE_TYPE_CHANGED", {
				zone_in: fallbackNeutral(r.insideZone?.safety),
				zone_out: fallbackNeutral(old_report === undefined ? undefined : old_report.insideZone?.safety)
			})
		if (old_report !== undefined)
			// still in same zone, indicate that we actually have been there all long
			if (this.locReport.isEqual(old_report))
				this.locReport.enteredAt = old_report.enteredAt
			else {
						// we stepped out of a zone, record that as an event
				switch(this.locReport.insideZone?.safety) {
					case 'danger':
						await Patient.setNewState(pid, "guard");
						break;
					case 'home':
						await Patient.setNewState(pid, "home");
						break;
					case 'safe':
						await Patient.setNewState(pid, "safe");
						break;
					default:
						await Patient.setNewState(pid, "unknown");

				}
				const ze = PatientZoneEvent.new({
					patient_id: pid,
					zone_id: old_report.getInsideZoneId(),
					range_begin: old_report.enteredAt,
					range_end: this.locReport.enteredAt
				})
				await commit(ze)
				eventSubs.send(pid, 'newZoneEvent', ze.toJson())
			}
		if (r.doSendReport(old_report)) {
			const tr = r.textReport((await Patient.fromKey(pid))!)
			await this.sendPairedUsers(tr.title, tr.message, 'notif_safe_zone_tracking')
		}
	}

	/**
	 * Speak to the patient as a certain user
	 * @async
	 * @param {User} u - The user to speak as
	 * @param {TextMessage} m - The message to speak
	 * @note `u` must be the user for the ID `m.user_id`
	 */
	async newMessageFromUser(u: User, m: TextMessage) {
		await this.speak(
			{text: "Message de:", isPublic: true},
			{text: u.fullName(), isPublic: false},
			{text: m.message, isPublic: false}
		)
		await this.onNewMessageFromUser(u, m)
	}

	/**
	 * Speak to all paired users as the patient
	 * @async
	 * @param {string} text - The message to say to users
	 */
	async newMessageFromPatient(text: string) {
		const m = TextMessage.new({
			patient_id: this.getPatientId(),
			user_id: '0',
			is_from_patient: true,
			datetime: getCurrentTime(),
			message: text,
			play_count: 0
		})
		const e = PatientEvent.now(this.getPatientId(), 'message_created')
		await commit(m, e)
		this.sendToAppPaired('newTextMessage', m.toJson())
	}
}

function extractDFdatetime(datetime: any) {
	if (datetime === '')
		return undefined
	if (typeof(datetime) === 'string')
		return datetime as string
	if (typeof(datetime) === 'object') {
		if (datetime.date_time !== undefined)
			return datetime.date_time as string
		if (datetime.startDateTime !== undefined)
			return datetime.startDateTime as string
		if (datetime.startDate !== undefined)
			return datetime.startDate as string
	}
	return undefined
}

/**
 * @class Client
 * Websocket client class
 */
export class DeviceClient extends Client implements AuthListener {
	connection: Connection // Websocket connection
	private auth: Auth // authentification
	private waitingFor: WaitingFor // What kind of data the client is currenlty waiting for
	private input?: Input  // input stream

	override onClose() {
		// Yes, that should happen only if logged in but the method is robust, don't worry
		// Extra paranoid because this thing can run indefinitely if we manage some edge cases suboptimally.
		this.auth.clearPairing()
	}

	constructor(connection: connection) {
		super()
		this.connection = new Connection(connection, this)
		this.auth = new Auth(this, this, this.connection, this)
		this.waitingFor = WaitingFor.NOTHING

		connection.on('message', async (data: Message) => {
			this.processIncomingMsg(data)
		})
		connection.on('close', async (reasonCode: number, description: string) => {
			this.log(`Client logged out reason: ${description} ${reasonCode}`)
			await this.close()
		})
	}

	override getPatientId(): Id {
		return this.auth.getPatientId()
	}

	/**
	 * Speak to the client
	 * @async
	 * @param {Statement[]} stmts - Sentences in order to say to the patient
	 */
	async speakThrottle(throttle: Throttle, ...stmts: Statement[]) {
		if (speakEnabled) {
			for (const stmt of stmts) {
				const buf = await tts(throttle, stmt, this)
				if (buf === throttled) {
					this.speakThrottle(new Throttle(undefined), {
						text: "Vous avez atteint votre limite quotidienne d'utilisation du service. Merci de réessayer dans 24 heures.",
						isPublic: true
					})
					return
				}
				for (const enc of buf)
					this.connection.send(enc)
			}
		}
	}

	/**
	 * Speak to the client
	 * @async
	 * @param {Statement[]} stmts - Sentences in order to say to the patient
	 */
	override async speak(...stmts: Statement[]) {
		return this.speakThrottle(this.throttle, ...stmts)
	}

	/**
	 * Log stuff to output, with client identification included
	 * @param {string} str - the message to log
	 */
	override log(str: string): void {
		logger.info(`/dev client ${this.id}: ${str}`)
	}

	override async onNewMessageFromUser(): Promise<void> {
	}

	/**
	 * Called when client successfully identified himself as a certain patient
	 */
	async onLoggedIn(patientId: Id): Promise<BufferedMessages> {
		this.auth.setPatientId(patientId)
		await this.login()

		let diagSessionPath = `projects/lea-helper/locations/europe-west2/agent/sessions/${patientId}`
		this.input = new Input(diagSessionPath, (res: DiagResult | undefined) => {
			this.processIntent(res)
		})
		const r = new BufferedMessages()
		r.push("enableLocation", enableLocationPayload)
		await Multiplexer.loadForPatient(this.getPatientId())
		return r
	}

	/**
	 * Notify the user about the new pairing token
	 * @param {string} token - the new pairing token
	 */
	async onPairingToken(token: String): Promise<void> {
		await this.speak({text: "Le code d'appairage est:", isPublic: true})
		for (let i in token)
			await this.speak({text: token[i], isPublic: true})	// Individual digits in pairing code are public, TTS-wise
	}

	/**
	 * Notify the user about a new pairing request
	 * @param {string} fullName - the name of the person wanting to peer
	 */
	async onNotifyPairing(fullname: string): Promise<void> {
		this.waitingFor = WaitingFor.PAIRING_CONFIRMATION
		await this.speak({text: fullname, isPublic: false})
		await this.speak({text: "vient de créer une demande d'appairage, s'agit-il bien de vous?", isPublic: true})
	}

	/**
	 * Process message received from client
	 * @async
	 * @param {Message} data - the message received from the client
	 */
	private async processIncomingMsg(msg: Message) {
		if (msg.type === 'binary') {
			this.processInAudio(msg.binaryData!)
		} else if (msg.type === 'utf8') {
			this.processInTextMsg(msg.utf8Data!)
		}
	}

	/**
	 * Handle audio received from client
	 * @async
	 * @param {Buffer} data - the audio received from the client
	 */
	private async processInAudio(audio: Buffer) {
		if (this.input === undefined) {
			this.log('Input audio but client not logged yet!')
			return
		}
		if (audio.length === 0) {
			if (this.input.close())
				this.log('Close intent')
		} else {
			const r = await this.input.inAudio(this.throttle, audio)
			if (r === 'OpenedIntent')
				this.log('Open intent')
			else if (r === 'NlpThrottled')
				this.speak({
					text: "Vous avez atteint la limite quotidienne d'utilisation du service. Merci de réessayer dans 24 heures.",
					isPublic: true
				})
		}
	}

	/**
	 * Process analyzed intent from the client
	 * @async
	 * @param {DiagResult | undefined} res - the intent detected, or undefined if no intent
	 */
	async processIntent(res: DiagResult | undefined) {
		if (res === undefined) {
			this.log('No intent detected')
			this.speak({text: "Je n'ai pas compris votre demande", isPublic: true})
			await this.performedEvent('unknown')
			return
		}
		const r: DiagResult = res
		this.log(`New intent: ${r.intent.displayName}`)
		switch (r.intent.displayName) {
			case 'Yes':
				if (this.waitingFor === WaitingFor.PAIRING_CONFIRMATION) {
					const pairingCode = this.auth.getPairingCode()
					if (pairingCode && pairingCode.isWaiting()) {
						const patient = await Patient.fromKey(this.getPatientId())
						if (patient !== undefined) {
							const patientId = patient.getKey()
							await PatientUser.createNew(patientId, pairingCode.userId)
							this.auth.clearPairing()
							this.sendToApp("pairingAccepted", pairingCode.userId, patientId.toString())
							this.speak({text: "Votre appareil Léa est maintenant lié à votre compte. Veuillez poursuivre la configuration de votre appareil sur votre smartphone.", isPublic: true})
							this.waitingFor = WaitingFor.NOTHING
							await this.refreshThrottle()
							await this.performedEvent('pairing_accepted')
						}
					}
				}
				break
			case 'No':
				if (this.waitingFor === WaitingFor.PAIRING_CONFIRMATION) {
					const pairingCode = this.auth.getPairingCode()
					if (pairingCode) {
						pairingCode.stopWaiting()
						this.sendToApp("pairingDenied", pairingCode.getUserId())
					}
					this.speak({text: 'La demande d\'appairage a bien été refusée', isPublic: true})
					this.auth.generatePairingToken()
					await this.performedEvent('pairing_denied')
				}
				break
			case 'send_message':
				{
					let m = r.params.message as string
					if (typeof(m) === 'string') {
						this.newMessageFromPatient(capitalizeFirstLetter(m))
						this.speak({text: 'Message envoyé.', isPublic: true})
					}
				}
				break
			case 'set_reminder':
				{
					const ds = extractDFdatetime(r.params.datetime) as string
					const t = r.params.title as string
					if (typeof(ds) === 'string' && typeof(t) === 'string') {
						const dt = parseTime(ds)
						// Creates new CalendarEvent
						let event = await CalendarEvent.createNew('REMINDER', dt, 0, {
							'title': capitalizeFirstLetter(t),
							'desc': ''
						}, 'PATIENT')

						// Add to timers batch if needed
						if (timers.shouldBeInBatch(event))
							timers.insertEvent(event)

						// Creates the corresponding Patient-CalendarEvent association
						await PatientCalendarEvent.createNew(this.getPatientId(), event.getKey())
						await this.performedEvent('reminder_created')
						calendarEventSubs.send(this.getPatientId(), 'calendarEvent', {
							type: 'created',
							event: event.toJson()
						})
						this.speak({text: 'Rappel créé.', isPublic: true})
					} else
						this.speak({text: "Je n'ai pas compris l'heure de votre rappel", isPublic: true})
				}
				break
			case 'set_event':
				{
					const ds = extractDFdatetime(r.params.datetime) as string
					const t = r.params.title as string
					if (typeof(ds) === 'string' && typeof(t) === 'string') {
						const dt = parseTime(ds)
						// Creates new CalendarEvent
						let event = await CalendarEvent.createNew('EVENT', dt, 0, {
							'title': capitalizeFirstLetter(t),
							'desc': ''
						}, 'PATIENT')

						// Add to timers batch if needed
						if (timers.shouldBeInBatch(event))
							timers.insertEvent(event)

						// Creates the corresponding Patient-CalendarEvent association
						await PatientCalendarEvent.createNew(this.getPatientId(), event.getKey())
						await this.performedEvent('event_created')
						calendarEventSubs.send(this.getPatientId(), 'calendarEvent', {
							type: 'created',
							event: event.toJson()
						})
						this.speak({text: 'Événement créé.', isPublic: true})
					} else
						this.speak({text: "Je n'ai pas compris l'heure de votre événement", isPublic: true})
				}
				break
			// TODO: GPS to location: need to match with zones!
			/*case 'Self_trigger_gps':
				//let m = r.params.location as string
				//if (typeof(m) === 'string') {
					this.speak({text: 'très bien, je vais vous racompagner', isPublic: true})
					this.gps.start()
				//} else
				//	this.speak({text: "Je ne vous ai pas compris", isPublic: true})
				break*/
			case 'Self_trigger_lostItems':
				{
					let m = r.params.items as Array<string>
					m.forEach(item => {
						if (typeof(item) === 'string') {
							logger.info(item)
							this.forgotten.add(this.getPatientId(), item)
						}	
						this.speak({text: 'vos oublis ont bien été ajoutés', isPublic: true})			
					});
				}
				break
			case 'trigger_intent_time':
				Multiplexer.checkTrigger(this.getPatientId(), 'INTENT', {intent: 'time'})
				break
			case 'trigger_intent_date':
				Multiplexer.checkTrigger(this.getPatientId(), 'INTENT', {intent: 'date'})
				break
			case 'trigger_intent_forecast':
				Multiplexer.checkTrigger(this.getPatientId(), 'INTENT', {intent: 'forecast'})
				break
			case 'trigger_intent_list_forgotten':
				Multiplexer.checkTrigger(this.getPatientId(), 'INTENT', {intent: 'list_forgotten'})
				break
			case 'trigger_intent_delete_forgotten':
				Multiplexer.checkTrigger(this.getPatientId(), 'INTENT', {intent: 'delete_forgotten'})
				break
			case 'trigger_intent_guide_home':
				Multiplexer.checkTrigger(this.getPatientId(), 'INTENT', {intent: 'guide_home'})
				break

			case 'Self_trigger_stop':
				await this.speak({text: "très bien, j'arrête le guidage", isPublic: true})
				this.gps.stop()
				break
		}
	}

	/**
	 * Process request from client
	 * @async
	 * @param {string} message - the raw request of the client, as JSON
	 */
	private async processInTextMsg(message: string) {
		try {
			JSON.parse(message)
		} catch {
			this.connection.error('BAD_MSG', true)
			return
		}
		const msg = JSON.parse(message)
		this.log(`Processing incoming message type: ${msg.type}`)
		switch (msg.type) {
			case 'versionAndroid':
				if (msg.data !== undefined)
					this.connection.send(buildDeviceAndroid.isUpToDate(msg.data) ? 'uptodate' : 'outdated')
				else
					this.connection.error('MISSING_FIELD', true)
				break
			case 'firstConnexion':
				if (this.auth.isLoggedIn())
					this.connection.error('BAD_LOGIN', true)

				this.speak({text: "Bienvenue ! Je suis Léa, votre assistante personnelle. Afin de configurer votre appareil, veuillez lancer l'application Léa sur votre smartphone et suivre les instructions à l'écran.", isPublic: true})
				this.auth.generatePairingToken()
				if (msg.data !== undefined)
					this.auth.generateToken(msg.data)
				else
					this.connection.error('MISSING_FIELD', true)
				break
			case 'login':
				if (this.auth.isLoggedIn())
					this.connection.error('BAD_LOGIN', true)

				if (msg.data !== undefined)
					this.auth.login(msg.data, this)
				else
					this.connection.error('NO_LOGIN_SUPPLIED', true)
				break
			case 'location':
				if (!this.auth.assertLoggedIn())
					return
				this.newLocation(msg.data)
				break
			case 'locationDisabled':
				if (!this.auth.assertLoggedIn())
					return
				this.log("Position disabled for now :(")
				locationSubs.send(this.getPatientId(), 'locationDiag', "location_disabled")
				break
			case 'locationUnavailable':
				if (!this.auth.assertLoggedIn())
					return
				this.log("Position not available on such platform")
				locationSubs.send(this.getPatientId(), 'locationDiag', "location_unavailable")
				break
			case 'batteryLevel':
				if (!this.auth.assertLoggedIn())
					return
				this.newBatteryLevel(msg.data)
				break
			default:
				this.connection.error('BAD_MSG_TYPE', true)
				break
		}
	}

	// UNIT TEST HELPER METHODS BEGIN
	doesMatchToken(token: string) {
		return token === this.auth.getToken()
	}

	getPairingToken(): string {
		const c = this.auth.getPairingCode()
		if (c === undefined)
			return ''
		else
			return c.token
	}

	updatePairingToken(): void {
		this.auth.updatePairingToken()
	}
	// UNIT TEST HELPER METHODS END
}

class VirtualDevice extends Client {
	private patientId: Id
	private loc_sub: Subscription
	private bat_sub: Subscription

	override onClose() {
		this.loc_sub.unsubscribe()
		this.bat_sub.unsubscribe()
	}

	constructor(patientId: Id) {
		super()
		this.patientId = patientId
		this.login()
		this.loc_sub = defaultLocationProvider.subscribe(async p => {
			await this.newLocation(p)
		})
		this.bat_sub = defaultBatteryLevelProvider.subscribe(async p => {
			await this.newBatteryLevel(p)
		})
	}

	override getPatientId(): Id {
		return this.patientId
	}

	override async speak(...stmts: Statement[]) {
		const msg = stmts.map(s => s.text).join(' ')
		this.log(`Speak: '${msg}'`)
		this.sendPairedUsers('Haut-parleurs usager virtuel', `Votre usager virtuel a reçu le message : "${msg}"`, undefined)
	}

	override log(text: string) {
		logger.info(`/dev [virtual] client ${this.id}: ${text}`)
	}

	private static responses = [
		'Merci pour votre message',
		'Je vous souhaite une excellente journée',
		'Je vais bien, comment allez-vous ?',
		'Quelle heure est-il ?',
		"Je me demande ce que je vais faire aujourd'hui!"
	]

	override async onNewMessageFromUser(/*u: User, m: TextMessage*/): Promise<void> {
		setTimeoutSec(async () => {
			await this.newMessageFromPatient(runiformSampleArray(VirtualDevice.responses))
		}, 10.0 + 10.0 * Math.random())
	}
}

@Entity()
export class VirtualPatient extends BaseEntity<VirtualPatient>() {
	@Col({spec: 'id'}) patientId!: Id
	@Col({spec: 'id'}) userId!: Id

	static byUserId(userId: Id) {
		return this.query(q => q.where('userId', '==', userId))
	}

	static async launchAllFor(userId: Id) {
		for (const vp of await this.byUserId(userId))
			if (clients[vp.patientId] === undefined)
				new VirtualDevice(vp.patientId)
	}

	static async releaseAllFor(userId: Id) {
		const vps = await this.byUserId(userId)
		for (const vp of vps) {
			const c = clients[vp.patientId]
			if (c !== undefined)
				await c.close()
		}
		return vps
	}

	static async removeAllFor(userId: Id) {
		const vps = await VirtualPatient.byUserId(userId)
		let res: DriverEntity[] = vps
		let cbs: (() => void)[] = []
		for (const vp of vps) {
		  const [r, c] = await (await Patient.fromKey(vp.patientId))!.getRecords()
		  res = res.concat(r)
		  cbs = cbs.concat(c)
		}
		await remove(...unique(res))
		for (const cb of cbs)
			cb()
		logger.info(`Deleted virtual patient(s): ${vps.map(v => v.patientId).join(', ')}`)
	}
}
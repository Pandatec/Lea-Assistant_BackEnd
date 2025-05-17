import { DeviceClient, BufferedMessages } from './client'
import { makeId, delay, setTimeoutSec } from '../../utils'
import Patient from '../../orm/patient'
import PatientUser from '../../orm/patient-user'
import { pairingCodes, PairingCode } from '../../pairingCodes'
import { Logger } from './logger'
import { Speaker } from './speaker'
import { Connection } from '../connection'
import { Id } from '../../driver'

/**
 * @interface AuthListener
 * Events for Auth
 */
export interface AuthListener {
	onLoggedIn(patientId: Id): Promise<BufferedMessages>;
	onPairingToken(token: String): Promise<void>;
	onNotifyPairing(fullname: string): Promise<void>;
}

/**
 * @class Auth
 * Authentification for Client: token, pairing token
 */
export class Auth {
	private logger: Logger
	private speaker: Speaker
	private connection: Connection
	private authListener: AuthListener

	private token: string // Patient secret ID
	private patientId: Id	// Logged patient ID
	private pairingCode?: PairingCode	// Pairing code, set if pairing in progress
	private timeoutGenerate?: NodeJS.Timeout // Timeout handle to clear when client finally logs in
	private timeoutRepeat?: NodeJS.Timeout // Timeout handle to clear when client finally logs in

	constructor(logger: Logger, speaker: Speaker, connection: Connection, authListener: AuthListener) {
		this.logger = logger
		this.speaker = speaker
		this.connection = connection
		this.authListener = authListener

		this.token = ''
		this.patientId = ''
		setTimeoutSec(async () =>
			this.checkToken(), 5.0
		)
	}

	/**
	 * Login using token
	 * @async
	 * @param {string} token - patient token
	 * @param {Client} client - the client object the client logs as
	 */
	async login(token: string, client: DeviceClient) {
		let patient = await Patient.getBySecretId(token)
		if (patient === undefined)
			client.connection.error('BAD_CRED', true)
		else {
			this.token = token
			const msgs = await this.authListener.onLoggedIn(patient.getKey())
			const link = await PatientUser.getByPatientId(patient.getKey())
			if (link.length == 0)
				this.generatePairingToken()
			this.connection.send('tokenAccepted')
			msgs.flush(this.connection)
		}
	}

	/**
	 * Create new patient and send its token to the device
	 * @async
	 * @param {Client} client -  The client object the client logs as
	 * @param {number} battery - The battery level of the patient's device
	 */
	async generateToken(battery: number) {
		const patient = await Patient.createNew(battery)
		const token = patient.secret_id
		this.token = token;
		const msgs = await this.authListener.onLoggedIn(patient.getKey())
		this.connection.send('token', token)
		msgs.flush(this.connection)
	}

	/**
	 * Create a new pairing token for the device
	 */
	async generatePairingToken() {
		// Generates the token
		let pairingToken: string
		for (;;) {
			pairingToken = makeId(6, "0123456789")
			if (pairingCodes[pairingToken] === undefined)
				break
			await delay(.5)	// collision, wait for a bit
		}
		this.clearPairing()
		this.pairingCode = new PairingCode(this, pairingToken)
		pairingCodes[pairingToken] = this.pairingCode
		// Sends it to the device
		this.authListener.onPairingToken(pairingToken)	// WARNING: async function
		this.timeoutRepeat = setTimeoutSec(async () => {
			this.authListener.onPairingToken(pairingToken)
		}, 30.0)
		// Sets a callback to update the token in one minute
		this.timeoutGenerate = setTimeoutSec(async () => {
			this.updatePairingToken()
		}, 60.0)
	}

	/**
	 * Retrieve patient token, "" if not logged in
	 * @return string - the logged token
	 */
	getToken(): string {
		return this.token
	}

	/**
	 * Set patient ID, should be called only once in the lifetime of the client!!
	 * @param {Id} patientId - The patient ID to set
	 */
	setPatientId(patientId: Id) {
		this.patientId = patientId
	}

	/**
	 * Retrieve patient ID, '' if not logged in
	 * @return Id - the logged patient ID
	 */
	getPatientId(): Id {
		return this.patientId
	}

	/**
	 * Check whether /dev client is logged in or not
	 * @return boolean - true if logged in, false otherwise
	 */
	isLoggedIn(): boolean {
		return this.patientId !== ''
	}

	/**
	 * Make sure /dev client is logged in, otherwise close connection
	 * @return boolean - true if logged in, false otherwise
	 */
	assertLoggedIn(): boolean {
		let res = this.isLoggedIn()
		if (!res)
			this.connection.error('NOT_LOGGED_IN', true)
		return res
	}

	/**
	 * Retrieve patient pairing code, undefined if no pairing going on
	 * @return PairingCode | undefined - the pairing code if any
	 */
	getPairingCode(): PairingCode | undefined {
		return this.pairingCode
	}

	/**
	 * Indicate that a person wants to pair
	 * @param {string} fullname - the name of the person that wants to pair
	 */
	notifyPairing(fullname: string) {
		this.authListener.onNotifyPairing(fullname)
	}

	/**
	 * Make current pairing code last forever, if any
	 */
	freezePairingCode() {
		if (this.timeoutRepeat !== undefined) {
			clearInterval(this.timeoutRepeat)
			this.timeoutRepeat = undefined
		}
		if (this.timeoutGenerate !== undefined) {
			clearInterval(this.timeoutGenerate)
			this.timeoutGenerate = undefined
		}
	}

	/**
	 * Reset pairing
	 */
	clearPairing() {
		this.freezePairingCode()
		if (this.pairingCode !== undefined) {
			delete pairingCodes[this.pairingCode.token]
			this.pairingCode = undefined
		}
	}

	/**
	 * Check if the client has a token and setup future disconnection if the client is still not logged in
	 */
	private checkToken() {
		if (this.token === '') {
			this.logger.log('No token received, closing connection')
			this.connection.error('NO_LOGIN_SUPPLIED', true)
		}
	}

	/**
	 * Regen pairing token and remind the user to use the phone app
	 */
	updatePairingToken() {
		// Removes the old pairing code in the map
		this.generatePairingToken()
		this.speaker.speak({text: "Afin de configurer votre appareil, veuillez lancer l\'application Léa sur votre smartphone et suivre les instructions à l\'écran.", isPublic: true})
	}
}

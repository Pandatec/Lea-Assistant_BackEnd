import { Id } from './driver'
import { Auth } from './websocket/dev/auth'

export class PairingCode {
  auth: Auth
  private waiting: boolean
  token: string
  userId: Id

  /**
   * 
   * @param {Auth} client
   * @param {string} token
   */
  constructor (auth: Auth, token: string) {
    this.auth = auth
    this.waiting = false
    this.token = token
    this.userId = ''
  }

  /**
   * Gets wether or not the pairing code is waiting for a user
   * 
   * @returns {boolean}
   */
  isWaiting () : boolean {
    return this.waiting
  }

  /**
   * Makes the pairing code waiting for a user to pair
   */
  startWaiting () {
    this.waiting = true
  }

  /**
   * Stops the pairing code waiting for a user to pair
   */
  stopWaiting () {
    this.waiting = false
  }

  /**
   * Sets the Id of the user who wants to pair
   * 
   * @param {Id} userId 
   */
  setUserId(userId: Id) {
    this.userId = userId
  }

  /**
   * Gets the Id of the user who wants to pair
   * 
   * @returns {Id}
   */
  getUserId() : Id {
    return this.userId
  }
}

export let pairingCodes: {[key: string]: PairingCode} = {}
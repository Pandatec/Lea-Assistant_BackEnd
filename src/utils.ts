import bcrypt from 'bcrypt'

/**
 * @enum ErrorMessageEnum
 */
enum ErrorMessageEnum {
  MISSING_FIELD,
  NO_FIELD,
  AUTHENTIFICATION_FAILED,
  ALREADY_REGISTERED,
  INVALID_FIELD,
  UNKNOWN_PATIENT,
  NOT_PAIRED,
  UNKNOWN_CALENDAR_EVENT,
  UNKNOWN_CODE,
  WAITING_FOR_CONFIRMATION,
  NOT_LOGGED_IN,
  NOT_VERIFIED,
  INTERNAL_ERROR,
  USER_DOES_NOT_EXIST,
  UNKNOWN_MESSAGE,
  INVALID_PATIENT,
  NO_PATH,
  INVALID_DEVICE_ID,
  PASSWORD_MISMATCH,
  TOKEN_EXPIRED,
  PASSWORD_TOO_SHORT
}

/**
 * @type {ErrorMessage}
 */
export type ErrorMessage = keyof typeof ErrorMessageEnum

/**
* @class BackError
*
* Error class embedding status code
*
* @extends Error
*/
export class BackError extends Error {
  // Status code
  status: number

  /**
  * @constructor
  *
  * @param {number} status    Status code of the error
  * @param {ErrorMessage} message   Error message
  */
  constructor (status: number, message: ErrorMessage) {
    super(message)
    this.name = 'BackError'
    this.status = status
  }
}

const makeIdRes: {[length: number]: string[]} = {}

export function addMakeIdRes(length: number, res: string): void {
  if (makeIdRes[length] === undefined)
    makeIdRes[length] = []
  makeIdRes[length].push(res)
}

/**
* Generates random string of `length` characters
*
* @param {number} length      Length of the generated id
* @param {string} characters  Characters allowed (default lowalpha-num)
* @returns {string}           Random string
*/
export function makeId (length: number, characters: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
  if (makeIdRes[length] !== undefined) {
    const r = makeIdRes[length].pop()!
    if (makeIdRes[length].length === 0)
      delete makeIdRes[length]
    return r
  }
  // Characters definition
  let result = ''
  const charactersLength = characters.length

  // Generates random id
  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomDiscrete(charactersLength))
  }
  return (result)
}

/**
* Removes an element from an array
*
* @param {Array<T>} array   Array to modify
* @param {T} element        Element to remove
* @returns {string}         New array with element removed
*/
export function removeFromArray<T> (array: Array<T>, element: T): Array<T> {
  // Filter the array
  const newArray = array.filter((currentElement: T) => currentElement !== element)
  return (newArray)
}

/**
 * Wait for a certain amount of time
 * @param s - Time to wait in seconds
 * @returns Promise
 */
export function delay(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000.0))
}

/**
 * setTimeout, but using seconds instead!
 * @param {() => Promise<void>} cb - The function to call when delaySeconds have elapsed
 * @param {number} delaySeconds - The number of seconds of wait
 * @returns NodeJS.Timeout - The underlying timeout handle
 */
export function setTimeoutSec(cb: () => Promise<void>, delaySeconds: number) {
  return setTimeout(cb, delaySeconds * 1000.0)
}

/**
 * setInterval, but using seconds instead!
 * @param {() => Promise<void>} cb - The function to call when delaySeconds have elapsed
 * @param {number} delaySeconds - The number of seconds of wait
 * @returns NodeJS.Timeout - The underlying timeout handle
 */
 export function setIntervalSec(cb: () => Promise<void>, delaySeconds: number) {
  return setInterval(cb, delaySeconds * 1000.0)
}

/**
 * Generate an integer in [0, maxNonInclusive), uniform distribution
 * @param {number} maxNonInclusive - The maximum (non-inclusive) value
 * @return number - The generated value guaranteed to be in the specified range
 */
export function randomDiscrete(maxNonInclusive: number) {
  while (true) {
    const v = Math.floor(Math.random() * maxNonInclusive)
    if (v < maxNonInclusive)
      return v
  }
}

/**
 * Sample an array using probability vector of repeated value 1 / array.length
 * @param {T[]} array - The array to randomly sample
 * @return T - The sampled element
 */
export function runiformSampleArray<T>(array: T[]) {
  return array[randomDiscrete(array.length)]
}

/**
 * Get current time in Unix 64-bit format
 * @return number - Float seconds since epoch
 */
 export function getCurrentTimeFrac(): number {
  // Convert ms to seconds
  return Date.now() / 1000.0
}

/**
 * Get current time in Unix 64-bit format
 * @return number - Integer seconds since epoch
 */
export function getCurrentTime(): number {
  return Math.floor(getCurrentTimeFrac())
}

export function parseTime(time: string): number {
  return Math.floor(Date.parse(time)) / 1000.0
}

/**
 * @class Logger
 */
class Logger {
  private usedLog: boolean = false

  /**
   * @public @method
   * 
   * @param {any} data The data to log
   */
  public info (data: any) {
    console.info(`\x1b[44m\x1b[30mINFO:\x1b[0m\x1b[34m [${new Date(Date.now()).toLocaleString()}] ${data}\x1b[0m`)
  }

  /**
   * @public @method
   * 
   * @param {any} data The data to log
   */
  public log (data: any) {
    if (!this.usedLog) {
      this.usedLog = true
      this.warn('Debug log used, please removed it before merging !')
    }
    console.log(`\x1b[40m\x1b[30mDEV:\x1b[0m\x1b[37m [${new Date(Date.now()).toLocaleString()}] ${data}\x1b[0m`)
  }

  /**
   * @public @method
   * 
   * @param {any} data The data to log
   */
  public warn (data: any) {
    console.info(`\x1b[43m\x1b[30mWARNING:\x1b[0m\x1b[33m [${new Date(Date.now()).toLocaleString()}] ${data}\x1b[0m`)
  }

  /**
   * @public @method
   * 
   * @param {any} data The data to log
   */
  public error (data: any) {
    console.info(`\x1b[41m\x1b[30mERROR:\x1b[0m\x1b[31m [${new Date(Date.now()).toLocaleString()}] ${data}\x1b[0m`)
    process.exit(1)
  }
}

export const logger: Logger = new Logger()

export function filterUndefined<T>(arr: (T | undefined)[]) {
  return arr.filter(v => v !== undefined) as T[]
}

/**
 * @function
 * 
 * Hashes a string
 * 
 * @param {string} str - The string to hash 
 * @returns {string} - The hashed string
 */
export function hash(str: string) : string {
  return bcrypt.hashSync(str, 12)
}

export function capitalizeFirstLetter(str: string): string {
  if (str.length > 0)
		return str[0].toUpperCase() + str.substring(1)
  else
    return str
}

export function assertTextLimit(...str: string[]): void {
  for (const s in str)
    if (s.length > 1024)
      throw new BackError(400, 'INVALID_FIELD')
}

export function getDateNowParis() {
  return new Date(new Date().toLocaleString('en-US', {timeZone: 'Europe/Paris'}))
}
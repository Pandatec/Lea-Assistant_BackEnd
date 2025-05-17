// Imports
import { SHA3 } from 'sha3'
import Token from './orm/token'
import { logger, removeFromArray } from './utils'
import { commit, remove } from './orm'
import { promises } from 'fs'
import { Id } from './driver'

/**
 * @class ParsedToken - Represents a parsed token and gives easy access to it's components
 * 
 * @remarks All properties are private and have getters to avoid anyone shomehow modifying them
 * @private @property {Id} userId - The ID of the user this token belongs to
 * @private @property {number} index - The Index of this token
 * @private @property {string} signature - The hash signature of this token
 */
class ParsedToken {
  private userId: Id
  private index: number
  private signature: string

  /**
   * @constructor
   * 
   * @param {string} token - The token to parse
   */
  constructor(token: string) {
    this.userId = token.substring(0, token.indexOf('-'))
    this.index = Number(token.substring(token.indexOf('-') + 1, token.indexOf('.')))
    this.signature = token.substring(token.indexOf('.') + 1)
  }

  /**
   * @public @method getUserId - Returns the user ID of this token
   * 
   * @returns {Id} The ID of the user this token belongs to
   */
  public getUserId(): Id {
    return this.userId
  }

  /**
   * @public @method getIndex - Returns the index of this token
   * 
   * @returns {number} The index of this token
   */
  public getIndex(): number {
    return this.index
  }

  /**
   * @public @method getSignature - Returns the signature of this token
   * 
   * @returns {string} The hash signature of this token
   */
  public getSignature(): string {
    return this.signature
  }

  /**
   * @public @method getPayload - Returns the payload of this token
   * 
   * @returns {string} The payload of this token
   */
  public getPayload(): string {
    return `${this.userId}-${this.index}`
  }
}

/**
 * @class TokenHandler - Handles all user token related operations
 * 
 * @private {Map<Id, string[]>} storedTokens - A map of all the user token per user
 * @private {string} signatureConstant - A constant used to sign the token
 * @private {string} secret - The secret used to sign the token
 */
class TokenHandler {
  private storedTokens: Map<Id, string[]> = new Map()
  private signatureConstant = '706db1de0a63df850ff9b25126dade03'
  private secret: string = ''

  constructor() {
    this.setTokenSecret()
  }

  /**
	* @private @async @method getTokenSecretFromGCP - Sets the token secret
	*/
	private async setTokenSecret() {
		if (process.env.TOKEN_SECRET !== undefined) {
      this.secret = process.env.TOKEN_SECRET
			return
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
      const handler = await promises.open(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'r')
      const content = await promises.readFile(handler, { encoding: 'utf8' })
      await handler.close()
      this.secret = JSON.parse(content).private_key_id
    }
 	}

  /**
   * @private @method add - Adds a token to the storedTokens map
   * 
   * @param {string} token - The user token to add
   * @param {Id} userId - The user id to add the token to
   */
  private add(token: string, userId: Id) {
    const uts = this.storedTokens.get(userId)
    if (uts !== undefined)
      uts.push(token)
    else
      this.storedTokens.set(userId, [token])
  }

  /**
   * @private @method getMax - Gets the maximum index of token for a user
   * 
   * @param {Id} userId - The user id to get the max token index for
   * @returns {number} The max token index for the user
   */
  private getMax(userId: Id): number {
    const uts = this.storedTokens.get(userId)
    if (uts === undefined)
      return 0
    return new ParsedToken(uts[uts.length - 1]).getIndex() + 1
  }

  /**
   * @public @async @method loadStoredTokens - Loads all the tokens from the database
   * 
   * @returns {Promise<void>} A promise that resolves when the tokens are loaded
   */
  public async loadStoredTokens(): Promise<void> {
    logger.info('Getting stored tokens...')
    const tokens = await Token.query()
    tokens.map(token => {
      this.add(token.token, token.userId)
    })
    this.storedTokens.forEach(tokens => {
      tokens.sort((a, b) => new ParsedToken(a).getIndex() - new ParsedToken(b).getIndex())
    })
    logger.info('Stored tokens received')
  }

  /**
   * @public @async @method create - Creates a new token for a user
   * 
   * @param {Id} userId - The user id to create the token for
   * @returns {Promise<String>} A promise that resolves to the newly created token
   */
  public async create(userId: Id): Promise<string> {
    const payload = `${userId}-${this.getMax(userId)}`
    const signature = this.createSignature(payload)
    const token = `${payload}.${signature}`
    this.add(token, userId)
    const permanentToken: Token = Token.new({
      token: token,
      userId: userId
    })
    await commit(permanentToken)
    return token
  }

  /**
   * @private @method tokenExists - Checks if a token exists for a given user
   * 
   * @param {Id} userId - The user id to check the token for 
   * @param {string} token - The token to check 
   * @returns {boolean} True if the token exists, false otherwise
   */
  private tokenExists(userId: Id, token: string): boolean {
    const uts = this.storedTokens.get(userId)
    if (uts === undefined)
      return false
    return uts.includes(token)
  }

  /**
   * @private @method createSignature - Creates a signature for a token
   * 
   * @param {string} payload - The payload to sign 
   * @returns {string} The signature of the token
   */
  private createSignature(payload: string): string {
    const toSign = `${this.signatureConstant}${payload}${this.secret}`
    return new SHA3().update(toSign).digest('hex')
  }

  /**
   * @public @method check - Checks if a token is valid
   * 
   * @param {string} token - The token to check
   * @returns {Id | undefined} The user id if the token is valid, undefined otherwise
   */
  public check(token: string): Id | undefined {
    const parsedToken = new ParsedToken(token)
    if (!this.tokenExists(parsedToken.getUserId(), token))
      return undefined
    const signature = this.createSignature(parsedToken.getPayload()) 
    if (signature === parsedToken.getSignature())
      return parsedToken.getUserId()
    return undefined
  }

  /**
   * @public @async @method remove - Removes a token from the database
   * 
   * @param {string} token - The token to remove
   * @param {string} userId - The user id to remove the token from
   */
  public async remove(token: string, userId: string): Promise<void> {
    // Remove the token from local storage
    const uts = this.storedTokens.get(userId)
    if (uts === undefined)
      return
    this.storedTokens.set(userId, removeFromArray(uts, token))

    // Remove the token from the database
    const DBToken = await Token.query(q => q.where('token', '==', token))
    await remove(...DBToken)
  }

  /**
   * @public @async @method removeAllFromUser - Removes all the tokens from a user
   * 
   * @param {string} userId - The user id to remove the token from
   */
  public async removeAllFromUser(userId: string): Promise<void> {
    // Remove the token from local storage
    if (this.storedTokens.get(userId) === undefined)
      return
    this.storedTokens.delete(userId)

    // Remove the token from the database
    const DBTokens = await Token.query(q => q.where('user_id', '==', userId))
    await remove(...DBTokens)
  }
}

export const token: TokenHandler = new TokenHandler()

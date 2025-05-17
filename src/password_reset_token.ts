import { makeId } from "./utils"

/**
 * @class PasswordResetToken
 * 
 * Handles password recovery tokens
 * 
 * @public @property {string} token : the token itself
 * @public @property {string} email : the email of the user
 * @public @property {Date} createdAt : the date of expiration
 */
export class PasswordResetToken {
  token: string
  email: string
  expires: Date

  /**
   * @constructor
   * 
   * @param {string} token : the token 
   * @param {string} email  : the email of the user
   */
  constructor (token: string, email: string) {
    this.token = token
    this.email = email
    // The token will expire in 5 minutes
    this.expires = new Date(Date.now() + (1000 * 60 * 5))
  }

  /**
   * @public @method isExpired
   * 
   * Returns true if the token is expired, false otherwise
   * 
   * @returns {boolean}
   */
  isExpired(): boolean {
    return this.expires < new Date()
  }
}

function isUnique(token: string) : boolean {
  for (let key in passwordResetTokens) {
    if (passwordResetTokens[key].token === token)
      return false
  }
  return true
}

export function createResetToken(id: string, email: string) : string {
  let token = makeId(256)
  while (isUnique(token) !== true)
    token = makeId(256)
  passwordResetTokens[id] = new PasswordResetToken(token, email)
  return token
}

export const passwordResetTokens: {[key: string]: PasswordResetToken} = {}

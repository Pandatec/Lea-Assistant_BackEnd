import { logger, makeId } from '../utils'
import { Entity, BaseEntity, Col, commit, Met } from '../orm'

@Entity()
export default class EmailCode extends BaseEntity<EmailCode>() {
  @Col() userId!: string
  @Col() emailCode!: string 

  /**
  * Creates a new Patient-User entity in the data store
  * Returns the corresponding Patient-User ORM instance
  *
  * @public @static @async
  * @param {string} userId - Patient-User userId
  * @returns {Promise<emailCodeUser>} - Promise of the corresponding Patient-User ORM instance
  */
  public static async createNew (userId: string) : Promise<EmailCode> {
    // Creates a new GCP key
    const emailCodeUser = this.new({
      userId: userId,
      emailCode: await this.make_unique()
    })

    // Saves patient-user
    await commit(emailCodeUser)

    // Prints and returns
    logger.info(`EmailCode '${emailCodeUser.getKey()}' created`)
    return emailCodeUser
  }

  /**
  * Gets the Email Code instance corresponding to the given code
  *
  * @public @static @async
  * @param {string} emailCode - Code to look for
  * @returns {Promise<EmailCode | undefined>} - Corresponding Email Code ORM instance or undefined if not found
  */
  public static async getByEmailCode(emailCode: string) : Promise<EmailCode | undefined> {
    const matches = await this.query(q => q.where('emailCode', '==', emailCode))
    const code = matches[0]

    // Checks if not empty, checks password, and returns entity
    if (matches.length === 0)
      return undefined
    else
      return code
  }

  /**
   * Update the code when a new code is requested
   * 
   * @public @async @method update
   * @returns {Promise<void>}
   */
  @Met()
  public async update() : Promise<void> {
    this.emailCode = await EmailCode.make_unique()
  }

  /**
   * Generates a unique email code
   * 
   * @public @static @async @method
   * @returns {Promise<string>} - The unique email code
   */
  public static async make_unique() : Promise<string> {
    let code = makeId(16)
    while (await this.getByEmailCode(code) !== undefined)
      code = makeId(16)
    return code
  }

  /**
  * Gets the Email Code instance corresponding to the given User
  *
  * @public @static @async
  * @param {string} userId - User id to look for
  * @returns {Promise<EmailCode | undefined>} - Corresponding Email Code ORM instance or undefined if not found
  */
  public static async getByUserId(userId: string) : Promise<EmailCode | undefined> {
    const matches = await this.query(q => q.where('userId', '==', userId))

    const code = matches[0]

    // Checks if not empty, checks password, and returns entity
    if (matches.length === 0)
      return undefined
    else
      return code
  }

  /**
   * Checks if the code is valid
   * 
   * @public @static @async @method
   * @param {string} userId - User id to look for
   * @param {string} emailCode - The email code to check
   * @returns {Promise<boolean>} - Wether the email code is valid or not
   */
  public static async exists(userId: string, emailCode: string) : Promise<boolean> {
    const entities = await this.query(q => q
      .where('userId', '==', userId)
      .where('emailCode', '==', emailCode)
    )

    // Check if entity exists
    return entities.length > 0
  }
}

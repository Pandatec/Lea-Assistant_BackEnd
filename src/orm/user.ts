// Imports
import bcrypt from 'bcrypt'
import Patient from './patient'
import Settings from './settings'
import PatientUser from './patient-user'
import { logger } from '../utils'
import { Entity, BaseEntity, Col, Met, commit } from '../orm'
import { VirtualPatient } from '../websocket/dev/client'
import { Entity as TxEntity, Id } from '../driver'
import Token from './token'
import TextMessage from './TextMessage'
import Notification from './notification'
import { kickAppClient } from '../websocket/app/client'
import { hash } from '../utils'

// 'user' is a reserved postgres name
@Entity({alias: 't_user'})
export default class User extends BaseEntity<User>() {
  @Col() first_name!: string
  @Col() last_name!: string
  @Col() email!: string
  @Col() phone!: string
  @Col() password!: string
  @Col() active!: boolean
  @Col({spec: 'id'}) settings_id!: Id

  /**
  * Creates a new User entity in the data store
  * Returns the corresponding User ORM instance
  *
  * @static @async
  * @param {string} firstName   User first name
  * @param {string} lastName    User last name
  * @param {string} email       User email
  * @param {string} phone       User phone
  * @param {string} password    User password (not hashed)
  * @param {boolean} active     User is checked or not
  * @returns {Promise<UserInstance>}    Promise of the corresponding User ORM instance
  */
  static async createNew (
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    password: string,
  ): Promise<User> {
    // Creates a new Settings entity
    const userSetting = await Settings.new({
      dark_mode: 'default',
      lang: 'default',
      dnd: false,
      notif_safe_zone_tracking: true,
      notif_offline_patient: true,
      notif_new_login: true,
      notif_setting_modified: true
    })
    await commit(userSetting)

    // Creates a new GCP key
    const user = await this.new({
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      password: hash(password),
      active: false,
      settings_id: userSetting.getKey()
    })

    // Saves user
    await commit(user)

    // Prints and returns
    logger.info(`User '${email}' created.`)
    return user
  }

  /**
  * Gets the existing User instance from DB with email and password
  *
  * @static @async
  * @param {string} email                   User email
  * @returns {Promise<User | undefined >}   Corresponding instance, or undefined if non-existing
  */
  static async getByEmail (email: string): Promise<User | undefined > {
    // Gets user with given email
    const matches = await this.query(q => q.where('email', '==', email))

    // Checks if not empty, checks password, and returns entity
    if (matches.length === 0)
      return undefined
    else
      return matches[0]
  }

  /**
  * Gets the existing User instance from DB with email and password
  *
  * @static @async
  * @param {string} email                   User email
  * @param {string} password                User password
  * @returns {Promise<UserInstance | undefined >}   Corresponding instance, or undefined if non-existing
  */
  static async getByEmailPassword (email: string, password: string): Promise<User | undefined > {
    // Gets user with given email
    const matches = await this.query(q => q.where('email', '==', email))

    const user = matches[0]

    // Checks if not empty, checks password, and returns entity
    if (matches.length === 0)
      return undefined
    else if (bcrypt.compareSync(password, user.password))
      return user
    else
      return undefined
  }

  /**
  * Determines if an user with the given email already exists in DB
  *
  * @static @async
  * @param {string} email         User email
  * @returns {Promise<boolean>}   True if it exists
  */
  static async exists (email: string): Promise<boolean> {
    // Gets user with given email
    const matches = await this.query(q => q.where('email', '==', email))

    // Returns true if not empty
    return matches.length > 0
  }

  /**
  * Returns patients json paired with the user
  * Fetches data from DB
  *
  * @async
  * @returns {Promise<Array<Any>>}  User paired patients
  */
  @Met()
  async getPatientsJson(): Promise<Array<any>> {
    const patientsUsers = await PatientUser.getByUserId(this.getKey())
    return await Promise.all(
      patientsUsers.map(async (patientUser) => {
        // Created a Patient ORM instance
        const patient = await Patient.fromKey(patientUser.patientId)
        // Returns the JSON
        return patient!.toJsonFull()
      })
    )
  }

  /**
  * Serializes object to JSON for more good looking http responses
  *
  * @remarks
  * The password and GCP key fields are omitted
  *
  * @returns {Promise<json>}  User as JSON
  */
  @Met()
  async toJsonFull(): Promise<any> {
    // Get settings JSON
    const userSettings = (await Settings.fromKey(this.settings_id))!

    // Gets patients JSONs
    const patientsJson = await this.getPatientsJson()
    const vpatients = await VirtualPatient.byUserId(this.getKey())

    // Converts dataclass to JSON
    const json: any = {
      id: this.getKey(),
      first_name: this.first_name,
      last_name: this.last_name,
      email: this.email,
      phone: this.phone,
      settings: userSettings.toJson(),
      active: this.active,
      patients: patientsJson,
      virtual_patients_ids: vpatients.map(v => v.patientId)
    }
    return json
  }

  @Met()
  async querySettings() {
    return (await Settings.fromKey(this.settings_id))!
  }

  @Met()
  fullName() {
    const res = `${this.first_name} ${this.last_name}`
    if (res === ' ')
      return 'Utilisateur'
    else
      return res
  }
  @Met()
  async getRecords(includePatients: boolean): Promise<[TxEntity[], (() => void)[]]> {
    let res: TxEntity[] = [this]
    let cbs: (() => void)[] = []
    if (includePatients) {
      const [r, c] = await this.getPatientRecords()
      res = res.concat(r)
      cbs = cbs.concat(c)
    }
    res = res.concat(await Token.query(q => q.where('userId', '==', this.id)))
    res.push((await Settings.fromKey(this.settings_id))!)
    res = res.concat(await TextMessage.query(q => q.where('user_id', '==', this.id)))
    res = res.concat(await Notification.query(q => q.where('user_id', '==', this.id)))
    const vps = await VirtualPatient.byUserId(this.id)
    res = res.concat(vps)
    for (const vp of vps) {
      const [r, c] = await (await Patient.fromKey(vp.patientId))!.getRecords()
      res = res.concat(r)
      cbs = cbs.concat(c)
    }
    cbs.push(() => kickAppClient(this.id))
    return [res, cbs]
  }

  @Met()
  async getPatientRecords(): Promise<[TxEntity[], (() => void)[]]> {
    let res: TxEntity[] = []
    let cbs: (() => void)[] = []
    for (const p of await PatientUser.getByUserId(this.id)) {
      const [r, c] = await (await Patient.fromKey(p.patientId))!.getRecords()
      res = res.concat(r)
      cbs = cbs.concat(c)
    }
    return [res, cbs]
  }
}

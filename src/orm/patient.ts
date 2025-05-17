// Internal imports
import { makeId, logger } from '../utils'
import { Entity, BaseEntity, Col, Met, commit } from '../orm'
import { Entity as TxEntity } from '../driver'
import { clients as wsDevClients } from '../websocket/dev/client'
import PatientUser from './patient-user'
import CalendarEvent from './calendar_event'
import PatientCalendarEvent from './patient-calendar_event'
import { timers } from '../timers'
import { PatientEvent } from './PatientEvent'
import { PatientZoneEvent } from './PatientZoneEvent'
import TextMessage from './TextMessage'
import { Zone } from './zone'
import { PatientState } from './PatientState'
import { Multiplexer } from '../services/main_multiplexer'

// Patient ORM constents
const PATIENT_SECRET_ID_LENGTH: number = 256
const PATIENT_DEFAULT_FIELD: string = ''
const PATIENT_DEFAULT_STATE: PatientState = 'unknown';

@Entity()
export default class Patient extends BaseEntity<Patient>() {
  @Col() secret_id!: string
  @Col() first_name!: string
  @Col() last_name!: string
  @Col() nick_name!: string
  @Col() birth_date!: string
  @Col({spec: 'float'}) battery!: number
  @Col() state!: PatientState

  /**
  * Generates a new unique secret id
  *
  * @private @static @async
  * @returns {Promise<string>}  Secret id
  */
  private static async makeSecretId(): Promise<string> {
    let tempSecretId: string
    let exists: boolean
    do {
      // Generates new id
      tempSecretId = makeId(PATIENT_SECRET_ID_LENGTH)

      const entity = await this.query(q => q.where('secret_id', '==', tempSecretId))
      // Checks if exists
      exists = entity.length > 0
    } while (exists)

    // Returns generated secret id
    return tempSecretId
  }

  /**
  * Creates a new Patient entity in the data store
  * Returns the corresponding Patient ORM instance
  *
  * @remarks
  * Fields are optionals
  *
  * @static @async
  * @param {string} firstName     Patient first name
  * @param {string} lastName      Patient last name
  * @param {string} nickName      Patient nick name
  * @param {string} birthDate     Patient birth date (RFC 3339 Format)
  * @param {number} battery       Patient device battery level
  * @returns {Promise<Patient>}   Patient ORM instance
  */
  static async createNew (
      battery: number,
      firstName: string = PATIENT_DEFAULT_FIELD,
      lastName: string = PATIENT_DEFAULT_FIELD,
      nickName: string = PATIENT_DEFAULT_FIELD,
      birthDate: string = PATIENT_DEFAULT_FIELD,
      state: PatientState = PATIENT_DEFAULT_STATE
    ): Promise<Patient> {
      // Creates a new GCP key and secret key
      const secretId = await this.makeSecretId()
      const patient = await this.new({
        secret_id: secretId,
        first_name: firstName,
        last_name: lastName,
        nick_name: nickName,
        birth_date: birthDate,
        battery: battery,
        state: state,
      })

      // Saves patient
      await commit(patient)

      await patient.createDefaultServices()

      // Prints and returns
      logger.info(`Patient '${patient.getKey()}' created.`)
      return patient
    }

  /**
  * Gets the Patient instance corresponding to the given secret id
  *
  * @static @async
  * @param {string} secretId                  Secret id to look for
  * @returns {Promise<Patient | undefined>}   Corresponding Patient ORM instance or undefined if not found
  */
  static async getBySecretId (
    secretId: string
  ): Promise<Patient | undefined> {
    // Gets entity
    const entity = await this.query(q => q.where('secret_id', '==', secretId))
    // Instanciates ORM
    if (entity.length > 0)
      return entity[0]
    else
      return undefined
  }

  static async setNewState(
    patientId: string,
    state: PatientState
  ) {
    let c = wsDevClients[patientId]
    let patient = await Patient.fromKey(patientId);

    if (patient === undefined)
      throw Error(`setNewState: Patient ${patientId} cannot be found`)

    patient.state = state;
    await commit(patient);
    if (c !== undefined)
      c.newState(patient.state);
  }

  @Met()
  fullName() {
    const res = `${this.first_name} ${this.last_name}`
    if (res === ' ')
      return 'Votre usager'
    else
      return res
  }

  @Met()
  toJsonFull() {
    const base = this.toJson()
    const c = wsDevClients[this.getKey()]
    base.online = c !== undefined
    base.batteryLevel = c?.getBatteryLevel() || this.battery
    return base
  }

  @Met()
  async getRecords(): Promise<[TxEntity[], (() => void)[]]> {
    let res: TxEntity[] = [this]
    let cbs: (() => void)[] = []
    res = res.concat(await PatientUser.query(q => q.where('patientId', '==', this.id)))
    const pces = await PatientCalendarEvent.query(q => q.where('patientId', '==', this.id))
    res = res.concat(pces)
    for(const pce of pces) {
      const ce = (await CalendarEvent.fromKey(pce.calendarEventId))!
      res.push(ce)
      cbs.push(() => timers.removeEvent(ce))
    }
    res = res.concat(await PatientEvent.query(q => q.where('patient_id', '==', this.id)))
    res = res.concat(await PatientZoneEvent.query(q => q.where('patient_id', '==', this.id)))
    res = res.concat(await TextMessage.query(q => q.where('patient_id', '==', this.id)))
    res = res.concat(await Zone.query(q => q.where('patient_id', '==', this.id)))
    const wc = wsDevClients[this.id]
    if (wc !== undefined)
      cbs.push(() => wc.close())
    return [res, cbs]
  }

  @Met()
  async createDefaultServices() {
    await Multiplexer.addService(this.id, 'INTENT', {intent: 'time'}, 'SAY_TIME', {})
    await Multiplexer.addService(this.id, 'INTENT', {intent: 'date'}, 'SAY_DATE', {})
    await Multiplexer.addService(this.id, 'INTENT', {intent: 'forecast'}, 'SAY_FORECAST', {})
    await Multiplexer.addService(this.id, 'INTENT', {intent: 'list_forgotten'}, 'LIST_FORGOTTEN', {items: []})
    await Multiplexer.addService(this.id, 'INTENT', {intent: 'delete_forgotten'}, 'DELETE_FORGOTTEN', {})
    await Multiplexer.addService(this.id, 'INTENT', {intent: 'guide_home'}, 'GUIDE_HOME', {})
  }
}

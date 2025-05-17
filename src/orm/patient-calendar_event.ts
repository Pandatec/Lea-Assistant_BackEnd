import { logger } from '../utils'
import { Entity, BaseEntity, Col, commit } from '../orm'
import { Id } from '../driver'

@Entity()
export default class PatientCalendarEvent extends BaseEntity<PatientCalendarEvent>() {
  @Col({spec: 'id'}) patientId!: Id
  @Col({spec: 'id'}) calendarEventId!: Id

  /**
  * Creates a new Patient-CalendarEvent entity in the data store
  * Returns the corresponding Patient-CalendarEvent ORM instance
  *
  * @static @async
  * @param {Id} patientId         Patient-CalendarEvent patientId
  * @param {Id} calendarEventId   Patient-CalendarEvent calendarEventId
  * @returns {Promise<PatientCalendarEvent>}   Promise of the corresponding Patient-CalendarEvent ORM instance
  */
  static async createNew (
    patientId: Id,
    calendarEventId: Id
  ): Promise<PatientCalendarEvent> {
    // Creates a new GCP key
    const patientCalendarEvent = await this.new({
      patientId: patientId,
      calendarEventId: calendarEventId
    })

    await commit(patientCalendarEvent)

    // Prints and returns
    logger.info(`Patient-CalendarEvent '${patientCalendarEvent.getKey()}' created`)
    return (patientCalendarEvent)
  }

  /**
  * Gets the PatientCalendarEvent instance corresponding to the given Patient
  *
  * @static @async
  * @param {Id} patientId                              patient id to look for
  * @returns {Promise<PatientCalendarEvent[]>}  Corresponding PatientCalendarEvent ORM instance or undefined if not found
  */
   static async getByPatientId (
    patientId: Id
  ): Promise<PatientCalendarEvent[]> {
    // Gets entity
    return await this.query(q => q.where('patientId', '==', patientId))
  }

  /**
  * Gets the PatientCalendarEvent instance corresponding to the given User
  *
  * @static @async
  * @param {Id} patientId                                Event id to look for
  * @returns {Promise<PatientCalendarEvent | undefined>}   Corresponding PatientCalendarEvent ORM instance or undefined if not found
  */
   static async getByCalendarEventId (
    calendarEventId: Id
  ): Promise<PatientCalendarEvent | undefined> {
    // Gets entity
    const entities = await this.query(q => q.where('calendarEventId', '==', calendarEventId))
    // Instanciates ORM
    if (entities.length > 0)
      return entities[0]
    else
      return undefined
  }

  static async exists (
    patientId: Id,
    calendarEventId: Id
  ): Promise<boolean> {
    const entities = await this.query(q => q
      .where('calendarEventId', '==', calendarEventId)
      .where('patientId', '==', patientId)
    )

    // Check if entity exists
    return entities.length > 0
  }
}

export async function isAssociated(calendarEventId: Id, patientId: Id): Promise<boolean> {
  const patientsEvents = await PatientCalendarEvent.getByPatientId(patientId)

  let found = false
  for (let i = 0; i < patientsEvents.length; i++) {
    if (patientsEvents[i].calendarEventId === calendarEventId) {
      found = true
    }
  }
  return found
}

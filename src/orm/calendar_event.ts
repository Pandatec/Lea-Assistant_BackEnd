import { Entity, BaseEntity, Col, commit, vs, vs_danger } from '../orm'
import { logger } from '../utils'

@Entity()
export default class CalendarEvent extends BaseEntity<CalendarEvent>() {
  @Col() type!: string
  @Col() datetime!: number
  @Col() duration!: number
  @Col({val: v => vs_danger.object(v) && vs_danger.key_count(2)(v)
    && vs.string(v['title'])
    && vs.string(v['desc'])
  })
  data!: any
  @Col() issuer!: string

  /**
    * Creates a new CalendarEvent entity in the data store
    * Returns the corresponding CalendarEvent ORM instance
    *
    * @remarks
    * Fields are optionals
    *
    * @static @async
    * @param {string} type                CalendarEvent type (REMINDER or EVENT)
    * @param {number} datetime            CalendarEvent date and time (timestamp)
    * @param {number} duration            CalendarEvent duration (timestamp)
    * @param {any} data                CalendarEvent additional data
    * @param {string} issuer              CalendarEvent Issuer GCP ID (either User or Patient)
    * @returns {Promise<CalendarEvent>}   CalendarEvent ORM instance
    */
    static async createNew (
      type: string,
      datetime: number,
      duration: number,
      data: any,
      issuer: string,
    ): Promise<CalendarEvent> {
      // Creates a new GCP key and secret key
      const calendarEvent = await this.new({
        type: type,
        datetime: datetime,
        duration: duration,
        data: data,
        issuer: issuer
      })

      await commit(calendarEvent)
  
      // Prints and returns
      logger.info(`CalendarEvent '${calendarEvent.getKey()}' created.`)
      return (calendarEvent)
    }

  /**
  * Gets the CalendarEvent instances where the datetime is between startTime and endTime
  *
  * @static @async
  * @param {number} startTime   Lower limit of the range
  * @param {number} endTime     Upper limit of the range
  * @returns {Promise<CalendarEventInstance[]>}   Corresponding CalendarEvent ORM instances between time range
  */
  static async getAllWithinTimeRange (
    startTime: number,
    endTime: number
  ): Promise<CalendarEvent[]> {
    // Gets entity
    const entities = await this.query(q => q
      .where('datetime', '>=', startTime)
      .where('datetime', '<=', endTime)
    )

    // Instanciates ORM
    return (entities)
  }
}
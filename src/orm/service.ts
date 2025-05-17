import { logger } from '../utils'
import { Entity, BaseEntity, Col, commit, vs_danger, Met } from '../orm'
import { TriggerType } from '../services/main_multiplexer'
import { Id } from '../driver'
import { ActionType } from '../services/actions/action_list'
import { createRunningService, RunningService } from '../services/running/running'

export type Trigger = {
  type: TriggerType
  payload: {}
}

export type ServiceAction = {
  type: ActionType
  payload: {}
}

@Entity()
export class Service extends BaseEntity<Service>() {
  @Col({spec: 'id'}) patientId!: Id
  @Col({val: v => vs_danger.object(v)}) trigger!: Trigger
  @Col({val: v => vs_danger.object(v)}) action!: ServiceAction

  /**
  * Creates a new Service entity in the data store
  * Returns the corresponding Service ORM instance
  *
  * @public @static @async
  * @param {Id} patientId - Id of the patient
  * @param {Trigger} trigger - The service trigger
  * @param {Action} action - The service action
  * @returns {Promise<Service>} - Promise of the corresponding Service ORM instance
  */
  static async createNew(patientId: Id, trigger: Trigger, action: ServiceAction) {
    // Creates a new GCP key
    const service = this.new({
      patientId: patientId,
      trigger: trigger,
      action: action
    })

    // Saves patient-user
    await commit(service)

    // Prints and returns
    logger.info(`Service '${service.getKey()}' created`)
    return service
  }

  static async GetAll() : Promise<Service[]> {
    return await this.query()
  }

  static async GetById(id: Id) : Promise<Service | undefined> {
    const matches = await this.query(q => q.where('id', '==', id))
    
    const service = matches[0]

    // Checks if not empty
    if (matches.length === 0)
      return undefined
    else
      return service
  }

  static async GetByPatientId(patientId: Id) : Promise<Service[]> {
    return await this.query(q => q.where('patientId', '==', patientId))
  }

  runningService?: RunningService

  /**
   * Acquire in-memory service and run it
   * @note Make sure the same service is not live on more than a single instance
   * For example retrieving the service from the DB by itself shall not run it,
   * hence why this is not called in the constructor. Though this MUST be called
   * only once when inserted into its multiplexer and `this.stop()` called when
   * removed.
   */
  @Met()
  run() {
    // Note that this does not check if two instances of the same service are running
    // at the same time, which MUST never happen. Be careful out there
    if (this.runningService !== undefined)
      throw new Error(`Same instance of service ${this.id} being run twice`)
    this.runningService = createRunningService(this)
  }

  /**
   * Stop in-memory service and release it
   */
  @Met()
  stop() {
    this.runningService?.release()
    this.runningService = undefined
  }
}

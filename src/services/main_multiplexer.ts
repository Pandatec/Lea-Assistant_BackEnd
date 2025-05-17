import { ZoneTypeMultiplexer } from './zone_type_multiplexer'
import { BaseMultiplexer } from './base_multiplexer'
import { Service } from '../orm/service'
import { logger } from '../utils'
import { ActionList, ActionType } from './actions/action_list'
import { IntentMultiplexer } from './intent_multiplexer'
import { PeriodicMultiplexer } from './periodic_multiplexer'
import { TimeRangeMultiplexer } from './time_range_multiplexer'
enum TriggerTypeEnum {
  INTENT,
  ZONE_TYPE_CHANGED,
  ZONE_CHANGED,
  PERIODIC,
  TIME_RANGE
}

export type TriggerType = keyof typeof TriggerTypeEnum

export class MainMultiplexer {
  private zoneType: ZoneTypeMultiplexer
  private intent: IntentMultiplexer
  private periodic: PeriodicMultiplexer
  private timeRange: TimeRangeMultiplexer
  
  constructor() {
    this.zoneType = new ZoneTypeMultiplexer()
    this.intent = new IntentMultiplexer()
    this.periodic = new PeriodicMultiplexer()
    this.timeRange = new TimeRangeMultiplexer()
  }

  async init(): Promise<void> {
  }

  async loadForPatient(patientId: string) {
		const services = await Service.query(q => q.where('patientId', '==', patientId))
    const zoneChangedServices: Service[] = []
    const intentServices: Service[] = []
    const periodicServices: Service[] = []
    const timeRangeServices: Service[] = []
    services.forEach(s => {
      switch (s.trigger.type) {
        case 'ZONE_TYPE_CHANGED':
          zoneChangedServices.push(s)
          break
        case 'INTENT':
          intentServices.push(s)
          break
        case 'PERIODIC':
          periodicServices.push(s)
          break
        case 'TIME_RANGE':
          timeRangeServices.push(s)
          break
      }
    })
    this.zoneType.init(zoneChangedServices)
    this.intent.init(intentServices)
    this.periodic.init(periodicServices)
    this.timeRange.init(timeRangeServices)
  }

  async unloadForPatient(patientId: string) {
    this.zoneType.uninit(patientId)
    this.intent.uninit(patientId)
    this.periodic.uninit(patientId)
    this.timeRange.uninit(patientId)
  }

  private getMultiplexer(type: TriggerType) : BaseMultiplexer | undefined {
    switch (type) {
      case 'ZONE_TYPE_CHANGED':
        return this.zoneType
      case 'INTENT':
        return this.intent
      case 'PERIODIC':
        return this.periodic
      case 'TIME_RANGE':
        return this.timeRange
      default:
        return undefined
    }
  }

  public async addService(patientId: string, type: TriggerType, triggerPayload: {}, actionType: ActionType, actionPaylaod: {}) : Promise<Service | undefined> {
    const serviceMultiplexer = this.getMultiplexer(type)
    if (serviceMultiplexer !== undefined)
      return await serviceMultiplexer.add(patientId, triggerPayload, actionType, actionPaylaod)
    else {
      logger.warn(`Service type ${type} does not exist`)
      return undefined
    }
  }

  public async deleteServiceById(id: string) {
    const service = await Service.GetById(id)
    if (service === undefined) {
      logger.warn(`Service with id ${id} does not exist`)
      return
    }
    this.deleteService(service)
  }

  public async deleteService(service: Service) {
    const serviceMultiplexer = this.getMultiplexer(service.trigger.type)
    if (serviceMultiplexer !== undefined)
      await serviceMultiplexer.delete(service)
    else
      logger.warn(`Service type ${service.trigger.type} does not exist`)
  }

  public async checkTrigger(patientId: string, type: TriggerType, payload: {}) {
    const eventMultiplexer = this.getMultiplexer(type)
    if (eventMultiplexer !== undefined)
      await eventMultiplexer.checkTrigger(patientId, payload)
    else
      logger.warn(`Event type ${type} does not exist`)
  }

  async runAction(service: Service, isEnd: boolean = false) {
    const type = service.action.type
    const action = ActionList.get(type)
    if (action !== undefined)
      await action.trigger(service.patientId, service.action.payload, isEnd)
    else
      logger.warn(`Patient '${service.patientId}': unknown action '${type}', is it implented?`)
  }
}

export const Multiplexer = new MainMultiplexer()

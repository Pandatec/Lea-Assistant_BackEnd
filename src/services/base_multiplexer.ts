import { remove } from '../orm'
import { Service, Trigger, ServiceAction } from '../orm/service'
import { logger, removeFromArray } from '../utils'
import { Multiplexer, TriggerType } from './main_multiplexer'
import { ActionList, ActionType } from './actions/action_list'

export abstract class BaseMultiplexer {
  protected services: Map<string, Service[]>
  protected type: TriggerType

  constructor(type: TriggerType) {
    this.services = new Map<string, Service[]>()
    this.type = type
  }

  async init(services: Service[]) : Promise<void> {
    services.forEach(s => {
      const patientServices = this.services.get(s.patientId)
      s.run()
      if (patientServices === undefined)
        this.services.set(s.patientId, [s])
      else
        this.services.set(s.patientId, [...patientServices, s])
    })
  }

  async uninit(patientId: string) {
    const patientServices = this.services.get(patientId)
    if (patientServices === undefined)
      return
    for (const s of patientServices)
      s.stop()
    this.services.set(patientId, [])
  }

  async add(patientId: string, triggerPayload: {}, actionType: ActionType, actionPaylaod: {}) : Promise<Service> {
    const service = await Service.createNew(patientId, {type: this.type, payload: triggerPayload} as Trigger, {type: actionType, payload: actionPaylaod} as ServiceAction)
    const patientServices = this.services.get(patientId)
    service.run()
    if (patientServices === undefined)
      this.services.set(patientId, [service])
    else
      this.services.set(patientId, [...patientServices, service])
    return service
  }

  async delete(service: Service) {
    await remove(service)
    const patientServices = this.services.get(service.patientId)
    if (patientServices === undefined)
      return
    const toDelete = patientServices.find(e => e.id === service.id)
    if (toDelete === undefined)
      return
    toDelete.stop()
    const newServices = patientServices.filter(e => e !== toDelete)
    this.services.set(service.patientId, newServices)
  }

  async checkTrigger(patientId: string, payload: {}) {
    const patientServices = this.services.get(patientId)
    if (patientServices === undefined)
      return
    for (let i = 0; i < patientServices.length; i++) {
      if (this.checkPayload(payload, patientServices[i].trigger.payload))
        Multiplexer.runAction(patientServices[i], false)
    }
  }

  abstract checkPayload(sent_payload: {}, payload: {}): boolean
}

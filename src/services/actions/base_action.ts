import { Locale } from './action_list'

export abstract class Action {
  abstract trigger(patientId: string, payload: {}, isEnd: boolean) : Promise<void>
  abstract checkPayload(payload: {}) : boolean
  abstract locale: Map<Locale, string>
  abstract payload: {}
}

import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class GuideHome extends Action {

  locale: Map<Locale, string>
  payload: {}

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Guide home')
    this.locale.set('FR', 'Raccompagner à la maison')
    this.payload = {}
  }

  checkPayload(payload: {}) : boolean {
    return Object.keys(payload).length === 0
  }

  async trigger(patientId: string, payload: {}, isEnd: boolean) : Promise<void> {
    if (isEnd)
      return
    /*if (!this.checkPayload(payload)) {
      logger.warn('Payload error')
      return
    }*/
    const client = clientFromPatientId(patientId)
    if (client === undefined)
      return

    client.speak({text: 'Je vais vous raccompagner chez vous', isPublic: true})
    client.gps.start()
  }
}

import { getDateNowParis, logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class SayTime extends Action {

  locale: Map<Locale, string>
  payload: {}

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Tell the time')
    this.locale.set('FR', "Dit l'heure")
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

    const date = getDateNowParis()

    const client = clientFromPatientId(patientId)
    if (client !== undefined) {
      await client.speak(
        {text: 'Il est', isPublic: true},
        {text: date.getHours().toString(), isPublic: true},
        {text: 'heures', isPublic: true},
        {text: date.getMinutes().toString(), isPublic: true}
      )
    }
  }
}

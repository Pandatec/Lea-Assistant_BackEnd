import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class SayMessage extends Action {

  locale: Map<Locale, string>
  payload: {
    text: string
  }

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Say a message')
    this.locale.set('FR', 'Dit un message')
    this.payload = {
      text: ""
    }
  }

  checkPayload(payload: {}) : boolean {
    return Object.keys(payload).length === 1
  }

  async trigger(patientId: string, payload: {text: string}, isEnd: boolean) : Promise<void> {
    if (isEnd)
      return

    if (!this.checkPayload(payload)) {
      logger.warn(`SayMessage: Payload error for patient ${patientId} (have '${JSON.stringify(payload)}')`)
      return
    }

    const client = clientFromPatientId(patientId)
    if (client !== undefined)
      await client.speak({text: payload.text, isPublic: false})
  }
}

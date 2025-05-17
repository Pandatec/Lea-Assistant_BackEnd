import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class LockNeutral extends Action {

  locale: Map<Locale, string>
  payload: {}

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Lock neutral zones')
    this.locale.set('FR', 'Vérouiller les zones neutres')
    this.payload = {}
  }

  checkPayload(payload: {}) : boolean {
    return Object.keys(payload).length === 0
  }

  async trigger(patientId: string, payload: {}, isEnd: boolean) : Promise<void> {
    /*if (!this.checkPayload(payload)) {
      logger.warn('Payload error')
      return
    }*/

    const client = clientFromPatientId(patientId)
    if (client === undefined)
      return

    client.setNeutralDangerous(!isEnd)
    if (isEnd)
      await client.speak({text: "Zones neutres déverouillées. Sentez-vous libre de faire un tour dehors !", isPublic: true})
    else
      await client.speak({text: "Zones neutres verouillées. Il est conseillé de rester en lieu sûr.", isPublic: true})
  }
}

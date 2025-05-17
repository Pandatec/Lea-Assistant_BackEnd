import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'
import ForgottenItems from '../../orm/ForgottenItems'
import { number, string } from 'joi'
import { commit, remove } from '../../orm'

export class DeleteForgotten extends Action {

  locale: Map<Locale, string>
  payload!: {}

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Forgotten item deletion')
    this.locale.set('FR', 'Suppression des oublis')
  }

  checkPayload(payload: {}) : boolean {
      return Object.keys(payload).length === 0
  }

  async trigger(patientId: string, payload: {}, isEnd: boolean) : Promise<void> {
    if (isEnd)
      return
    const items = await ForgottenItems.allForPatientId(patientId)
    const client = clientFromPatientId(patientId)
    if (client === undefined)
      return

    await remove(...items)
    await client.speak({text: `J'ai supprimé ${items.length} objets oubliés`, isPublic: true})
  }
}

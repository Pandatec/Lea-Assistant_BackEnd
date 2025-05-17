import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'
import ForgottenItems from '../../orm/ForgottenItems'
import { number, string } from 'joi'

export class ListForgotten extends Action {

  locale: Map<Locale, string>
  payload!: {
    items: string[]
  }

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Do not forget to take your: ')
    this.locale.set('FR', 'N\'oubliez pas vos: ')
  }

  checkPayload(payload: any) : boolean {
      return Object.keys(payload).length === 1 && payload['items'] !== undefined
  }

  async trigger(patientId: string, payload: {items: string[]}, isEnd: boolean) : Promise<void> {
    if (isEnd)
      return
    if (!this.checkPayload(payload)) {
      logger.warn(`ListForgotten: Payload error for patient ${patientId} (have '${JSON.stringify(payload)}')`)
      return
    }

    const items = await ForgottenItems.allForPatientId(patientId)
    const client = clientFromPatientId(patientId)
    if (client === undefined)
      return

    const to_speak: string[] = []
    for (const item of payload.items)
      to_speak.push(item)
    for (const item of items)
      to_speak.push(item.name)

    if (to_speak.length > 0) {
      await client.speak({text: 'Vous oubliez les objets suivants', isPublic: true})
      for (const item of to_speak)
        await client.speak({text: item, isPublic: false})
    } else
      await client.speak({text: "Vous n'avez pas encore d'objet oublié défini", isPublic: true})
  }
}

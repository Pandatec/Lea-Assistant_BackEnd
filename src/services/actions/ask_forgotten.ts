import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class AskForgotten extends Action {

    locale: Map<Locale, string>
    payload: {}
  
    constructor() {
      super()
      this.locale = new Map<Locale, string>()
      this.locale.set('EN', 'Asking your forgotten')
      this.locale.set('FR', 'Demande de vos oublie')
      this.payload = {}
    }

    checkPayload(payload: {}) : boolean {
        return Object.keys(payload).length === 0
    }

    async trigger(patientId: string, payload: {}, isEnd: boolean) : Promise<void> {
      if (isEnd)
        return
      const client = clientFromPatientId(patientId)
      if (client !== undefined)
        await client.speak({text: "Donnez-moi vos oublis en disant : \"J'ai oublié\" suivis de vos oublis", isPublic: false})
    }
}
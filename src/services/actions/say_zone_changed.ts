import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'
import { ZoneSafetyType } from "../../../src/orm/ZoneSafety";

export class SayZoneChanged extends Action {

  locale: Map<Locale, string>
  payload: {
    zonetype: ZoneSafetyType,
  }

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Indicate a zone change')
    this.locale.set('FR', 'Indique un changement de zone')
    this.payload = {
        zonetype: 'safe',
    }
  }

  checkPayload(payload: any) : boolean {
    return Object.keys(payload).length === 1 && payload['zonetype'] !== undefined
  }

  async trigger(patientId: string, payload: {zonetype: ZoneSafetyType}, isEnd: boolean) : Promise<void> {
    if (isEnd)
      return
    if (!this.checkPayload(payload)) {
      logger.warn(`SayZoneChanged: Payload error for patient ${patientId} (have '${JSON.stringify(payload)}')`)
      return
    }

    const client = clientFromPatientId(patientId)
    let msg = ''
    if (client !== undefined) {
        switch (payload.zonetype) {
            case 'home':
                msg = 'Bon retour chez vous'
                break;
            case 'safe':
                msg = 'Vous etes en zone securisée'
                break;
            case 'danger':
                msg = 'Attention vous entrez dans une zone dangeureuse, faite attention à vous, Lea se propose de vous guider en sûreté'
                break;      
            default:
                msg = 'Vous venez de changer de zone'
                break;
        }
      await client.speak(
        {text: msg, isPublic: true},

      )
    }
  }
}

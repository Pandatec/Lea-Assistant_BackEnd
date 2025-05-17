import { getDateNowParis, logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class SayDate extends Action {

  locale: Map<Locale, string>
  payload: {}

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Tell the date')
    this.locale.set('FR', 'Dit la date')
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

    const numberToDay = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi'
    ]

    const numberToMonth = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre'
    ]

    const client = clientFromPatientId(patientId)
    if (client !== undefined) {
      await client.speak(
        {text: 'Nous sommes le', isPublic: true},
        {text: numberToDay[date.getDay()], isPublic: true},
        {text: date.getDate().toString(), isPublic: true},
        {text: numberToMonth[date.getMonth()], isPublic: true},
        {text: date.getFullYear().toString(), isPublic: true}
      )
    }
  }
}

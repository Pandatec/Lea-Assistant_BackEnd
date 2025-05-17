import { LatLng } from '../../orm/zone'
import { logger } from '../../utils'
import { clientFromPatientId } from '../../websocket/dev/client'
import { Locale } from './action_list'
import { Action } from './base_action'

export class SayForecast extends Action {

  locale: Map<Locale, string>
  payload: {}

  constructor() {
    super()
    this.locale = new Map<Locale, string>()
    this.locale.set('EN', 'Say the weather forecast')
    this.locale.set('FR', 'Dit les prévisions météos')
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
    const origin: LatLng | undefined = client?.getPos()


    if (client !== undefined) {
      if (origin === undefined) {
        logger.warn(`undefined origin`)
        await client.speak({text: `Je n'ai pas trouvé votre position`, isPublic: true})
        return
      }

      const meteo = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${origin.lat}&lon=${origin.lng}&lang=fr&appid=7b53c5580d758d146aa23a8e3a87ce1c`)
      const data = await meteo.json()

      if (data === undefined) {
        logger.warn(`undefined response from openweathermap`)
        await client.speak({text: `Je n'ai pas pu trouver la météo pour votre position`, isPublic: true})
        return
      }
      await client.speak(
        {text: "Voici la météo pour aujourd'hui", isPublic: true},
        {text: data.weather[0].description, isPublic: false}
      )
    }
  }
}

import { Client } from './websocket/dev/client'
import { logger } from './utils'
import { commit } from './orm'
import ForgottenItems from './orm/ForgottenItems'

export class Forgotten {
    client: Client

    constructor(client: Client) {
        this.client = client

        if (this.client === undefined)
            logger.warn(`Can not find any valid WS connexion for patient ${client.getPatientId()} !`)
    }

    public async add(patientId: string, itemname: string) {
        const i = await ForgottenItems.checkallForPatientIdAndName(patientId, itemname)
        logger.info(JSON.stringify(i))
        if (i.length == 0) {
          const item = ForgottenItems.new({
            patient_id: patientId,
            name: itemname,
            weigth: 1
            }
          )
          await commit(item)
        } else {
          i.forEach((item: { weigth: number }) => {
            item.weigth = this.normalize(item.weigth + 1, 1, 0) // normalize doing nothing currently need to get max_array & min_array
          });
          await commit(...i)
        }
    }
    private normalize(val: number, max: number, min: number) {
      return (val - min) / (max - min);
    }
}
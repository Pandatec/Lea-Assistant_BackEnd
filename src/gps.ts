import { Client } from './websocket/dev/client'
import { logger } from './utils'
import { LatLng, Zone } from './orm/zone'
import { count } from 'console'


export class Gps {
    client: Client
    house: LatLng | undefined
    idx: number
    steps: string[]
    timeout: NodeJS.Timeout | undefined

    constructor(client: Client) {
        this.client = client
        this.idx = 0
        this.steps = []

        if (this.client === undefined)
            logger.warn(`Can not find any valid WS connexion for patient ${client.getPatientId()} !`)
    }

    public async start() {
        this.house = await Zone.getHomeCenter(this.client.getPatientId())
        const origin: LatLng | undefined = this.client?.getPos()

        if (this.timeout !== undefined) {
            logger.warn('already a gps')
            await this.client.speak({text: 'vous avez deja un trajet en cours', isPublic: true})
            return
        }
        if (origin === undefined) {
            logger.warn(`undefined origin`)
            await this.client.speak({text: `nous n'avons pas trouvé votre position`, isPublic: true})
            return
        }
        if (this.house === undefined) {
            logger.warn(`undefined house`)
            await this.client.speak({text: `nous n'avons pas trouvé votre maison`, isPublic: true})
            return
        }
        const route = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${this.house.lat},${this.house.lng}&mode=walking&language=fr&key=AIzaSyBTCxQRdzLtXeqg73gek1n1xkh0FsmAhG8`)

        const data = await route.json()

        if (data.routes === undefined || data.routes[0].legs === undefined) {
            logger.warn('GPS API call error')
            await this.client.speak({text: "Nous ne pouvons vous ramener chez vous", isPublic: true})
            return
        }

        for (let i = 0; i < data.routes[0].legs[0].steps.length; i++)
            this.steps.push(data.routes[0].legs[0].steps[i].html_instructions.replace(/(&nbsp;|<([^>]+)>)/ig, ' '))

        await this.client.speak({text: 'très bien, je vais vous racompagner', isPublic: true})
        this.step()
        this.timeout = setInterval(() => this.step(), 15000)
    }

    public async step() {
        if (this.idx < this.steps.length)
          await this.client.speak({text: this.steps[this.idx++], isPublic: false})
        else
          this.stop()
    }

    public stop() {
        if (this.timeout !== undefined)
            clearInterval(this.timeout)
        this.timeout = undefined
        this.steps = []
        this.idx = 0
    }
}
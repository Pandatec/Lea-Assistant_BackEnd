import { BaseMultiplexer } from './base_multiplexer'

type Payload = {
  intent: string
}

export class IntentMultiplexer extends BaseMultiplexer {
  constructor() {
    super('INTENT')
  }

  checkPayload(sent_payload: Payload, payload: Payload): boolean {
    return sent_payload.intent === payload.intent
  }
}

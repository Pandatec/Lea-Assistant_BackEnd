import { BaseMultiplexer } from './base_multiplexer'

export class PeriodicMultiplexer extends BaseMultiplexer {
  constructor() {
    super('PERIODIC')
  }

  checkPayload(sent_payload: {}, payload: {}): boolean {
    return true
  }
}

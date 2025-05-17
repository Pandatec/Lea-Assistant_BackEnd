import { ZoneSafetyType } from '../orm/ZoneSafety'
import { BaseMultiplexer } from './base_multiplexer'

type Payload = {
  zone_in: ZoneSafetyType | undefined,
  zone_out: ZoneSafetyType | undefined
}

export class ZoneTypeMultiplexer extends BaseMultiplexer {
  constructor() {
    super('ZONE_TYPE_CHANGED')
  }

  checkPayload(sent_payload: Payload, payload: Payload): boolean {
    return sent_payload.zone_in === payload.zone_in && sent_payload.zone_out === payload.zone_out
  }
}

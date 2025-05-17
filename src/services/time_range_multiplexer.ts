import { BaseMultiplexer } from './base_multiplexer'

type Payload = {
  activation_days: {
    mon: boolean,
    tue: boolean,
    wed: boolean,
    thu: boolean,
    fri: boolean,
    sat: boolean,
    sun: boolean
  },
  start: {
    hour: number,
    minute: number
  },
  end: {
    hour: number,
    minute: number
  }
}

export class TimeRangeMultiplexer extends BaseMultiplexer {
  constructor() {
    super('TIME_RANGE')
  }

  checkPayload(sent_payload: Payload, payload: Payload): boolean {
    return true
  }
}

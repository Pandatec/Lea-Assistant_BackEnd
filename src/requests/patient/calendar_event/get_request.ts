// Imports
import Koa from 'koa'
import CalendarEvent from '../../../orm/calendar_event'
import PatientCalendarEvent from '../../../orm/patient-calendar_event'
import { isPaired } from '../../../orm/patient-user'
import { BackError, getCurrentTime } from '../../../utils'
import { assertUserLoggedIn } from '../../user/util'

function getTimespanDefault(begin: any, end: any): [number, number] {
  if (typeof(begin) === 'string' && typeof(end) === 'string') {
    return [parseInt(begin), parseInt(end)]
  } else {
    const t = getCurrentTime()
    const w = 60 * 60 * 24 * 7
    return [t - 4 * w, t + 4 * w]
  }
}

const eventStride = 16

function filterEvents(ctx: Koa.Context, events: CalendarEvent[]) {
  const pstr = ctx.query.page
  if (pstr !== undefined) {
    if (typeof(pstr) !== 'string')
      throw new BackError(400, 'MISSING_FIELD')
    const page = parseInt(pstr)
    const off = page * eventStride
    return events.slice(off, off + eventStride)
  } else {
    const bs = ctx.query.date_begin
    const es = ctx.query.date_end
    const [b, e] = getTimespanDefault(bs, es)
    return events.filter(ev => ev.datetime >= b && ev.datetime <= e)
  }
}

async function getAllPatientEvents(patientId: string) {
  const patientCalendarEvents = await PatientCalendarEvent.getByPatientId(patientId)

  const res = await Promise.all(
    patientCalendarEvents.map(async patientEvent =>
      (await CalendarEvent.fromKey(patientEvent.calendarEventId))!
    )
  )
  // Asc
  return res.sort((a, b) => a.datetime - b.datetime)
}

/**
* CalendarEvent get request
*
* @remarks
* Endpoint: GET /patient/calendar_event/get
* Query parameters:
*   - patient_id (string)
*   - [opt]: page (number as string)
*   - [opt]: date_begin (number as string)
*   - [opt]: date_end (number as string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function calendarEventGet (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const patientId = ctx.query.patientId as string

  if (patientId === undefined || typeof(patientId) !== 'string') {
    throw new BackError(400, 'MISSING_FIELD')
  }

  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (! await isPaired(loggedUser.getKey(), patientId)) {
    throw new BackError(401, 'NOT_PAIRED')
  }

  const patientCalendarEvents = filterEvents(ctx, await getAllPatientEvents(patientId))

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'CalendarEvents informations fetched',
    events: patientCalendarEvents.map(e => e.toJson())
  }
}

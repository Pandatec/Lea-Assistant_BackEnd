// Imports
import Koa from 'koa'
import CalendarEvent from '../../../orm/calendar_event'
import PatientCalendarEvent from '../../../orm/patient-calendar_event'
import { isPaired } from '../../../orm/patient-user'
import { assertTextLimit, BackError } from '../../../utils'
import { commit } from '../../../orm'
import { assertUserLoggedIn } from '../../user/util'
import { timers } from './../../../timers'
import { calendarEventSubs } from '../../../websocket/app/client'

/**
* CalendarEvent edit request
*
* @remarks
* Endpoint: PATCH /patient/calendar_event/edit
* Query parameters:
*   - calendar_event_id (string)
*   - data (optional string)
*   - datetime (optional number)
*   - duration (optional number)
*   - type (optional string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function calendarEventEdit (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const calendarEventId = ctx.query.calendarEventId as string
  const data = ctx.request.body.data
  const datetime = ctx.request.body.datetime
  const duration = ctx.request.body.duration
  const type = ctx.request.body.type

  // Processes request
  if (calendarEventId === undefined || typeof(calendarEventId) !== 'string') {
    throw new BackError(400, 'MISSING_FIELD')
  } else if (data === undefined && datetime === undefined && duration === undefined && type === undefined) {
    throw new BackError(400, 'NO_FIELD')
  }

  // Gets patient ORM instance
  const calendarEvent = await CalendarEvent.fromKey(calendarEventId)

  // Checks patient id validity
  if (calendarEvent === undefined) {
    throw new BackError(400, 'UNKNOWN_PATIENT')
  }

  // Gets PatientCalendarEvent ORM
  const patientCalendarEvent = await PatientCalendarEvent.getByCalendarEventId(calendarEventId)
  const patientId = patientCalendarEvent!.patientId

  // Gets logged user and checks if paired with patient id
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), patientId)) {
    throw new BackError(401, 'NOT_PAIRED')
  }

  // Updates fields
  if (data) {
    calendarEvent.data = data
    const d = calendarEvent.data
    assertTextLimit(d.title, d.desc)
  }
  if (datetime) {
    calendarEvent.datetime = datetime

    // Delete or add event to batch
    if (timers.shouldBeInBatch(calendarEvent)) {
      timers.insertEvent(calendarEvent)
    } else {
      timers.removeEvent(calendarEvent)
    }
  }
  if (duration) {
    calendarEvent.duration = duration
  }
  if (type) {
    calendarEvent.type = type
	  assertTextLimit(calendarEvent.type)
  }

  await commit(calendarEvent)
  calendarEventSubs.send(patientCalendarEvent!.patientId, 'calendarEvent', {
    type: 'edited',
    event: calendarEvent.toJson()
  })

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `CalendarEvent ${calendarEvent.getKey()} succefully edited`,
    event: calendarEvent.toJson()
  }
}

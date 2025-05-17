// Imports
import Koa from 'koa'
import CalendarEvent from '../../../orm/calendar_event'
import PatientCalendarEvent from '../../../orm/patient-calendar_event'
import { isPaired } from '../../../orm/patient-user'
import { BackError } from '../../../utils'
import { remove } from '../../../orm'
import { assertUserLoggedIn } from '../../user/util'
import { timers } from '../../../timers'
import { calendarEventSubs } from '../../../websocket/app/client'

/**
* CalendarEvent delete request
*
* @remarks
* Endpoint: DELETE /patient/calendar_event/delete
* Query parameters:
*   - calendar_event_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the patient cencered by this calendar event
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function calendarEventDelete (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const calendarEventId = ctx.query.calendarEventId as string

  // Processes request
  if (calendarEventId === undefined || typeof(calendarEventId) !== 'string') {
    throw new BackError(400, 'MISSING_FIELD')
  }

  // Gets PatientCalendar ORM instance
  const patientCalendar = await PatientCalendarEvent.getByCalendarEventId(calendarEventId)

  // Checks patient calendar validity
  if (patientCalendar === undefined) {
    throw new BackError(400, 'UNKNOWN_CALENDAR_EVENT')
  }

  // Get patient concerned
  const patientId = patientCalendar.patientId

  // Gets logged user and checks if paired with patient id
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (! await isPaired(loggedUser.getKey(), patientId)) {
    throw new BackError(401, 'NOT_PAIRED')
  }

  // Gets the CalendarEvent
  let event = (await CalendarEvent.fromKey(calendarEventId))!

  // Deletes the CalendarEvent entry
  // Deletes the PatientCalendarEvent entry
  await remove(event, patientCalendar)
  timers.removeEvent(event)
  calendarEventSubs.send(patientCalendar.patientId, 'calendarEvent', {
    type: 'deleted',
    id: event.id
  })

  // Respond
  ctx.status = 201
  ctx.body = {
    status: 'OK',
    message: `CalendarEvent succefully deleted`
  }
}

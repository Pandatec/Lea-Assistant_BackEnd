// Imports
import Koa from 'koa'
import Patient from '../../../orm/patient'
import CalendarEvent from '../../../orm/calendar_event'
import PatientCalendarEvent from '../../../orm/patient-calendar_event'
import { isPaired } from '../../../orm/patient-user'
import { assertTextLimit, BackError } from '../../../utils'
import { assertUserLoggedIn } from '../../user/util'
import { timers } from './../../../timers'
import { calendarEventSubs } from '../../../websocket/app/client'

/**
* CalendarEvent create request
*
* @remarks
* Endpoint: POST /patient/calendar_event/create
* Query parameters:
*   - patient_id (string)
*   - type (string)
*   - datetime (number)
*   - duration (number)
*   - data (string)
*   - issuer (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function calendarEventCreate (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const patientId = ctx.query.patientId as string
  const type = ctx.request.body.type
  const datetime = ctx.request.body.datetime
  const duration = ctx.request.body.duration
  const data = ctx.request.body.data
  const issuer = ctx.request.body.issuer

  // Processes request
  if (patientId === undefined || typeof(patientId) !== 'string') {
    throw new BackError(400, 'MISSING_FIELD')
  } else if (type === undefined || datetime === undefined || duration === undefined || data === undefined || issuer === undefined) {
    throw new BackError(400, 'NO_FIELD')
  }

  // Gets patient ORM instance
  const patient = await Patient.fromKey(patientId)

  // Checks patient id validity
  if (patient === undefined) {
    throw new BackError(400, 'UNKNOWN_PATIENT')
  }

  // Gets logged user and checks if paired with patient id
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), patientId)) {
    throw new BackError(401, 'NOT_PAIRED')
  }

  assertTextLimit(type, data.title, data.desc, issuer)
  // Creates new CalendarEvent
  let event = await CalendarEvent.createNew(type, datetime, duration, data, issuer)

  // Add to timers batch if needed
  if (timers.shouldBeInBatch(event)) {
    timers.insertEvent(event)
  }

  // Creates the corresponding Patient-CalendarEvent association
  await PatientCalendarEvent.createNew(patientId, event.getKey())
  calendarEventSubs.send(patientId, 'calendarEvent', {
    type: 'created',
    event: event.toJson()
  })

  // Respond
  ctx.status = 201
  ctx.body = {
    status: 'OK',
    message: `CalendarEvent ${event.getKey()} succefully created`,
    event: event.toJson()
  }
}

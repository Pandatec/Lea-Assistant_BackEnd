// Imports
import Koa from 'koa'
import Patient from '../../orm/patient'
import PatientUser, { isPaired } from '../../orm/patient-user'
import { BackError, logger } from '../../utils'
import { commit } from '../../orm'
import { assertUserLoggedIn } from '../user/util'
import { VirtualPatient } from '../../websocket/dev/client'
import { PatientEvent } from '../../orm/PatientEvent'

/**
* Patient edit request
*
* @remarks
* Endpoint: PATCH /patient/edit
* Query parameters:
*   - patient_id (string)
*   - first_name (optional string)
*   - last_name (optional string)
*   - nick_name (optional string)
*   - birth_date (optional string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function patientEdit (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const patientId = ctx.query.patientId as string
  const firstName = ctx.request.body.first_name
  const lastName = ctx.request.body.last_name
  const nickName = ctx.request.body.nick_name
  const birthDate = ctx.request.body.birth_date

  // Processes request
  if (patientId === undefined || typeof(patientId) !== 'string') {
    throw new BackError(400, 'MISSING_FIELD')
  } else if (firstName === undefined && lastName === undefined && nickName === undefined && birthDate === undefined) {
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

  // Updates fields
  if (firstName) {
    patient.first_name = firstName
  }
  if (lastName) {
    patient.last_name = lastName
  }
  if (nickName) {
    patient.nick_name = nickName
  }
  if (birthDate) {
    patient.birth_date = birthDate
  }

  await commit(patient)

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Patient ${patient.getKey()} succefully edited`,
    patient: patient.toJson()
  }
}

/**
* Patient virtual create request
*
* @remarks
* Endpoint: POST /patient/virtual
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function createPatientVirtual(ctx: Koa.Context): Promise<void> {
  const loggedUser = await assertUserLoggedIn(ctx)
  // Remove existing virtual patient: only one allowed per user
  await VirtualPatient.removeAllFor(loggedUser.getKey())

  const patient = await Patient.createNew(1.0)
  const virtual = VirtualPatient.new({
    userId: loggedUser.getKey(),
    patientId: patient.getKey()
  })
  const pairing = PatientUser.new({
    userId: loggedUser.getKey(),
    patientId: patient.getKey()
  })
  const event = PatientEvent.now(patient.getKey(), 'pairing_accepted')
  await commit(virtual, pairing, event)

  logger.info(`Virtual patient '${patient.getKey()}' created (for user ${loggedUser.email}).`)
  await VirtualPatient.launchAllFor(loggedUser.getKey())

  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Success`,
    patient: patient.toJson()
  }
}

/**
* Patient virtual create request
*
* @remarks
* Endpoint: DELETE /patient/virtual
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function deletePatientVirtual(ctx: Koa.Context): Promise<void> {
  const loggedUser = await assertUserLoggedIn(ctx)
  await VirtualPatient.removeAllFor(loggedUser.getKey())

  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Success`
  }
}
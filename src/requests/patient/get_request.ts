// Imports
import Koa from 'koa'
import Patient from '../../orm/patient'
import { isPaired } from '../../orm/patient-user'
import { BackError } from '../../utils'
import { assertUserLoggedIn } from '../user/util'

/**
* Patient get request
*
* @remarks
* Endpoint: GET /patient/get
* Query parameters:
*   - patient_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function patientGet (
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
  if (!await isPaired(loggedUser.getKey(), patientId)) {
    throw new BackError(401, 'NOT_PAIRED')
  }

  // Gets patient ORM instance
  const patient = (await Patient.fromKey(patientId))!

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Patient information fetched',
    patient: patient.toJson()
  }
}

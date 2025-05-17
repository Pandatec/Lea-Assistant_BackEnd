// Imports
import { BackError } from '../../utils'
import { assertUserLoggedIn } from './util'
import Koa from 'koa'
import { remove, unique } from '../../orm'

/**
* User information request
*
* @remarks
* Endpoint: DELETE /user/delete
* Query parameters:
*   - include_patients
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/

export default async function userDelete (
    ctx: Koa.Context
  ): Promise<void> {
  // Gets arguments
  const include_patients: boolean = JSON.parse(ctx.query.include_patients as string)

  // Processes request
  if (typeof(include_patients) !== 'boolean')
    throw new BackError(400, 'NO_FIELD')
  // Gets logger user
  const user = await assertUserLoggedIn(ctx)

  const [recs, cbs] = await user.getRecords(include_patients)
  await remove(...unique(recs))
  for (const cb of cbs)
    cb()

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `User ${user.getKey()} succefully deleted`
  }
}

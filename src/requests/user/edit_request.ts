// Imports
import { assertTextLimit, BackError } from '../../utils'
import { assertUserLoggedIn } from './util'
import Koa from 'koa'
import { commit } from '../../orm'

/**
* User information request
*
* @remarks
* Endpoint: GET /users/get
* Query parameters:
*   - first_name (optional string)
*   - last_name (optional string)
*   - email (optional string)
*   - phone (optional string)
*   - password (optional string)
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/

export default async function userEdit (
    ctx: Koa.Context
  ): Promise<void> {
  // Gets arguments
  const firstName = ctx.request.body.first_name
  const lastName = ctx.request.body.last_name
  const email = ctx.request.body.email
  const phone = ctx.request.body.phone
  const password = ctx.request.body.password

  // Processes request
  if (firstName === undefined && lastName === undefined && email === undefined && phone === undefined && password === undefined) {
    throw new BackError(400, 'NO_FIELD')
  } else {
    // Gets logger user
    const loggedUser = await assertUserLoggedIn(ctx)

    // Updates fields
    if (firstName) {
      loggedUser.first_name = firstName
      assertTextLimit(loggedUser.first_name)
    }
    if (lastName) {
      loggedUser.last_name = lastName
      assertTextLimit(loggedUser.last_name)
    }
    if (email) {
      loggedUser.email = email
      assertTextLimit(loggedUser.email)
    }
    if (phone) {
      loggedUser.phone = phone
      assertTextLimit(loggedUser.phone)
    }
    if (password) {
      loggedUser.password = password
      assertTextLimit(loggedUser.password)
    }

    await commit(loggedUser)

    // Respond
    ctx.status = 200
    ctx.body = {
      status: 'OK',
      message: `User ${loggedUser.getKey()} succefully edited`
    }
  }
}

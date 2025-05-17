// Imports
import { assertUserLoggedIn } from './util'
import Koa from 'koa'

/**
* User information request
*
* @remarks
* Endpoint: GET /users/get
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function userGet (
  ctx: Koa.Context
): Promise<void> {
  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx, true)

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'User information fetched',
    user: await loggedUser.toJsonFull()
  }
}

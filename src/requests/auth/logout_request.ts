// Imports
import Koa from 'koa'
import { vs } from '../../orm'
import { token } from '../../tokens'
import { BackError } from '../../utils'
import { assertUserLoggedIn, getAuthToken } from '../user/util'
import { kickAppClient, kickFromToken } from '../../websocket/app/client'

/**
* logout request
*
* @remarks
* Endpoint: POST /auth/logout
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function logout (
  ctx: Koa.Context
): Promise<void> {

  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)
  if (ctx.header.authorization === undefined)
    throw new BackError(401, 'NOT_LOGGED_IN')
  
  // Auth token is defined because we ensured the user is already logged in
  const tokenToRemove = getAuthToken(ctx) as string

  // Processes request
  if (vs.string(tokenToRemove))
    throw new BackError(401, 'INVALID_FIELD')

  // Kick all app web socket
  kickFromToken(loggedUser.getKey(), tokenToRemove)

  // Logs out user
  await token.remove(tokenToRemove, loggedUser.getKey())
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Successfully logged out`,
  }
}

/**
* logout all devices request
*
* @remarks
* Endpoint: POST /auth/logout/fromAllDevices
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function logoutAll (
  ctx: Koa.Context
): Promise<void> {

  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Kick all app web socket
  kickAppClient(loggedUser.getKey())

  // Logs out user
  await token.removeAllFromUser(loggedUser.getKey())
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Successfully logged out`,
  }
}

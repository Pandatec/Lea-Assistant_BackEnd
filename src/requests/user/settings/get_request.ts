// Imports
import Settings from '../../../orm/settings'
import { BackError } from '../../../utils'
import { assertUserLoggedIn } from '../util'
import Koa from 'koa'

/**
* Settings get request
*
* @remarks
* Endpoint: GET /user/settings/get
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function settingsGet (ctx: Koa.Context) {
  // Gets logged user
  const loggedUser = await assertUserLoggedIn(ctx)
  const configId = loggedUser.settings_id
  const config = await Settings.fromKey(configId)

  // Processes requets
  if (config === undefined) {
    throw new BackError(500, 'INTERNAL_ERROR')
  }
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Settings fecthed successfully',
    settings: config
  }
}

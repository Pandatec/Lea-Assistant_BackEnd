// Imports
import User from '../../orm/user'
import Notification from '../../orm/notification'
import { BackError } from '../../utils'
import { commit } from '../../orm'
import Koa from 'koa'
import { token } from '../../tokens'

/**
* Login request
*
* @remarks
* Endpoint: POST /auth/login
* Query parameters:
*   - email (string)
*   - password (string, and non-hashed)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function login (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const email = ctx.request.body.email
  const password = ctx.request.body.password

  // Processes request
  if (email === undefined || password === undefined) {
    throw new BackError(400, 'MISSING_FIELD')
  } else {
    // Checks is user exists with password
    const user = await User.getByEmailPassword(email, password)
    if (user === undefined) {
      throw new BackError(401, 'AUTHENTIFICATION_FAILED')
    }

    if ((await user.querySettings()).notif_new_login) {
      const welcome = await Notification.createNew(user.getKey(), "Nouvelle connexion", `Bienvenue, ${user.first_name} !`)
      await commit(welcome)
    }

    // Create access_token and respond
    const accessToken = await token.create(user.getKey())
    ctx.status = 200
    ctx.body = {
      status: 'OK',
      message: `User ${email} successfully logged in`,
      access_token: accessToken,
      user: await user.toJsonFull()
    }
  }
}

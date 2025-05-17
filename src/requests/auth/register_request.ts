// Imports
import User from '../../orm/user'
import { assertTextLimit, BackError } from '../../utils'
import Koa from 'koa'
import EmailCode from '../../orm/email_code'
import { isAvailable, Mail } from '../../mail'
import { commit } from '../../orm'

/**
* Register request
*
* @remarks
* Endpoint: POST /auth/register
* Query parameters:
*   - first_name (string)
*   - last_name (string)
*   - email (string)
*   - phone (string)
*   - password (string, and non-hashed)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function register (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const firstName: string | undefined = ctx.request.body.first_name
  const lastName: string | undefined = ctx.request.body.last_name
  const email: string | undefined = ctx.request.body.email
  const phone: string | undefined = ctx.request.body.phone
  const password: string | undefined = ctx.request.body.password

  // Processes request
  if (firstName === undefined || lastName === undefined || email === undefined || phone === undefined || password === undefined)
    throw new BackError(400, 'MISSING_FIELD')
  else if (await User.exists(email))
    throw new BackError(400, 'ALREADY_REGISTERED')
  else if (password.length < 8)
    throw new BackError(400, 'PASSWORD_TOO_SHORT')
  else {
    // Create user and respond
    assertTextLimit(firstName, lastName, email, phone, password)
    const user = await User.createNew(firstName, lastName, email, phone, password)
    if (isAvailable()) {
      const emailCode = await EmailCode.createNew(user.getKey())
      await new Mail(email, 'Vérification de votre compte',
        `Bonjour,\n\nAfin de finaliser la création de votre compte Léa, veuillez suivre ce lien: https://app.leassistant.fr/verify?emailCode=${emailCode.emailCode}`,
        `Bonjour,<br/><br/>Afin de finaliser la création de votre compte Léa, veuillez suivre ce <a href="https://app.leassistant.fr/verify?emailCode=${emailCode.emailCode}">lien</a>`)
        .send()
    } else {
      user.active = true
      await commit(user);
    }
    ctx.status = 201
    ctx.body = {
      status: 'OK',
      message: `User ${email} succesfully created`
    }
  }
}

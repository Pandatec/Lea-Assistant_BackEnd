// Imports
import Koa from 'koa'
import User from '../../orm/user'
import { BackError } from '../../utils'
import { transaction } from '../../orm'
import EmailCode from '../../orm/email_code'
import { sendToClients } from '../../websocket/app/client'
import { assertUserLoggedIn } from '../user/util'
import { Mail } from '../../mail'

/**
* Verify request
*
* @remarks
* Endpoint: POST /auth/verify
* Query parameters:
*   - emailCode (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function verify (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const emailCode = ctx.request.body.emailCode

  // Processes request
  if (emailCode === undefined || typeof emailCode !== 'string')
    throw new BackError(400, 'MISSING_FIELD')
  else {
    // Checks code
    const emailCodeInst = await EmailCode.getByEmailCode(emailCode)
    if (emailCodeInst == undefined)
      throw new BackError(400, 'INVALID_FIELD')

    // Set user active
    const user = (await User.fromKey(emailCodeInst.userId))!
    user.active = true

    await transaction(async tx => {
      await tx.save(user)
      await tx.delete(emailCodeInst)
    })

    // Send to clients
    sendToClients(user.getKey(), 'userVerified', '')

    // Reponse
    ctx.status = 200
    ctx.body = {
      status: 'OK',
      message: `User email successfully verified`,
      user: await user.toJsonFull()
    }
  }
}

/**
* Resend verify request
*
* @remarks
* Endpoint: POST /auth/resend-verif-instr
* Query parameters:
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function resendVerifMail(ctx: Koa.Context): Promise<void> {
  const user = await assertUserLoggedIn(ctx, true)
  let emailCode = await EmailCode.getByUserId(user.getKey())
  if (emailCode == undefined)
    emailCode = await EmailCode.createNew(user.getKey())
  else
    await emailCode.update()
  const code = emailCode.emailCode
  await new Mail(user.email, 'Vérification de votre compte',
    `Bonjour,\n\nAfin de finaliser la création de votre compte Léa, veuillez suivre ce lien: https://app.leassistant.fr/verify?emailCode=${code}`,
    `Bonjour,<br/><br/>Afin de finaliser la création de votre compte Léa, veuillez suivre ce <a href="https://app.leassistant.fr/verify?emailCode=${code}">lien</a>`)
    .send()

  // Reponse
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Reset email successfully sent`
  }
}

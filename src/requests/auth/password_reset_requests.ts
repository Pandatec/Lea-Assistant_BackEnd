// Imports
import Koa from 'koa'
import { assertTextLimit, BackError } from '../../utils'
import { passwordResetTokens, createResetToken } from '../../password_reset_token'
import { Mail } from '../../mail'
import User from '../../orm/user'
import { commit } from '../../orm'
import { hash } from '../../utils'

/**
* Password Reset request
*
* @remarks
* Endpoint: POST /auth/sendResetMail
* Query parameters:
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function sendResetMail (ctx: Koa.Context): Promise<void> {
  // Gets logger user
  const mail = ctx.request.body.email

  const user = await User.getByEmail(mail)
  if (user === undefined)
    throw new BackError(400, 'USER_DOES_NOT_EXIST')

  const token = createResetToken(user.getKey(), user.email)

  await new Mail(user.email, 'Changement du mot de passe', 
    `Bonjour,\n\nUne demande de changement de mot de passe a été faite sur votre compte.\n\nSi vous n\'en êtes pas à l\'ogirine, veuillez ignorez ce mail.\n\nPour changer votre mot de passe, veuillez suivre ce lien: https://app.leassistant.fr/password_reset?token=${token}&mail=${user.email}`,
		`Bonjour,<br/><br/>Une demande de changement de mot de passe a été faite sur votre compte.<br/><br/>Si vous n\'en êtes pas à l\'ogirine, veuillez ignorez ce mail.<br/><br/>Pour changer votre mot de passe, veuillez suivre ce <a href="https://app.leassistant.fr/password_reset?token=${token}&mail=${user.email}">lien</a>`)
    .send()

  // Create access_token and respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Password recovery mail sent`,
  }
}

export async function resetPassword(ctx: Koa.Context): Promise<void> {
  const token = ctx.request.body.token
  const mail = ctx.request.body.email
  const password = ctx.request.body.password
  const password_confirm = ctx.request.body.password_confirm

  const user = await User.getByEmail(mail)
  if (user === undefined)
    throw new BackError(400, 'USER_DOES_NOT_EXIST')
  const resetToken = passwordResetTokens[user.getKey()]
  if (resetToken.email != mail || resetToken.token != token)
    throw new BackError(400, 'INVALID_FIELD')
  if (resetToken.isExpired())
    throw new BackError(400, 'TOKEN_EXPIRED')
  if (password !== password_confirm)
    throw new BackError(400, 'PASSWORD_MISMATCH')
  if (password.length < 8)
    throw new BackError(400, 'PASSWORD_TOO_SHORT')

  assertTextLimit(password)
  user.password = hash(password)

  await commit(user)

  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: `Password reset succesfully`,
  }
}

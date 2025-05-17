// Imports
import Koa from 'koa'
import { Router } from '../websocket/api/router'
import login from './auth/login_request'
import register from './auth/register_request'
import { logout, logoutAll } from './auth/logout_request'
import { resetPassword, sendResetMail } from './auth/password_reset_requests'
import { verify, resendVerifMail } from './auth/verify_request'

/**
* Setup authentication related routers and HTTP requests
*
* @param {Koa} app  Koa app instance
*/
export function setupAuthRouter(app: Koa) {
  const router = new Router(app, '/v1/auth')

	router
		.post('/login', login)
		.post('/register', register)
		.delete('/logout', logout)
		.delete('/logout/fromAllDevices', logoutAll)
		.post('/verify', verify)
		.post('/sendResetMail', sendResetMail)
		.post('/resetPassword', resetPassword)
		.post('/resend-verif-instr', resendVerifMail)
	router.commit()
}

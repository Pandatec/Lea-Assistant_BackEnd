// Imports
import Koa from 'koa'
import User from '../../orm/user'
import { BackError } from '../../utils'
import { token } from '../../tokens'

/**
 * @async @function assertUserLoggedIn - Ensures a user is logged in
 * 
 * @param {Koa.Context} ctx - The HTTP request 
 * @param {boolean} [overrideActive = true] - Accepts a non active user 
 * @returns {Promise<User>} - The logged in user
 */
export async function assertUserLoggedIn(ctx: Koa.Context, overrideActive: boolean = false): Promise<User> {
	if (ctx.header.authorization === undefined || !ctx.header.authorization!.startsWith('Bearer ')) 
		throw new BackError(401, 'NOT_LOGGED_IN')
	const bearer = ctx.header.authorization!.substring(7)
	const userId = token.check(bearer)
	if (userId === undefined)
		throw new BackError(401, 'NOT_LOGGED_IN')
	const loggedUser = await User.fromKey(userId)
	if (loggedUser === undefined)
		throw new BackError(401, 'NOT_LOGGED_IN')
	if ((loggedUser.active || overrideActive) !== true)
		throw new BackError(401, 'NOT_VERIFIED')
	return loggedUser
}

/**
 * @function getAuthToken - Returns the authentification in this request token if there is one, undefined otherwise
 * 
 * @param {Koa.Context} ctx - The HTTP request  
 * @returns {string | undefined} - The authentification token if there is one, undefined otherwise
 */
export function getAuthToken(ctx: Koa.Context) : string | undefined {
	return ctx.header.authorization!.substring(7)
}

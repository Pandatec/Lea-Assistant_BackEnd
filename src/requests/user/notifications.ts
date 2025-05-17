// Imports
import Koa from 'koa'
import { commit } from '../../orm'
import Notification from '../../orm/notification'
import { BackError } from '../../utils'
import { sendToClients } from '../../websocket/app/client'
import { assertUserLoggedIn } from './util'

/**
* Unread get request
*
* @remarks
* Endpoint: GET /user/notifs/unread_count
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function notifsUnreadCountGet (ctx: Koa.Context) {
	const loggedUser = await assertUserLoggedIn(ctx)
	const notifs = await Notification.unreadForUserId(loggedUser.getKey())

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Notification unread count fetched successfully',
		count: notifs.length
	}
}

const notifStride = 16

/**
* Notifs get request
*
* @remarks
* Endpoint: GET /user/notifs
* Query parameters:
*   - [opt]: page (number as string)
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function notifsGet (ctx: Koa.Context) {
	const loggedUser = await assertUserLoggedIn(ctx)
	const pstr = ctx.query.page || '0'	// || '0' to remove when fully migrated client-side
	if (pstr === undefined || typeof(pstr) !== 'string')
		throw new BackError(400, 'MISSING_FIELD')
	const page = parseInt(pstr)

	const notifs = await Notification.allForUserId(loggedUser.getKey(), q => q.order('created_at', 'desc').offset(notifStride * page).limit(notifStride))
	const res = notifs.map(n => n.toJson())

	const unread: Notification[] = []
	for (const n of notifs)
		if (!n.is_read) {
			n.is_read = true
			unread.push(n)
		}
	if (unread.length > 0) {
		await commit(...unread)
		sendToClients(loggedUser.id, 'newNotificationCount', {
			"count": (await Notification.unreadForUserId(loggedUser.getKey())).length
		})
	}

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Notifications fetched successfully',
		notifs: res
	}
}

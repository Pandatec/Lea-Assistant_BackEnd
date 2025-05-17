// Imports
import Koa from 'koa'
import { Router } from '../websocket/api/router'
import userGet from './user/get_request'
import userEdit from './user/edit_request'
import settingsGet from './user/settings/get_request'
import settingsEdit from './user/settings/edit_request'
import { notifsUnreadCountGet, notifsGet } from './user/notifications'
import pair from './user/pair_request'
import userDelete from './user/delete_request'

/**
* Setup user related router and HTTP requests
*
* @remark
* Theses requests are only accessible with a log-on user
*
* @param {Koa} app  Koa app instance
*/
export function setupUserRouter(app: Koa) {
	const router = new Router(app, '/v1/user')

	router
		.get('/get', userGet)
		.patch('/edit', userEdit)
		.get('/settings/get', settingsGet)
		.patch('/settings/edit', settingsEdit)
		.get('/notifs/unread_count', notifsUnreadCountGet)
		.get('/notifs', notifsGet)
		.patch('/pair', pair)
		.delete('/delete', userDelete)
	router.commit()
}

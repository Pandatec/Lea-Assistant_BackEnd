import { Server } from 'http'
import { DeviceClient } from './dev/client'
import { Client as AppClient } from './app/client'
import { Client as ApiClient } from './api/client'
import { server, request } from 'websocket'
import { logger } from '../utils'

/**
 * Bind websocket channel on existing HTTP server and listen incoming connections
 * @async
 * @param {Server} server - existing HTTP server
 */
export async function setupWebsocket (httpServer: Server): Promise<server> {
	const ws = new server({ httpServer: httpServer })
	ws.on('request', (request: request) => {
		let url = request.resourceURL.pathname
		if (url === "/dev")
			new DeviceClient(request.accept(undefined, request.origin))
		else if (url === "/app")
			new AppClient(request.accept(undefined, request.origin))
		else if (url === "/api")
			new ApiClient(request.accept(undefined, request.origin))
		else {
			logger.warn(`WebSocket client trying to access ${url}`)
			request.reject(404, 'No such resource')
		}
	})
	return ws
}

// Imports
import Koa from 'koa'
import { Router } from '../websocket/api/router'
import { getBuildAppAndroid, getBuildAppIOS, getBuildDeviceAndroid } from './build/app'
import { getBuildDeviceEsp32 } from './build/device_esp32'

/**
* Setup device related router and HTTP requests
*
* @param {Koa} app  Koa app instance
*/
export function setupBuildRouter(app: Koa) {
	const router = new Router(app, '/build')

	router.get('/device_esp32', getBuildDeviceEsp32)
	router.get('/app_android', getBuildAppAndroid)
	router.get('/app_ios', getBuildAppIOS)
	router.get('/device_android', getBuildDeviceAndroid)

	router.commit()
}

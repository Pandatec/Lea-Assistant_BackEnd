// Imports
import Koa from 'koa'
import { Router } from '../websocket/api/router'
import { scanBuildAppAndroid, scanBuildAppIOS, scanBuildDeviceAndroid, scanBuildDeviceEsp32, } from './admin/build'

/**
* Setup admin router and HTTP requests
*
* @param {Koa} app  Koa app instance
*/
export function setupAdminRouter(app: Koa) {
	const router = new Router(app, '/build')

	router.post('/scanBuildDeviceEsp32', scanBuildDeviceEsp32)
	router.post('/scanBuildAppAndroid', scanBuildAppAndroid)
	router.post('/scanBuildAppIOS', scanBuildAppIOS)
	router.post('/scanBuildDeviceAndroid', scanBuildDeviceAndroid)

	router.commit()
}

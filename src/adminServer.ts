import Koa from 'koa'
import http from 'http'
import { logger } from './utils'
import { setupAdminRouter } from './requests/admin_router'
import { buildDeviceEsp32 } from './requests/build/device_esp32'
import { buildAppAndroid, buildAppIOS, buildDeviceAndroid } from './requests/build/app'
import { BUILD, ensureFolderExists } from './fstruct'

export class adminServer {
  private app: Koa

  constructor(port: number) {
    this.app = new Koa()
    http.createServer()
      .listen(port)
      .on('request', this.app.callback())
    logger.info(`Admin HTTP server running on port ${port}`)
    setupAdminRouter(this.app)

    ensureFolderExists(BUILD)
    buildDeviceEsp32.scan()
    buildAppAndroid.scan()
    buildAppIOS.scan()
    buildDeviceAndroid.scan()
  }
}

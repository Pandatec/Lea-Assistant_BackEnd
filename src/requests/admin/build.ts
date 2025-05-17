// Imports
import Koa from 'koa'
import { Builds } from '../../builds'
import { buildAppAndroid, buildAppIOS, buildDeviceAndroid } from '../build/app'
import { buildDeviceEsp32 } from '../build/device_esp32'

async function scan(ctx: Koa.Context, builds: Builds) {
  builds.scan()
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Build scanned with high rate of success.'
  }
}

export async function scanBuildDeviceEsp32(ctx: Koa.Context) {
  return await scan(ctx, buildDeviceEsp32)
}
export async function scanBuildAppAndroid(ctx: Koa.Context) {
  return await scan(ctx, buildAppAndroid)
}
export async function scanBuildAppIOS(ctx: Koa.Context) {
  return await scan(ctx, buildAppIOS)
}
export async function scanBuildDeviceAndroid(ctx: Koa.Context) {
  return await scan(ctx, buildDeviceAndroid)
}
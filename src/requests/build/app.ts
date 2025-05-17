// Imports
import Koa from 'koa'
import { BackError } from '../../utils'
import { Builds } from '../../builds'
import { BUILD_APP_ANDROID_ENABLE, BUILD_APP_IOS_ENABLE, BUILD_DEVICE_ANDROID_ENABLE } from '../../constants'

export const buildAppAndroid = new Builds('LEA-CONNECT-ANDROID', 'app_android', 'lea_connect_', 'aab', BUILD_APP_ANDROID_ENABLE)
export const buildAppIOS = new Builds('LEA-CONNECT-IOS', 'app_ios', 'lea_connect_', '$aapl', BUILD_APP_IOS_ENABLE)
export const buildDeviceAndroid = new Builds('LEA-ANDROID', 'device_android', 'lea_mobile_', 'aab', BUILD_DEVICE_ANDROID_ENABLE)

async function getBuild(ctx: Koa.Context, build: Builds) {
  const reported_version = ctx.query.reported_version

  if (reported_version === undefined || typeof(reported_version) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')

  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Up-to-date',
    is_uptodate: build.isUpToDate(reported_version)
  }
}

export async function getBuildAppAndroid(ctx: Koa.Context) {
  return await getBuild(ctx, buildAppAndroid)
}
export async function getBuildAppIOS(ctx: Koa.Context) {
  return await getBuild(ctx, buildAppIOS)
}
export async function getBuildDeviceAndroid(ctx: Koa.Context) {
  return await getBuild(ctx, buildDeviceAndroid)
}
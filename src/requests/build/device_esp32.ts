// Imports
import Koa from 'koa'
import { BackError } from '../../utils'
import { Builds } from '../../builds'
import Patient from '../../orm/patient'
import { BUILD_DEVICE_ESP32_ENABLE } from '../../constants'

export const buildDeviceEsp32 = new Builds('LEA-ESP32', 'device_esp32', 'firmware_', 'bin', BUILD_DEVICE_ESP32_ENABLE)

/**
* Get OTA request
*
* @remarks
* Endpoint: POST /build/device_esp32
* Query parameters:
*   - reported_version (string)
*   - device_id (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getBuildDeviceEsp32(ctx: Koa.Context) {
  // Gets arguments
  const reported_version = ctx.query.reported_version
  const device_id = ctx.query.device_id

  if (reported_version === undefined || typeof(reported_version) !== 'string' ||
  device_id === undefined || typeof(device_id) !== 'string') {
    throw new BackError(400, 'MISSING_FIELD')
  }

  if (await Patient.getBySecretId(device_id) === undefined)
    throw new BackError(400, 'INVALID_DEVICE_ID')

  if (buildDeviceEsp32.isUpToDate(reported_version)) {
    ctx.status = 200
    ctx.body = {
      status: 'OK',
      message: 'Up-to-date'
    }
  } else {
    ctx.status == 200
    ctx.body = buildDeviceEsp32.getLatestStream()
  }
}

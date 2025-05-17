// Imports
import { pairingCodes } from '../../pairingCodes'
import { BackError } from '../../utils'
import { assertUserLoggedIn } from './util'
import Koa from 'koa'

/**
* Pair request
*
* @remarks
* Endpoint: PATCH /users/pair
* Query parameters:
*   - code (string)
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function pair (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const tempToken = ctx.request.body.temp_token

  // Gets the logged in user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Processes request
  if (tempToken === undefined) {
    throw new BackError(400, 'MISSING_FIELD')
  }

  // Gets pairing code
  let pairingCode = pairingCodes[tempToken]
  if (pairingCode === undefined) {
    throw new BackError(403, 'UNKNOWN_CODE')
  }

  // Checks if already requested
  if (pairingCode.isWaiting()) {
    throw new BackError(409, 'WAITING_FOR_CONFIRMATION')
  }

  // Wait for device confirmation
  pairingCode.auth.freezePairingCode()
  pairingCode.startWaiting()
  pairingCode.auth.notifyPairing(loggedUser.fullName())
  pairingCode.setUserId(loggedUser.getKey())

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Request successfully sent, waiting for device confirmation',
  }
}

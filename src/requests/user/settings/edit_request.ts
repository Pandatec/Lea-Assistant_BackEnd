// Imports
import { commit } from '../../../orm'
import Notification from '../../../orm/notification'
import { assertUserLoggedIn } from '../util'
import { BackError } from '../../../utils'
import Koa from 'koa'

/**
* Settings edit request
*
* @remarks
* Endpoint: PATCH /user/settings/edit
* Query parameters:
*   - dark_mode (optional string)
*   - lang (optional string)
* Requires to be logged
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export default async function settingsEdit (ctx: Koa.Context) {
  // Gets arguments
  const darkMode = ctx.request.body.dark_mode
  const lang = ctx.request.body.lang
  const dnd = ctx.request.body.dnd
  const notif_safe_zone_tracking = ctx.request.body.notif_safe_zone_tracking
  const notif_offline_patient = ctx.request.body.notif_offline_patient
  const notif_new_login = ctx.request.body.notif_new_login
  const notif_setting_modified = ctx.request.body.notif_setting_modified

  // Process
  if (lang === undefined && darkMode === undefined && dnd === undefined
    && notif_safe_zone_tracking === undefined
    && notif_offline_patient === undefined
    && notif_new_login === undefined
    && notif_setting_modified === undefined) {
    throw new BackError(400, 'MISSING_FIELD')
  }
  // Gets user config
  const loggedUser = await assertUserLoggedIn(ctx)
  const config = await loggedUser.querySettings()

  if (config === undefined) {
    throw new BackError(500, 'INTERNAL_ERROR')
  }
  // Updates settings
  if (darkMode !== undefined)
    config.dark_mode = darkMode
  if (lang !== undefined)
    config.lang = lang
  if (dnd !== undefined)
    config.dnd = dnd
  if (notif_safe_zone_tracking !== undefined)
    config.notif_safe_zone_tracking = notif_safe_zone_tracking
  if (notif_offline_patient !== undefined)
    config.notif_offline_patient = notif_offline_patient
  if (notif_new_login !== undefined)
    config.notif_new_login = notif_new_login
  if (notif_setting_modified !== undefined)
    config.notif_setting_modified = notif_setting_modified
  if (config.notif_setting_modified) {
    const headsUp = await Notification.createNew(loggedUser.getKey(), "Paramètres modifiés", "Vous avez modifié vos paramètres avec succès")
    await commit(headsUp)
  }
  await commit(config)

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Settings succesfully updated',
    setting: config.toJson()
  }
}

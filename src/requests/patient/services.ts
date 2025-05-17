// Imports
import Koa from 'koa'
import { Service, Trigger, ServiceAction as Action } from '../../orm/service'
import { isPaired } from '../../orm/patient-user'
import { ActionList, ActionType } from '../../services/actions/action_list'
import { TriggerType, Multiplexer } from '../../services/main_multiplexer'
import { BackError } from '../../utils'
import { assertUserLoggedIn } from '../user/util'

/**
* Get patient services
*
* @remarks
* Endpoint: GET /patient/service/getAll
* Query parameters:
*   - patient_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getAllService (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const patientId = ctx.query.patient_id as string

  if (patientId === undefined || typeof(patientId) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')
  
  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), patientId))
    throw new BackError(401, 'NOT_PAIRED')

  // Gets patient ORM instance
  const services = await Service.GetByPatientId(patientId)

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Services information fetched',
    patient: services.map(e => e.toJson())
  }
}

/**
* Get services
*
* @remarks
* Endpoint: GET /patient/service/get
* Query parameters:
*   - service_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getService (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const serviceId = ctx.query.service_id as string

  if (serviceId === undefined || typeof(serviceId) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')

  const service = await Service.GetById(serviceId)

  if (service === undefined)
    throw new BackError(400, 'INVALID_FIELD')
  
  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), service.patientId))
    throw new BackError(401, 'NOT_PAIRED')

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Service information fetched',
    patient: service.toJson()
  }
}

/**
* Create serices
*
* @remarks
* Endpoint: POST /patient/service/create
* Query parameters:
*   - patient_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function createService (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const patientId = ctx.query.patient_id as string
  const triggerType = ctx.query.trigger_type as TriggerType | undefined
  const triggerRawPayload = ctx.query.trigger_payload as string | undefined
  const actionType = ctx.query.action_type as ActionType | undefined
  const actionRawPayload = ctx.query.action_payload as string | undefined

  if (patientId === undefined || typeof(patientId) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')
  if (triggerType === undefined)
    throw new BackError(400, 'MISSING_FIELD')
  if (triggerRawPayload === undefined || typeof(triggerRawPayload) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')
  if (actionType === undefined)
    throw new BackError(400, 'MISSING_FIELD')
  if (actionRawPayload === undefined || typeof(actionRawPayload) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')

  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), patientId))
    throw new BackError(401, 'NOT_PAIRED')

  // Parses payloads
  const triggerPayload = JSON.parse(triggerRawPayload) as Trigger
  const actionPayload = JSON.parse(actionRawPayload) as Action

  // Creates service
  const service = await Multiplexer.addService(patientId, triggerType, triggerPayload, actionType, actionPayload)

  // Checks if service was successfully created
  if (service === undefined)
    throw new BackError(400, 'INVALID_FIELD')

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Service created',
    patient: service.toJson()
  }
}

/*Edit service
*
* @remarks
* Endpoint: PATCH /patient/service/create
* Query parameters:
*   - service_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function editService (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const serviceId = ctx.query.service_id as string | undefined
  let triggerPayload = ctx.query.trigger_payload as {} | undefined
  let actionType = ctx.query.action_type as ActionType | undefined
  let actionPayload = ctx.query.action_payload as {} | undefined

  // Check for required arguments

  if (serviceId === undefined)
    throw new BackError(400, 'MISSING_FIELD')

  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Check if provided service exists
  const service = await Service.GetById(serviceId)
  if (service === undefined)
    throw new BackError(400, 'INVALID_FIELD')

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), service.patientId))
    throw new BackError(401, 'NOT_PAIRED')

  // Keep old event info
  const patientId = service.patientId
  const triggertype = service.trigger.type
  triggerPayload = (triggerPayload === undefined || typeof(triggerPayload) !== 'object') ? service.trigger.payload : triggerPayload
  actionType = (actionType === undefined) ? service.action.type : actionType
  actionPayload = (actionPayload === undefined || typeof(actionPayload) !== 'object') ? service.action.payload : actionPayload

  // Deletes old event (they are imutable)
  await Multiplexer.deleteService(service)

  const newService = await Multiplexer.addService(patientId, triggertype, triggerPayload, actionType, actionPayload)

  // Checks if event was successfully created
  if (newService === undefined)
    throw new BackError(400, 'INVALID_FIELD')

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Service edited',
    patient: newService.toJson()
  }
}

/**
* Delete service
*
* @remarks
* Endpoint: DELETE /patient/service/delete
* Query parameters:
*   - service_id (string)
* Requires to be logged
* /!\ Request will be rejected if the user is not paired with the target patient
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function deleteAction (
  ctx: Koa.Context
): Promise<void> {
  // Gets arguments
  const serviceId = ctx.query.service_id as string

  if (serviceId === undefined || typeof(serviceId) !== 'string')
    throw new BackError(400, 'MISSING_FIELD')

  const service = await Service.GetById(serviceId)

  if (service === undefined)
    throw new BackError(400, 'INVALID_FIELD')
  
  // Gets logger user
  const loggedUser = await assertUserLoggedIn(ctx)

  // Checks if paired with user
  if (!await isPaired(loggedUser.getKey(), service.patientId))
    throw new BackError(401, 'NOT_PAIRED')

  Multiplexer.deleteService(service)

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Service deleted',
  }
}

/**
* get all service metadata
*
* @remarks
* Endpoint: GET /patient/service/getMeta
* Query parameters:
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getServiceMeta (
  ctx: Koa.Context
): Promise<void> {
  
  const actions: any[] = []
  ActionList.forEach((value, key) => {
    if (Object.keys(value.payload).length !== 0)
      return
    actions.push({
      name: {
        en: value.locale.get('EN'),
        fr: value.locale.get('FR')
      },
      action: {
        type: key,
        payload: value.payload
      }
    })
  })

  // Respond
  ctx.status = 200
  ctx.body = {
    status: 'OK',
    message: 'Actions meta fetched',
    actions: actions
  }
}

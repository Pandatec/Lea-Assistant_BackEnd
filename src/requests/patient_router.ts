// Imports
import Koa from 'koa'
import { Router } from '../websocket/api/router'
import get from './patient/get_request'
import { patientEdit, createPatientVirtual, deletePatientVirtual } from './patient/edit_request'
import calendarEventCreate from './patient/calendar_event/create_request'
import calendarEventDelete from './patient/calendar_event/delete_request'
import calendarEventEdit from './patient/calendar_event/edit_request'
import calendarEventGet from './patient/calendar_event/get_request'
import { getZones, patchZone, deleteZone, checkHome } from './patient/zones'
import { createTextMessage, playTextMessage, getTextMessages } from './patient/text_messages'
import { getPatientEvents, getPatientZoneEvents } from './patient/events'
import { createService, getService, getAllService, editService, getServiceMeta, deleteAction } from './patient/services'

/**
* Setup authentication related routers and HTTP requests
*
* @param {Koa} app  Koa app instance
*/
export function setupPatientRouter(app: Koa) {
  const router = new Router(app, '/v1/patient')

	router
		.get('/get', get)
		.patch('/edit', patientEdit)
		.post('/virtual', createPatientVirtual)
		.delete('/virtual', deletePatientVirtual)

		.post('/calendar_event/create', calendarEventCreate)
		.delete('/calendar_event/delete', calendarEventDelete)
		.patch('/calendar_event/edit', calendarEventEdit)
		.get('/calendar_event/get', calendarEventGet)

		.get('/zones', getZones)
		.patch('/zone', patchZone)
		.delete('/zone', deleteZone)
		.get('/home', checkHome)

		.post('/text-message', createTextMessage)
		.patch('/text-message', playTextMessage)
		.get('/text-messages', getTextMessages)

		.get('/events', getPatientEvents)
		.get('/zone-events', getPatientZoneEvents)

		.get('/service/getAll', getAllService)
		.get('/service/get', getService)
		.post('/service/create', createService)
		.patch('/service/edit', editService)
		.get('/service/getMeta', getServiceMeta)
		.delete('/service/delete', deleteAction)

	router.commit()
}

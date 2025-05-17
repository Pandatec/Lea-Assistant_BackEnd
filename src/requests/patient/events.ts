// Imports
import Koa from 'koa'
import { assertPatientPaired } from './zones'
import { expParam } from './text_messages'
import { PatientEvent } from '../../orm/PatientEvent'
import { PatientZoneEvent } from '../../orm/PatientZoneEvent'
import { Zone } from '../../orm/zone'

/**
* Query all patient events at a certain range in time
*
* @remarks
* Endpoint: GET /patient/events
* Requires to to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*   - range_begin (number)
*   - range_end (number)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getPatientEvents(ctx: Koa.Context) {
	const [, patientId] = await assertPatientPaired(ctx)

	const range_begin = parseInt(expParam<string>(ctx, 'range_begin', 'string'))
	const range_end = parseInt(expParam<string>(ctx, 'range_end', 'string'))

	const events = await PatientEvent.query(q => q
		.where('patient_id', '==', patientId)
		.where('date', '>=', range_begin)
		.where('date', '<=', range_end)
	)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Events successfully retrieved',
		patient_events: events.map(e => e.toJson())
	}
}

/**
* Query all patient zone events at a certain range in time
*
* @remarks
* Endpoint: GET /patient/zone-events
* Requires to to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*   - range_begin (number)
*   - range_end (number)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getPatientZoneEvents(ctx: Koa.Context) {
	const [, patientId] = await assertPatientPaired(ctx)

	const range_begin = parseInt(expParam<string>(ctx, 'range_begin', 'string'))
	const range_end = parseInt(expParam<string>(ctx, 'range_end', 'string'))

	// simple overlap detection, should grab all events that share some time with requested range
	const events = await PatientZoneEvent.query(q => q
		.where('patient_id', '==', patientId)
		.where('range_begin', '<=', range_end)
		.where('range_end', '>=', range_begin)
	)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Events successfully retrieved',
		patient_zone_events: events.map(e => e.toJson()),
		zones: (await Zone.allForPatientId(patientId)).map(z => z.toJsonFull())
	}
}
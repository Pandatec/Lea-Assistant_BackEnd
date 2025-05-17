// Imports
import Koa from 'koa'
import { commit, remove } from '../../orm'
import {Zone} from '../../orm/zone'
import { assertUserLoggedIn } from '../user/util'
import { isPaired } from '../../orm/patient-user'
import { assertTextLimit, BackError } from '../../utils'
import User from '../../orm/user'
import { Id } from '../../driver'

export async function assertPatientPaired(ctx: Koa.Context): Promise<[User, Id]> {
	const loggedUser = await assertUserLoggedIn(ctx)
	const patientId = ctx.query.patient_id
	if (patientId === undefined || typeof(patientId) !== 'string')
		throw new BackError(400, 'MISSING_FIELD')

	if (!isPaired(loggedUser.getKey(), patientId))
		throw new BackError(401, 'NOT_PAIRED')
	return [loggedUser, patientId]
}

/**
* Zones get request
*
* @remarks
* Endpoint: GET /patient/zones
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getZones(ctx: Koa.Context) {
	const [, patientId] = await assertPatientPaired(ctx)

	const zones = await Zone.allForPatientId(patientId)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Zones for such patient',
		zones: zones.map(z => z.toJsonFull())
	}
}

/**
* Zone create request
*
* @remarks
* Endpoint: PATCH /patient/zone
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*   - zone fields in body
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function patchZone(ctx: Koa.Context) {
	const [, patientId] = await assertPatientPaired(ctx)

	let z = ctx.request.body.zone
	if (z.type === undefined || typeof(z.type) !== 'string' ||
	z.name === undefined || typeof(z.name) !== 'string' ||
	z.color === undefined || typeof(z.color) !== 'number' ||
	z.safety === undefined || typeof(z.safety) !== 'string') {
		throw new BackError(400, 'MISSING_FIELD')
	}

	z.patient_id = patientId
	const i = z.id
	delete z.id
	z = Zone.unflatten(z)

	let getObj = async (): Promise<Zone> => {
		if (i === undefined || i === '')
			return Zone.new(z)
		else {
			const res = (await Zone.fromKeyWithPatientId(i, patientId))!
			Object.assign(res, z)
			return res
		}
	}
	let tc = await getObj()
	assertTextLimit(tc.type, tc.name)
	await commit(tc)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Zone created',
		zone_id: tc.getKey()
	}
}

/**
* Zone delete request
*
* @remarks
* Endpoint: DELETE /patient/zone
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*   - zone_id (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function deleteZone(ctx: Koa.Context) {
	const [, patientId] = await assertPatientPaired(ctx)

	const id = ctx.query.zone_id
	if (id === undefined || typeof(id) !== 'string')
		throw new BackError(400, 'MISSING_FIELD')

	await remove((await Zone.fromKeyWithPatientId(id, patientId))!)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Zone deleted'
	}
}


/**
* Zone check home
*
* @remarks
* Endpoint: GET /patient/home
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
* 
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function checkHome(ctx: Koa.Context) {
	const [, patientId] = await assertPatientPaired(ctx)

	const zones = await Zone.allForPatientId(patientId);

	ctx.status = 400
	ctx.body = {
		status: 'KO',
		message: 'Home Not found'
	}
	for (const zone of zones) {
		if (zone.safety === 'home') {
			ctx.status = 200
			ctx.body = {
				status: 'OK',
				message: 'Found home',
				home: zone.toJsonFull(),
				center: Zone.getZoneCenter(zone)
			}
		}
	}
}
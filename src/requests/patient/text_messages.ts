// Imports
import Koa from 'koa'
import { commit } from '../../orm'
import { assertPatientPaired } from './zones'
import { assertTextLimit, BackError } from '../../utils'
import TextMessage from '../../orm/TextMessage'
import User from '../../orm/user'
import Patient from '../../orm/patient'
import { clients } from '../../websocket/dev/client'

export function expParam<Type>(ctx: Koa.Context, name: string, type: string): Type
{
	const val = ctx.query[name]
	if (val === undefined || typeof(val) !== type)
		throw new BackError(400, 'MISSING_FIELD')
	return val as any
}

async function playMessage(u: User, m: TextMessage): Promise<boolean>
{
	let p = (await Patient.fromKey(m.patient_id))!
	let c = clients[p.getKey()]
	if (c === undefined)
		return false;
	// no await on purpose at function level!!
	// we want no hang on the server response 
	c.newMessageFromUser(u, m)
	return true
}

/**
* Create message to patient
*
* @remarks
* Endpoint: POST /patient/text-message
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*   - datetime (number)
*   - message (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function createTextMessage(ctx: Koa.Context) {
	const [user, patientId] = await assertPatientPaired(ctx)

	let datetime = expParam<string>(ctx, 'datetime', 'string')
	let message = expParam<string>(ctx, 'message', 'string')

	const msg = TextMessage.new({
		patient_id: patientId,
		user_id: user.getKey(),
		is_from_patient: false,
		datetime: parseInt(datetime),
		message: message,
		play_count: 0
	})
	assertTextLimit(message)
	const played = await playMessage(user, msg)
	if (played)
		msg.play_count++
	await commit(msg)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Message created',
		text_message: msg.toJson()
	}
}

/**
* Play created message to patient
*
* @remarks
* Endpoint: PATCH /patient/text-message
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*   - message_id (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function playTextMessage(ctx: Koa.Context) {
	const [user, patientId] = await assertPatientPaired(ctx)

	let message_id = expParam<string>(ctx, 'message_id', 'string')
	const msg = await TextMessage.fromKey(message_id)
	if (msg === undefined)
		throw new BackError(400, 'UNKNOWN_MESSAGE')
	if (msg.patient_id !== patientId)
		throw new BackError(401, 'INVALID_PATIENT')
	const played = await playMessage(user, msg)
	msg.play_count = played ? 1 : 0
	await commit(msg)

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Request processed',
		text_message: msg.toJson()
	}
}

/**
* Get messages created for patient
*
* @remarks
* Endpoint: GET /patient/text-messages
* Requires to be logged and to have the patient paired to logged user
* Query parameters:
*   - patient_id (string)
*
* @async
* @param {Koa.Context} ctx  Koa context (with body parsing)
*/
export async function getTextMessages(ctx: Koa.Context) {
	const [user, patientId] = await assertPatientPaired(ctx)

	const msgs = await TextMessage.allForPatientIdUserId(patientId, user.getKey())

	ctx.status = 200
	ctx.body = {
		status: 'OK',
		message: 'Messages retrieved',
		text_messages: msgs.map(m => m.toJson())
	}
}
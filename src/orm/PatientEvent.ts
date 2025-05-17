import { Id } from '../driver'
import { Entity, BaseEntity, Col } from '../orm'
import { getCurrentTime } from '../utils'
import { eventSubs } from '../websocket/app/client'

/**
 * Enum classifying all commands patient can request on its device
 * Used for
 */
enum PatientEventTypeEnum {
	unknown,		// Patient muttered something even God is clueless about
	pairing_accepted,	// Patient accepted pairing
	pairing_denied,		// Patient denied pairing
	event_created,		// Patient created an event
	reminder_created,	// Patient created a reminder
	message_created		// Patient sent a text message
}

export type PatientEventType = keyof typeof PatientEventTypeEnum

@Entity()
export class PatientEvent extends BaseEntity<PatientEvent>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col() type!: PatientEventType
	@Col() date!: number

	static now(patient_id: string, type: PatientEventType) {
		const res = this.new({
			patient_id: patient_id,
			type: type,
			date: getCurrentTime()
		})
		eventSubs.send(patient_id, 'newEvent', res.toJson())
		return res
	}
}
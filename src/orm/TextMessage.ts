import { Id } from '../driver'
import { Entity, BaseEntity, Col } from '../orm'

@Entity()
export default class TextMessage extends BaseEntity<TextMessage>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col({spec: 'id'}) user_id!: Id
	@Col() is_from_patient!: boolean
	@Col() datetime!: number
	@Col() message!: string
	@Col() play_count!: number

	// Does include all messages sent by patient to all paired users
	static async allForPatientIdUserId(patientId: Id, userId: Id) {
		const sentByUser = await this.query(q => q
			.where('patient_id', '==', patientId)
			.where('user_id', '==', userId)
			.order('datetime')
		)
		const sentByPatient = await this.query(q => q
			.where('patient_id', '==', patientId)
			.where('is_from_patient', '==', true)
			.order('datetime')
		)
		return sentByUser.concat(sentByPatient).sort((a, b) => a.datetime - b.datetime)
	}
}
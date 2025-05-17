import { Id } from '../driver'
import { Entity, BaseEntity, Col, FwdQuery, fwdQuery } from '../orm'
import { sendToClients } from '../websocket/app/client'

@Entity()
export default class ForgottenItems extends BaseEntity<ForgottenItems>() {
  @Col({spec: 'id'}) patient_id!: Id
  @Col() name!: string
  @Col() weigth!: number

  static async allForPatientId(patientId: Id, fwd: FwdQuery = undefined) {
		return await this.query(q => fwdQuery(q.where('patient_id', '==', patientId), fwd))
	}
  static async checkallForPatientIdAndName(patientId: Id, itemName: string, fwd: FwdQuery = undefined) {
    return await this.query(q => fwdQuery(q.where('patient_id', '==', patientId).where('name', '==', itemName), fwd))
  }
}
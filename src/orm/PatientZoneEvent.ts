import { Entity, BaseEntity, Col, vs, vs_danger } from '../orm'
import { Id } from '../driver'

@Entity()
export class PatientZoneEvent extends BaseEntity<PatientZoneEvent>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col({val: v => vs.string(v) || vs_danger.undefined(v)}) zone_id!: Id | undefined
	@Col() range_begin!: number
	@Col() range_end!: number
}
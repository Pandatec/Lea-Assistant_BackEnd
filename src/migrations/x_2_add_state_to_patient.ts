import { PatientState } from './../orm/PatientState';
import { BaseEntity, Col, Entity, MigrationTransaction } from '../orm'
import PatientQuery from '../orm/patient'

@Entity({schema: true})
class Patient extends BaseEntity<Patient>() {
	@Col() secret_id!: string
	@Col() first_name!: string
	@Col() last_name!: string
	@Col() nick_name!: string
	@Col() birth_date!: string
	@Col({spec: 'float'}) battery!: number
    @Col() state!: PatientState
}

export async function x_2_add_state_to_patient(tx: MigrationTransaction) {
    const patients = await PatientQuery.query() as unknown as Patient[];
    await tx.add_columns(Patient, 'state');
    for (const patient of patients)
        patient.state = 'unknown';
    await tx.save(...patients);
}

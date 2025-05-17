import { MigrationTransaction } from './orm'

export const migrations: {[key: number]: (tx: MigrationTransaction) => Promise<void>} = {}

export function getMigrationCount(): number {
	return Object.keys(migrations).length
}

import { x_0_create_base_tables } from './migrations/x_0_create_base_tables'
migrations[0] = x_0_create_base_tables
import { x_1_add_adress_to_user } from './migrations/x_1_add_adress_to_user'
migrations[1] = x_1_add_adress_to_user
import { x_2_add_state_to_patient } from './migrations/x_2_add_state_to_patient'
migrations[2] = x_2_add_state_to_patient
import { x_3_add_services } from './migrations/x_3_add_services'
migrations[3] = x_3_add_services
import { x_4_add_forgotten } from './migrations/x_4_add_forgotten'
migrations[4] = x_4_add_forgotten
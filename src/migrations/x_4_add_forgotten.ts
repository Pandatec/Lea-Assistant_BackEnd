import { Id } from '../driver'
import { BaseEntity, Col, Entity, MigrationTransaction } from '../orm'

@Entity({schema: true})
class ForgottenItems extends BaseEntity<Event>() {
  @Col({spec: 'id'}) patient_id!: Id
  @Col() name!: string
  @Col() weigth!: number
}

export async function x_4_add_forgotten(tx: MigrationTransaction) {
  await tx.create_table(ForgottenItems)
}

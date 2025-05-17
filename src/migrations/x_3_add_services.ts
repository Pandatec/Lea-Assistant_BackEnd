import { Id } from '../driver'
import { BaseEntity, Col, Entity, MigrationTransaction, vs_danger } from '../orm'
import { ServiceAction, Trigger } from '../orm/service'

@Entity({schema: true})
class Service extends BaseEntity<Event>() {
  @Col({spec: 'id'}) patientId!: Id
  @Col({val: v => vs_danger.object(v)}) trigger!: Trigger
  @Col({val: v => vs_danger.object(v)}) action!: ServiceAction
}

export async function x_3_add_services(tx: MigrationTransaction) {
  await tx.create_table(Service)
}

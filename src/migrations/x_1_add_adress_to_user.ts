import { Id } from '../driver'
import { BaseEntity, Col, Entity, MigrationTransaction } from '../orm'
import {Zone as ZoneQuery} from '../orm/zone';

@Entity({schema: true})
class Zone extends BaseEntity<Zone>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col() type!: string
	@Col() name!: string
	@Col() color!: number
	@Col() is_safe!: boolean
    @Col() safety!: string
	// dummy validator to create schema, don't worry this is not in production (see orm/zone.ts)
	@Col({val: () => true}) coords!: any
}

export async function x_1_add_adress_to_user(tx: MigrationTransaction) {
    const zones = await ZoneQuery.query() as unknown as Zone[];
    await tx.remove_columns(Zone, 'is_safe');
    await tx.add_columns(Zone, 'safety');
    for (const zone of zones)
        zone.safety = zone.is_safe ? 'safe' : 'danger';
    await tx.save(...zones);
}

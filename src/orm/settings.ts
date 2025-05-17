// Imports
import { Entity, BaseEntity, Col, vs } from '../orm'

@Entity()
export default class Settings extends BaseEntity<Settings>()
{
	@Col() lang!: string
	@Col() dnd!: boolean
	@Col({val: v => vs.string(v) || vs.boolean(v)})
	dark_mode!: string | boolean

	@Col() notif_safe_zone_tracking!: boolean
	@Col() notif_offline_patient!: boolean
	@Col() notif_new_login!: boolean
	@Col() notif_setting_modified!: boolean
}
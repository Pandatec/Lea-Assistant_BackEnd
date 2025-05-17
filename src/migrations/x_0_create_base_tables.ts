import { Id } from '../driver'
import { BaseEntity, Col, Entity, MigrationTransaction, vs, vs_danger } from '../orm'
import { PatientEventType } from '../orm/PatientEvent'

@Entity({schema: true})
class SchemaDB extends BaseEntity<SchemaDB>() {
	@Col() schemaVersion!: number
}

@Entity({schema: true})
class CalendarEvent extends BaseEntity<CalendarEvent>() {
	@Col() type!: string
	@Col() datetime!: number
	@Col() duration!: number
	@Col({val: () => true}) data!: any
	@Col() issuer!: string
}

@Entity({schema: true})
class Notification extends BaseEntity<Notification>() {
	@Col({spec: 'id'}) user_id!: Id
	@Col() created_at!: number
	@Col() is_read!: boolean
	@Col() title!: string
	@Col() message!: string
}

@Entity({schema: true})
class PatientCalendarEvent extends BaseEntity<PatientCalendarEvent>() {
	@Col({spec: 'id'}) patientId!: Id
	@Col({spec: 'id'}) calendarEventId!: Id
}

@Entity({schema: true})
class PatientUser extends BaseEntity<PatientUser>() {
	@Col({spec: 'id'}) patientId!: Id
	@Col({spec: 'id'}) userId!: Id
}

@Entity({schema: true})
class Patient extends BaseEntity<Patient>() {
	@Col() secret_id!: string
	@Col() first_name!: string
	@Col() last_name!: string
	@Col() nick_name!: string
	@Col() birth_date!: string
	@Col({spec: 'float'}) battery!: number
}

@Entity({schema: true})
class Settings extends BaseEntity<Settings>()
{
	@Col() lang!: string
	@Col() dnd!: boolean
	@Col({val: v => vs.string(v) || vs.boolean(v)}) dark_mode!: string | boolean

	@Col() notif_safe_zone_tracking!: boolean
	@Col() notif_offline_patient!: boolean
	@Col() notif_new_login!: boolean
	@Col() notif_setting_modified!: boolean
}

@Entity({schema: true})
class TextMessage extends BaseEntity<TextMessage>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col({spec: 'id'}) user_id!: Id
	@Col() is_from_patient!: boolean
	@Col() datetime!: number
	@Col() message!: string
	@Col() play_count!: number
}

@Entity({schema: true})
class Token extends BaseEntity<Token>() {
	@Col() token!: string
	@Col({spec: 'id'}) userId!: Id
}

@Entity({alias: 't_user', schema: true})
class User extends BaseEntity<User>() {
	@Col() first_name!: string
	@Col() last_name!: string
	@Col() email!: string
	@Col() phone!: string
	@Col() password!: string
	@Col() active!: boolean
	@Col({spec: 'id'}) settings_id!: Id
}

@Entity({schema: true})
class Zone extends BaseEntity<Zone>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col() type!: string
	@Col() name!: string
	@Col() color!: number
	@Col() is_safe!: boolean
	// dummy validator to create schema, don't worry this is not in production (see orm/zone.ts)
	@Col({val: () => true}) coords!: any
}

@Entity({schema: true})
class VirtualPatient extends BaseEntity<VirtualPatient>() {
	@Col({spec: 'id'}) patientId!: Id
	@Col({spec: 'id'}) userId!: Id
}

@Entity({schema: true})
export class EmailCode extends BaseEntity<EmailCode>() {
	@Col() userId!: string
  @Col() emailCode!: string 
}

@Entity({schema: true})
export class PatientEvent extends BaseEntity<PatientEvent>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col() type!: PatientEventType
	@Col() date!: number
}

@Entity({schema: true})
export class PatientZoneEvent extends BaseEntity<PatientZoneEvent>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col({val: v => vs.string(v) || vs_danger.undefined(v)}) zone_id!: Id | undefined
	@Col() range_begin!: number
	@Col() range_end!: number
}

export async function x_0_create_base_tables(tx: MigrationTransaction) {
	await tx.create_table(SchemaDB)
	await tx.create_table(CalendarEvent)
	await tx.create_table(Notification)
	await tx.create_table(PatientCalendarEvent)
	await tx.create_table(PatientUser)
	await tx.create_table(Patient)
	await tx.create_table(Settings)
	await tx.create_table(TextMessage)
	await tx.create_table(Token)
	await tx.create_table(User)
	await tx.create_table(Zone)
	await tx.create_table(VirtualPatient)
	await tx.create_table(EmailCode)
	await tx.create_table(PatientEvent)
	await tx.create_table(PatientZoneEvent)
}

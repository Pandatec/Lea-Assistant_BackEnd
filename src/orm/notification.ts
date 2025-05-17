import { Id } from '../driver'
import { Entity, BaseEntity, Col, FwdQuery, fwdQuery } from '../orm'
import { sendToClients } from '../websocket/app/client'

@Entity()
export default class Notification extends BaseEntity<Notification>() {
	@Col({spec: 'id'}) user_id!: Id
	@Col() created_at!: number
	@Col() is_read!: boolean
	@Col() title!: string
	@Col() message!: string

	static async allForUserId(userKey: Id, fwd: FwdQuery | undefined = undefined) {
		return this.query(q => fwdQuery(q.where('user_id', '==', userKey), fwd))
	}

	static async unreadForUserId(userKey: Id) {
		return this.allForUserId(userKey, q => q.where('is_read', '==', false))
	}

	static async createNew(user_id: Id, title: string, message: string) {
		const res = this.new({
			user_id: user_id,
			created_at: Math.round(Date.now() / 1000.0),
			is_read: false,
			title: title,
			message: message
		})
		sendToClients(user_id, 'newNotification', res.toJson())
		return res
	}
}
// Imports
import { Id } from '../driver'
import { Entity, BaseEntity, Col } from '../orm'

@Entity()
export default class Token extends BaseEntity<Token>()
{
	@Col() token!: string
	@Col({spec: 'id'}) userId!: Id
}

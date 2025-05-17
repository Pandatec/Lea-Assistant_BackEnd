import { Driver, Collection as DriverCollection, Query as DriverQuery, Transaction as DriverTransaction, Model, Id, Entity, Op, Meta } from "../driver";

function opToFilter(op: Op, value: any): (v: any) => boolean {
	if (op === '==')
		return v => v === value
	else if (op === '<=')
		return v => v <= value
	else if (op === '>=')
		return v => v >= value
	else
		throw new Error(`No such op '${op}'`)
}

function dirToCmp(dir: 'asc' | 'desc'): (a: any, b: any) => number {
	if (dir == 'asc')
		return (a, b) => a - b
	else if (dir == 'desc')
		return (a, b) => b - a
	else
		throw new Error(`No such dir '${dir}'`)
}

const storage: { [key: string]: any[] } = {}

function modelStorage(model: Model) {
	if (storage[model.name] === undefined)
		storage[model.name] = []
	return storage[model.name]
}

class Query implements DriverQuery {
	ents: any[]

	constructor(ents: any[]) {
		this.ents = ents
	}

	async get(): Promise<Entity[]> {
		return this.ents
	}

	where(field: string, op: Op, value: any): Query {
		const f = opToFilter(op, value)
		return new Query(this.ents.filter(v => f(v[field])))
	}

	order(field: string, dir?: 'asc' | 'desc'): Query {
		const cmp = dirToCmp(dir !== undefined ? dir : 'asc')
		return new Query(this.ents.sort((a, b) => cmp(a[field], b[field])))
	}

	offset(start: number): Query {
		return new Query(this.ents.slice(start))
	}

	limit(count: number): Query {
		return new Query(this.ents.slice(0, count))
	}
}

let id_counter = 0

class Transaction implements DriverTransaction {
	private saved: Entity[] = []
	private deleted: Entity[] = []

	async save(entities: Entity[]): Promise<void> {
		this.saved = this.saved.concat(entities)
	}

	async delete(entities: Entity[]): Promise<void> {
		this.deleted = this.deleted.concat(entities)
	}

	async create_table(): Promise<void> {
	}
	async add_columns(): Promise<void> {
	}
	async remove_columns(): Promise<void> {
	}

	async commit(): Promise<void> {
		for (const s of this.deleted) {
			const k = s[Meta].name
			storage[k] = storage[k].filter(v => v.id !== s.id)
		}
		for (const s of this.saved) {
			s[Meta].validate(s)
			modelStorage(s[Meta])

			const k = s[Meta].name
			const c = Object.assign({}, s)
			const ndx = storage[k].findIndex(v => v.id === s.id)
			if (ndx === -1) {
				s.id = (id_counter++).toString()
				c.id = s.id
				storage[k].push(s)
			} else
				storage[k][ndx] = c
		}
	}
}

class Collection implements DriverCollection {
	model: Model

	constructor(model: Model) {
		this.model = model
	}

	async get(): Promise<Entity[]> {
		return await (new Query(modelStorage(this.model))).get()
	}

	where(field: string, op: Op, value: any): Query {
		return (new Query(modelStorage(this.model))).where(field, op, value)
	}

	order(field: string, dir?: 'asc' | 'desc'): Query {
		return (new Query(modelStorage(this.model))).order(field, dir)
	}

	offset(start: number): Query {
		return (new Query(modelStorage(this.model))).offset(start)
	}

	limit(count: number): Query {
		return (new Query(modelStorage(this.model))).limit(count)
	}

	async find(id: Id): Promise<Entity | undefined> {
		return (await (new Query(modelStorage(this.model))).where('id', '==', id).get())[0]
	}
}

export class Transient implements Driver {
	async connect(): Promise<void> {
	}

	async is_model_present() {
		return true
	}

	collection(model: Model): DriverCollection {
		return new Collection(model)
	}

	async transaction(): Promise<Transaction> {
		return new Transaction()
	}
}
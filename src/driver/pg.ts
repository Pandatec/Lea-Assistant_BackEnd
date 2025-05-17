import { Driver, Collection as DriverCollection, Query as DriverQuery, Transaction as DriverTransaction, Model, Id, Entity, Op, Meta, Column } from "../driver";
import { Pool, PoolClient } from 'pg'
import { logger } from "../utils";

function opToPg(op: Op): string {
	if (op === '==')
		return '='
	else
		return op
}

type Where = {
	field: string,
	op: Op,
	value: any
}

type Order = {
	field: string,
	dir?: 'asc' | 'desc'
}

function convertColumn(col: Column, value: any): any {
	if (col.type === 'boolean')
		return value
	else if (col.type === 'integer')
		return parseInt(value)
	else if (col.type === 'float')
		return parseFloat(value)
	else if (col.type === 'string')
		return value
	else if (col.type === 'object')
		return value
	else
		throw new Error(`Postgres: no such type '${col.type}' for column '${col.name}'`)
}

class Query implements DriverQuery {
	private pool: Pool
	private model: Model
	private where_clauses: Where[]
	private order_clauses: Order[]
	private offset_clause?: number
	private limit_clause?: number

	constructor(pool: Pool, model: Model, where: Where[], order: Order[], offset?: number, limit?: number) {
		this.pool = pool
		this.model = model
		this.where_clauses = where
		this.order_clauses = order
		this.offset_clause = offset
		this.limit_clause = limit
	}

	async get(): Promise<Entity[]> {
		let extra = ''
		const args: any[] = []
		const push_arg = (arg: any): string => {
			args.push(arg)
			return `\$${args.length}`
		}

		if (this.where_clauses.length > 0)
			extra = `${extra} WHERE ${this.where_clauses.map(w => `${w.field.toLowerCase()} ${opToPg(w.op)} ${push_arg(w.value)}`).join(' AND ')}`
		if (this.order_clauses.length > 0) {
			if (this.order_clauses.length !== 1)
				logger.error(`Postgres: more than one ORDER BY for model ${this.model.name}: ${this.order_clauses}`)
			const oc = this.order_clauses[0]
			extra = `${extra} ORDER BY ${oc.field.toLowerCase()} ${oc.dir !== undefined ? oc.dir : 'asc'}`
		}
		if (this.offset_clause !== undefined)
			extra = `${extra} OFFSET ${this.offset_clause}`
		if (this.limit_clause !== undefined)
			extra = `${extra} LIMIT ${this.limit_clause}`

		const res = await this.pool.query(`SELECT * FROM ${this.model.name}${extra}`, args)
		return res.rows.map(e => {
			const res: any = {id: e.id}
			for(const c of this.model.columns)
				res[c.name] = convertColumn(c, e[c.name.toLowerCase()])
			return res as any
		})
	}

	where(field: string, op: Op, value: any): Query {
		return new Query(this.pool, this.model, this.where_clauses.concat([{
			field: field,
			op: op,
			value: value
		}]), this.order_clauses, this.offset_clause, this.limit_clause)
	}

	order(field: string, dir?: 'asc' | 'desc'): Query {
		return new Query(this.pool, this.model, this.where_clauses, this.order_clauses.concat([{
			field: field,
			dir: dir
		}]), this.offset_clause, this.limit_clause)
	}

	offset(start: number): Query {
		return new Query(this.pool, this.model, this.where_clauses, this.order_clauses, start, this.limit_clause)
	}

	limit(count: number): Query {
		return new Query(this.pool, this.model, this.where_clauses, this.order_clauses, this.offset_clause, count)
	}
}

function typeToPg(col: Column): string {
	if (col.type === 'boolean')
		return 'BOOLEAN'
	else if (col.type === 'integer')
		return 'BIGINT'
	else if (col.type === 'float')
		return 'FLOAT8'
	else if (col.type === 'string') {
		if (col.is_id)
			return 'BIGINT'
		else
			return 'TEXT'
	} else if (col.type === 'object')
		return 'JSONB'
	else
		throw new Error(`No such type '${col.type}'`)
}

class Transaction implements DriverTransaction {
	private client: PoolClient

	constructor(client: PoolClient) {
		this.client = client
	}

	async begin() {
		await this.client.query('BEGIN')
	}

	async save(entities: Entity[]): Promise<void> {
		for (const e of entities) {
			const m = e[Meta]
			m.validate(e)

			const args = m.columns.map(c => {
				const res = (e as any)[c.name]
				if (c.type === 'object')
					return JSON.stringify(res)
				else if (c.is_id)
					return parseInt(res)
				else
					return res
			})
			if (e.id === undefined) {
				const values = []
				for (let i = 0; i < m.columns.length; i++)
					values.push(`\$${i + 1}`)
				const model_params = `${m.name}(${m.columns.map(c => c.name.toLowerCase()).join(', ')}) VALUES (${values.join(', ')})`

				const res = await this.client.query(`INSERT INTO ${model_params} RETURNING id`, args)
				e.id = res.rows[0].id
			} else {
				const values = []
				for (let i = 0; i < m.columns.length; i++)
					values.push(`${m.columns[i].name.toLowerCase()} = $${(i + 2)}`)
				await this.client.query(`UPDATE ${m.name} SET ${values.join(', ')} WHERE id = $1`, [parseInt(e.id)].concat(args))
			}
		}
	}

	async delete(entities: Entity[]): Promise<void> {
		for (const e of entities)
			await this.client.query(`DELETE FROM ${e[Meta].name} WHERE id = $1`, [parseInt(e.id)])
	}

	async create_table(model: Model): Promise<void> {
		await this.client.query(`CREATE TABLE ${model.name}(id BIGSERIAL, ${model.columns.map(c => `${c.name} ${typeToPg(c)}`).join(', ')})`)
	}

	async add_columns(model: Model, cols: Column[]): Promise<void> {
		await this.client.query(`ALTER TABLE ${model.name} ${cols.map(c => `ADD COLUMN ${c.name} ${typeToPg(c)}`).join(', ')}`)
	}

	async remove_columns(model: Model, cols: Column[]): Promise<void> {
		await this.client.query(`ALTER TABLE ${model.name} ${cols.map(c => `DROP COLUMN ${c.name}`).join(', ')}`)
	}

	async commit(): Promise<void> {
		await this.client.query('COMMIT')
		this.client.release()
	}
}

class Collection implements DriverCollection {
	private pool: Pool
	model: Model

	constructor(pool: Pool, model: Model) {
		this.pool = pool
		this.model = model
	}

	private all() {
		return new Query(this.pool, this.model, [], [])
	}

	async get(): Promise<Entity[]> {
		return await this.all().get()
	}

	where(field: string, op: Op, value: any): Query {
		return this.all().where(field, op, value)
	}

	order(field: string, dir?: 'asc' | 'desc'): Query {
		return this.all().order(field, dir)
	}

	offset(start: number): Query {
		return this.all().offset(start)
	}

	limit(count: number): Query {
		return this.all().limit(count)
	}

	async find(id: Id): Promise<Entity | undefined> {
		return (await this.all().where('id', '==', id).get())[0]
	}
}

export class Pg implements Driver {
	private pool: Pool
	private models: Model[]

	constructor() {
		const user = process.env['PGUSER']
		const password = process.env['PGPASSWORD']
		const database = process.env['PGDATABASE']

		if (user === undefined || password === undefined || database === undefined)
			logger.error("Postgres: no credentials supplied. Specify 'PGUSER', 'PGPASSWORD' and 'PGDATABASE' in your environment.\nIf you are setting up, make sure you have PostgreSQL installed with a user and crendentials specified in the environment, and run `npm run create_db` to create a fresh database and `npm run migrate` to have it up-to-date.")

		this.pool = new Pool()
		this.models = []
	}

	async connect() {
		const client = await this.pool.connect()
		client.release()

		for (const m of this.models)
			if (!await this.is_model_present(m.name))
				logger.error(`Postgres: table '${m.name}' not found, have you run \`npm run migrate\`?`)
	}

	async is_model_present(model_name: string) {
		model_name = model_name.toLowerCase()
		const client = await this.pool.connect()
		const qres = await client.query(`
			SELECT EXISTS (
				SELECT FROM information_schema.tables
				WHERE
					table_name = $1
			);
		`, [model_name])
		const res = qres.rows[0].exists
		client.release()
		return res

	}

	collection(model: Model): DriverCollection {
		this.models.push(model)
		return new Collection(this.pool, model)
	}

	async transaction(): Promise<Transaction> {
		const res = new Transaction(await this.pool.connect())
		await res.begin()
		return res
	}
}
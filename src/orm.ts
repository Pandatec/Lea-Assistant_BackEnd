import "reflect-metadata"
import { logger } from './utils'
import { Meta, Entity as DriverEntity, Transaction as DriverTransaction, Model, Type, Id, Column, Validator } from "./driver"
import { Collection, Driver, Query } from './driver'
import { Transient } from "./driver/transient"
import { Pg } from "./driver/pg"

function getDriver(): Driver {
	if (process.env['DB_DRIVER_TRANSIENT'] === 'true') {
		logger.info("[DB] Using transient DB. All content will be lost at termination of this program.")
		return new Transient()
	} else {
		logger.info("[DB] Using Postgres persistent DB.")
		return new Pg()
	}
}

const driver = getDriver()

export async function connect() {
	await driver.connect()
	logger.info("Connected to database.")
}

export const vs/*: {[key: string]: Validator}*/ = {
	string(v: any) {
		return typeof(v) === 'string'
	},
	integer(v: any) {
		return typeof(v) === 'number' && Math.round(v) === v
	},
	float(v: any) {
		return typeof(v) === 'number'
	},
	boolean(v: any) {
		return typeof(v) === 'boolean'
	}
	// WARNING: THIS CANNOT POSSIBLY CONTAIN 'object', 'undefined' or 'null'
	// DONT KEEP WEIRD SHIT HERE, ONLY USEFUL POSITIVE VALUES
}
export const vs_danger/*: {[key: string]: Validator}*/ = {
	object(v: any) {
		return typeof(v) === 'object'
	},
	// Warning: this is a parameric validator
	key_count(c: number): Validator {
		return (v: any) => Object.keys(v).length === c
	},
	// Warning: this is a parameric validator
	array_size(c: number): Validator {
		return (v: any) => v.length === c
	},
	// Warning: this is a parameric validator
	each(val: Validator): Validator {
		return (v: any[]) => v.every(val)
	},
	// YOU CAN PUT ALL OF YOUR WEIRD SHIT HERE
	undefined(c: any) {
		return typeof(c) === 'undefined'
	}
}

function ctorToType(f: Function): Type {
	if (f === Boolean)
		return 'boolean'
	else if (f === Number)
		return 'integer'
	else if (f === String)
		return 'string'
	else
		return 'object'
}

function ctorToVs(f: Function): Validator | undefined {
	if (f === Boolean)
		return vs.boolean
	else if (f === Number)
		return vs.integer
	else if (f === String)
		return vs.string
	else
		return undefined
}

let colsacc: Column[] = []
let methsacc: string[] = []

class Kind
{
	model: Model
	collection: Collection
	meths: string[]

	constructor(name: string, columns: Column[], meths: string[], schema: boolean) {
		this.model = new Model(name, columns)
		this.meths = meths.concat(['toJson', 'getKey'])
		if (!schema)
			this.collection = driver.collection(this.model)
		else
			this.collection = undefined as any
	}
}

interface EntityOptions {
	alias?: string,
	schema?: boolean
}

export function Entity(opt?: EntityOptions): ClassDecorator {
	const schema = opt !== undefined && opt.schema !== undefined ? opt.schema : false
	return function (target) {
		let n = target.name
		let k = new Kind(opt !== undefined && opt.alias !== undefined ? opt.alias : n, colsacc, methsacc, schema);

		(target as any).kind = k;

		colsacc = []
		methsacc = []
	}
}

enum ColSpecEnum {
	id,
	float
}
type ColSpec = keyof typeof ColSpecEnum

export function Col(opt?: {val?: Validator, spec?: ColSpec}): PropertyDecorator {
	return function (object: Object, propertyName: string | symbol): void {
		let pn = propertyName as string
		const dt = Reflect.getMetadata("design:type", object, propertyName)
		let t = ctorToType(dt)
		let v = opt?.val !== undefined ? opt?.val : ctorToVs(dt)
		if (opt?.spec === 'float') {
			if (t !== 'integer')
				throw new Error(`Property '${pn}' of ${object.constructor.name}: 'float' qualifier can only be applied to 'number' type`)
			v = vs.float
			t = 'float'
		}
		if (v === undefined)
			throw new Error(`Cannot infer validation of property '${pn}' of ${object.constructor.name}, supply validator to Col annotation`)

		let is_id = false
		if (opt?.spec === 'id') {
			if (t !== 'string')
				throw new Error(`Property '${pn}' of ${object.constructor.name}: 'id' qualifier can only be applied to 'Id' type`)
			is_id = true
		}
		colsacc.push(new Column(pn, t, false, is_id, v))
	}
}

export function Met(): PropertyDecorator {
	return function (_: Object, propertyName: string | symbol): void {
		methsacc.push(propertyName as string)
	}
}

export type Create<T> = Omit<Omit<{
	[P in keyof T as T[P] extends Function ? never : P]: T[P];
}, typeof Meta>, 'id'>;

export type FwdQuery = ((query: Query) => Query) | undefined
export function fwdQuery(query: Query, fwd: FwdQuery) {
	if (fwd === undefined)
		return query
	else
		return fwd(query)
}

export function BaseEntity<T>()
{
	return class BaseEntity implements DriverEntity
	{
		id!: Id
		[Meta]: Model
		private static kind: Kind

		protected static fromEntity(data: any): T
		{
			const s: any = new this()
			for (let m of this.kind.meths)
				data[m] = s[m]
			data[Meta] = this.kind.model
			return data as unknown as T
		}

		static new<V extends Create<T>>(v: V): T
		{
			return this.fromEntity(v)
		}

		static async query(fwd: FwdQuery = undefined): Promise<T[]>
		{
			const res = await fwdQuery(this.kind.collection, fwd).get()
			return res.map(e => this.fromEntity(e))
		}

		static async fromKey(key: Id): Promise<T | undefined> {
			const r = await this.kind.collection.find(key)
			if (r === undefined)
				return undefined
			return this.fromEntity(r)
		}


		// IF YOU WANT TO ADD A NEW COMMON METHOD, ADD ITS NAME IN THE CONSTRUCTOR OF Kind
		getKey(): Id {
			return this.id
		}

		toJson(): any {
			return Object.assign({}, this)
		}
	}
}

export class Transaction {
	protected tx: DriverTransaction

	constructor(tx: DriverTransaction) {
		this.tx = tx
	}

	private async saveNpack(ents: DriverEntity[]) {
		await this.tx.save(ents)
	}

	async save(...ents: DriverEntity[]) {
		await this.saveNpack(ents)
	}

	private async deleteNpack(ents: DriverEntity[]) {
		await this.tx.delete(ents)
	}

	async delete(...ents: DriverEntity[]) {
		await this.deleteNpack(ents)
	}
}

export class MigrationTransaction extends Transaction {
	constructor(tx: DriverTransaction) {
		super(tx)
	}

	async create_table(base: ReturnType<typeof BaseEntity>) {
		const k: Kind = (base as any).kind
		if (k.collection !== undefined)
			throw new Error(`Create table only accepts models created with the \`schema: true\` flag (model: ${base.name})`)
		await this.tx.create_table(k.model)
	}

	private fetch_columns(k: Kind, ...col: string[]) {
		if (k.collection !== undefined)
			throw new Error(`Table modification only accepts models created with the \`schema: true\` flag (model: ${k.model.name})`)
		const cols = col.map(c => {
			const got = k.model.columns.find(cc => cc.name === c)
			if (got === undefined)
				throw new Error(`No such column '${c}' for model ${k.model.name}`)
			return got
		})
		return cols
	}

	async add_columns<T extends ReturnType<typeof BaseEntity>>(base: T, ...cols: string[]) {
		const k: Kind = (base as any).kind
		await this.tx.add_columns(k.model, this.fetch_columns(k, ...cols))
	}

	async remove_columns<T extends ReturnType<typeof BaseEntity>>(base: T, ...cols: string[]) {
		const k: Kind = (base as any).kind
		await this.tx.remove_columns(k.model, this.fetch_columns(k, ...cols))
	}
}

export async function transaction(cb: (tx: Transaction) => Promise<void>) {
	const dtx = await driver.transaction()
	const tx = new Transaction(dtx)
	await cb(tx)
	await dtx.commit()
}

async function migrationTransaction(cb: (tx: MigrationTransaction) => Promise<void>) {
	const dtx = await driver.transaction()
	const tx = new MigrationTransaction(dtx)
	await cb(tx)
	await dtx.commit()
}

export async function commit(...ent: DriverEntity[]): Promise<void> {
	await transaction(async tx => {
		await tx.save(...ent)
	})
}

export async function remove(...ent: DriverEntity[]): Promise<void> {
	await transaction(async tx => {
		await tx.delete(...ent)
	})
}


/*@Entity()
export class TestDB extends BaseEntity<TestDB>() {
	@Col() isTest!: boolean
}*/

/*export async function assertTestDB() {
	const t = await TestDB.query()
	if (t.length !== 1) {
		logger.warn('No TestDB signature')
		logger.info(t)
		throw Error('No TestDB signature. You might want to run `FIRESTORE_EMULATOR_HOST=leassistant.fr:9001 npm run transition --name=mark_test_db` to mark test DB as disposable')
	}
	if (t[0].isTest !== true) {
		logger.info(t[0])
		throw Error('TestDB signature mismatch')
	}
}*/

// PLEASE do not call that like nothing, it's way too dangerous to even be shown to most reasonable adults
/*export async function nukeDB(yousurebuddy: boolean = false, prettyplease: string = 'NOPE') {
	if (!(yousurebuddy === true && prettyplease === 'yesjohniknowwhatimdoing')) {
		logger.error("You really don't want to erase the entire current DB!! Step back!!! Don't even attempt to pretty please if you got there in the first place!")
		return
	}
	await firestore.runTransaction(async tx => {
		for (const c of await firestore.listCollections()) {
			const r = await c.get()
			for (const d of r.docs)
				tx.delete(d.ref)
		}
	})
}*/

/*export async function resetTestDB() {
	await assertTestDB()
	await nukeDB(true, 'yesjohniknowwhatimdoing')
	await markTestDB()
}*/

// WARNING: this will allow current DB to be erased for testing!!
/*export async function markTestDB() {
	if (process.env['FIRESTORE_EMULATOR_HOST'] === 'leassistant.fr:8000')
		throw Error('MarkTestDB: Using staging DB!!')
	if (process.env['FIRESTORE_EMULATOR_HOST'] === undefined)
		throw Error('MarkTestDB: Using production DB!!')
	if (process.env['FIRESTORE_EMULATOR_HOST'] !== 'leassistant.fr:9001')
		throw Error('MarkTestDB: Dunno what you are doing but stop immediately!!')
	const ts = await TestDB.query()
	await transaction(async tx => {
		await tx.delete(...ts)
		await tx.save(TestDB.new({
			isTest: true
		}))
	})
	await migrate()
}*/


@Entity()
export class SchemaDB extends BaseEntity<SchemaDB>() {
	// this is the next migration ID to run
	// when the DB is fully migrated, this number represents a migration that does not exist yet
	@Col() schemaVersion!: number
}

export async function getSchema() {
	if (!await driver.is_model_present('SchemaDB'))
		return SchemaDB.new({schemaVersion: 0})

	let schemas = await SchemaDB.query()
	if (schemas.length !== 1) {
		const s = SchemaDB.new({schemaVersion: 0})
		await commit(s)
		schemas = [s]
	}
	return schemas[0]
}

import { getMigrationCount, migrations } from "./migrations"

export async function migrate() {
	const schema = await getSchema()
	const cur = schema.schemaVersion
	const count = getMigrationCount()
	for (let i = cur; i < count; i++) {
		logger.info(`Running migration #${i}..`)
		await migrationTransaction(async tx => {
			schema.schemaVersion = i + 1
			const migration = migrations[i]
			await migration(tx)
			await tx.save(schema)
		})
		logger.info(`Migration #${i} DONE.`)
	}

	logger.info('migrate: success.')
}

export function unique(ents: DriverEntity[]) {
	const ndx: {[key: string]: {[key: string]: DriverEntity}} = {}
	for (const e of ents) {
		const k = e[Meta].name
		if (ndx[k] === undefined)
			ndx[k] = {}
		if (ndx[k][e.id] === undefined)
			ndx[k][e.id] = e
	}
	const res: DriverEntity[] = []
	for (const k in ndx) {
		const n = ndx[k]
		for (const eid in n)
			res.push(n[eid])
	}
	return res
}
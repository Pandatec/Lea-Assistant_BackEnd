import { logger } from "./utils"
import { inspect as utilInspect } from 'util'

enum TypeEnum {
	boolean,
	integer,
	float,
	string,
	object
}

export type Type = keyof typeof TypeEnum

export type Validator = (value: any) => boolean

export class Column {
	name: string
	type: Type
	nullable: boolean
	is_id: boolean
	validator: Validator

	constructor(name: string, type: Type, nullable: boolean, is_id: boolean, validator: Validator) {
		this.name = name
		this.type = type
		this.nullable = nullable
		this.is_id = is_id
		this.validator = validator
	}
}

export class Model {
	name: string
	columns: Column[]

	constructor(name: string, columns: Column[]) {
		this.name = name
		this.columns = columns
	}

	validate(ent: Entity): void {
		for (const c of this.columns)
			if (!c.validator((ent as any)[c.name])) {
				logger.info(`Failed validated member inspect: ${utilInspect((ent as any)[c.name], undefined, null)}`)
				throw new Error(`Property '${c.name}' of ${this.name} failed validation, record is invalid`)
			}
	}
}

export type Id = string
export const Meta = Symbol()

export type Entity = {
	id: Id
	[Meta]: Model
}

export interface Transaction {
	save(entities: Entity[]): Promise<void>
	delete(entities: Entity[]): Promise<void>
	create_table(model: Model): Promise<void>
	add_columns(model: Model, columns: Column[]): Promise<void>
	remove_columns(model: Model, columns: Column[]): Promise<void>
	commit(): Promise<void>
}

export type Op = '==' | '>=' | '<='

export interface Query {
	get(): Promise<Entity[]>
	where(field: string, op: Op, value: any): Query

	// dir: 'asc' by default
	order(field: string, dir?: 'asc' | 'desc'): Query

	offset(start: number): Query
	limit(count: number): Query
}

export interface Collection extends Query {
	model: Model
	find(id: Id): Promise<Entity | undefined>
}

export interface Driver {
	connect(): Promise<void>
	is_model_present(model_name: string): Promise<boolean>
	collection(model: Model): Collection
	transaction(): Promise<Transaction>
}
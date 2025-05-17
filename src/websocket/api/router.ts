import Koa from 'koa'
import { backErrorToBody, backErrorToStatus } from '../../server'
import { BackError } from '../../utils'
import KoaRouter from 'koa-router'
import koaBodyParser from 'koa-bodyparser'

export interface Request {
	id: number,
	token: string | undefined,
	method: string,
	path: string,
	query: {[key: string]: string},
	body: any
}

interface Response {
	id: number,
	status: number,
	body: any
}

type Handler = (ctx: Koa.Context) => Promise<void>
const handlers: {[key: string]: Handler} = {}

function handlerName(method: string, path: string) {
	return `${method} ${path}`
}

export class Router {
	private prefix: string
	private koaRouter: KoaRouter
	private koaApp: Koa

	constructor(koaApp: Koa, prefix: string) {
		this.prefix = prefix

		this.koaRouter = new KoaRouter({
			prefix: prefix
		})
		this.koaRouter.use('/', koaBodyParser())
		this.koaApp = koaApp
	}

	private method(method: string, path: string, handler: Handler) {
		handlers[handlerName(method, `${this.prefix}${path}`)] = handler
	}

	private genMethod(method: keyof KoaRouter): (path: string, handler: Handler) => Router {
		return (path: string, handler: Handler) => {
			(this.koaRouter[method] as any)(path, handler)
			this.method(method.toUpperCase(), path, handler)
			return this
		}
	}

	get = this.genMethod('get')
	post = this.genMethod('post')
	patch = this.genMethod('patch')
	delete = this.genMethod('delete')

	commit() {
		this.koaApp
			.use(this.koaRouter.routes())
			.use(this.koaRouter.allowedMethods())
	}
}

export async function handle(req: Request): Promise<Response> {
	try {
		const h = handlers[handlerName(req.method, req.path)]
		if (h === undefined)
			throw new BackError(404, 'NO_PATH')
		const ctx = {
			query: req.query,
			request: {
				body: req.body
			},
			header: {
				authorization: `Bearer ${req.token}`
			}

		} as unknown as Koa.Context

		await h(ctx)

		return {
			id: req.id,
			status: ctx.status,
			body: ctx.body
		}
	} catch (e) {
		return {
			id: req.id,
			status: backErrorToStatus(e),
			body: backErrorToBody(e)
		}
	}
}
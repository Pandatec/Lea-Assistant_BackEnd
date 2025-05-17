export interface Subscription {
	unsubscribe(): void;
}

export class Provider<T> {
	private clients: {[key: number]: (v: T) => Promise<void>}
	private static client_count = 0

	constructor() {
		this.clients = {}
	}

	protected issue(v: T) {
		for (const i in this.clients)
			this.clients[i](v)
	}

	subscribe(cb: (v: T) => Promise<void>): Subscription {
		const ndx = Provider.client_count
		Provider.client_count += 1
		this.clients[ndx] = cb

		const lp = this
		return {
			unsubscribe() {
				delete lp.clients[ndx]
			}
		}
	}
}
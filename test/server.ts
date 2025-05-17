import { Server } from '../src/server'

export const server = new Server(8083, 8086)

type LockUser = (done: Mocha.Done) => void
const locksQueue: LockUser[] = []
let isLockRunning = false

let i = 0;

function lockResetDB(u: LockUser): (done: Mocha.Done) => void {
	return (done: Mocha.Done) => {
		// complete bullshit
		(async (done: Mocha.Done) => {
			try {
				if (isLockRunning)
					locksQueue.push(u)
				else {
					isLockRunning = true
					//await resetTestDB()
					// Do not remove await: some callbacks might be async
					const ia = i++;
					console.log(`RUNNING #${ia} (INIT)`)
					await u(done)
					console.log(`RUNNING #${ia} (INIT) DONE`)
					while (true) {
						const p = locksQueue.pop()
						if (p === undefined)
							break
						//await resetTestDB()
						// Do not remove await: some callbacks might be async
						const ia = i++;
						console.log(`RUNNING #${ia}`)
						await p(done)
						console.log(`RUNNING #${ia} DONE`)
					}
					isLockRunning = false
				}
			} catch (e) {
				done(e)
			}
		})(done)
	}
}

export function itLock(desc: string, u: LockUser) {
	return it(desc, lockResetDB(u))
}
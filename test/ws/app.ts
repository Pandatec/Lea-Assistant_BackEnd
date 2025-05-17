import { server, itLock } from '../server'
import Websocket, { connection } from 'websocket'
import { expect } from 'chai'
import { clients as devClients, DeviceClient as DevClient } from '../../src/websocket/dev/client'
import { Id } from '../../src/driver'
import { DiagResult } from '../../src/websocket/dev/input'
import { addMakeIdRes } from '../../src/utils'
import { Connection } from '../../src/websocket/connection'

let stntLog = {
	log(msg: string) {
		console.log(`STUNT: ${msg}`)
	}
}

const sendBytes = (connection: Websocket.connection, bytes: Buffer): void => {
	connection.sendBytes(bytes);
}

const devClientForToken = (token: string): DevClient => {
	for (const i in devClients) {
		const c = devClients[i] as DevClient
		if (c.doesMatchToken(token))
			return c
	}
	throw new Error('No such client')
}

const loginAppUser = (c: Websocket.connection): void => {
	sendJson(c, {
		type: 'login',
		email: 'user@example.com',
		token: userToken
	})
}

const loginDev = (c: Websocket.connection): void => {
	sendJson(c, {
		type: 'login',
		data: devToken
	})
}

const expDummyPos = (obj: any, elat: number = 42.0, elng: number = 43.0): void => {
	expect(obj.type).to.equal('locationPosition')
	expect(obj.data.lat).to.equal(elat)
	expect(obj.data.lng).to.equal(elng)
}

let userToken: string = undefined as any
let devToken: string = undefined as any
let devPatientId: Id = undefined as any

const connHandleMsg = (connection: Websocket.connection, cb: (data: any) => void) => {
	connection.on('message', (message) => {
		if (message.type === 'utf8') {
			let obj: any = JSON.parse(message.utf8Data!)
			cb(obj)
		}
	})
}

const connExpError = (wsc: Websocket.connection, done: Mocha.Done) => {
	wsc.on('close', (code) => {
		expect(code).to.be.equal(connection.CLOSE_REASON_INVALID_DATA)
		done()
	})
}

const sendText = (connection: Websocket.connection, text: string): void => {
	connection.sendUTF(text);
}

const sendJson = (connection: Websocket.connection, obj: any): void => {
	sendText(connection, JSON.stringify(obj))
}

const expErrClose = (c: Websocket.connection): void => {
	connExpError(c, () => {})
}


describe('WebSocket', () => {
	describe('/app', () => {
		itLock('should close connection with error on invalid login', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				connExpError(connection, done)
				sendJson(connection, {
					type: 'login'
				})
			})
			c.connect(server.wsURL('/app'))
		})
	}),
	describe('/dev', () => {
		itLock('server should provide a token on first connection that can be used on second connection', done => {
			let reconnectLater = (token: string) => {
				let c = new Websocket.client()
				c.on('connect', (connection) => {
					connHandleMsg(connection, obj => {
						expect(obj.type).to.be.equal('tokenAccepted')
						connection.close()
						done()
					})
					sendJson(connection, {
						type: 'login',
						data: token
					})
				})
				c.connect(server.wsURL('/dev'))
			}

			let c = new Websocket.client()
			c.on('connect', (connection) => {
				let token: string
				connHandleMsg(connection, obj => {
					expect(obj.type).to.be.equal('token')
					token = obj.data
					connection.close()
					reconnectLater(token)
				})
				sendJson(connection, {
					type: 'firstConnexion',
					data: 1.0
				})
			})
			c.connect(server.wsURL('/dev'))
		}),
		itLock('server should not provide a new token on bad connection', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				connExpError(connection, done)
				sendJson(connection, {
					type: 'login',
					data: 'somebadtoken'
				})
			})
			c.connect(server.wsURL('/dev'))
		}),
		itLock('server should close the connection on no token in login msg', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				expErrClose(connection)
				sendJson(connection, {
					type: 'login',
					data: undefined	// verbose
				})
				connection.on('close', () => { done() })
			})
			c.connect(server.wsURL('/dev'))
		}),
		itLock('server should close the connection on bad text JSON', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				expErrClose(connection)
				sendText(connection, "definvalidjson")
				connection.on('close', () => { done() })
			})
			c.connect(server.wsURL('/dev'))
		})
	}),
	describe('/api', () => {
		itLock('should be able to make some bad requests through the HTTP API', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				connHandleMsg(connection, obj => {
					expect(obj.id).to.equal(42)
					expect(obj.status).to.equal(404)
					connection.close()
					done()
				})
				sendJson(connection, {
					id: 42,
					method: 'GET',
					path: 'nosuchpath',
					query: {},
					body: {}
				})
			})
			c.connect(server.wsURL('/api'))
		}),
		itLock('should abort connection on ill-formed requests', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				connExpError(connection, done)
				sendText(connection, 'definvalidjson')
			})
			c.connect(server.wsURL('/api'))
		}),
		itLock('should abort connection on binary', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				connExpError(connection, done)
				sendBytes(connection, Buffer.alloc(3))
			})
			c.connect(server.wsURL('/api'))
		}),
		itLock('should be able to try and register', done => {
			let c = new Websocket.client()
			c.on('connect', (connection) => {
				let state = 0
				let token: string
				connHandleMsg(connection, obj => {
					if (state === 0 && obj.id === 42) {
						expect(obj.status).to.equal(201)
						sendJson(connection, {
							id: 43,
							method: 'POST',
							path: '/v1/auth/login',
							query: {},
							body: {
								"email": "user@example.com",
								"password": "password"
							}
						})
						state = 1
					} else if (state === 1 && obj.id === 43) {
						expect(obj.status).to.equal(200)
						token = obj.body.access_token
						sendJson(connection, {
							id: 44,
							token: token,
							method: 'GET',
							path: '/v1/user/notifs/unread_count',
							query: {},
							body: {}
						})
						state = 2
					} else if (state === 2 && obj.id === 44) {
						expect(obj.status).to.equal(200)
						expect(obj.body.count).not.to.equal(undefined)
						connection.close()
						done()
					}
				})
				sendJson(connection, {
					id: 42,
					method: 'POST',
					path: '/v1/auth/register',
					query: {},
					body: {
						"first_name": "string",
						"last_name": "string",
						"email": "user@example.com",
						"phone": "string",
						"password": "password"
					}
				})
			})
			c.connect(server.wsURL('/api'))
		})
	}),
	describe('/bad_gateway', () => {
		itLock('should not be able to connect to an unknown endpoint', done => {
			let c = new Websocket.client()
			c.on('connectFailed', () => {
				done()
			})
			c.connect(server.wsURL('/bad_gateway'))
		})
	}),
	describe('minimal_gps', () => {
		itLock('should be able to transmit GPS data from device to app', done => {
			let api = new Websocket.client()
			let dev = new Websocket.client()
			let app = new Websocket.client()
			let apiConn: Websocket.connection = undefined as any
			let loginToken: string = undefined as any
			let devConn: Websocket.connection = undefined as any
			let appConn: Websocket.connection = undefined as any
			let devClient: DevClient = undefined as any

			let finish = () => {
				apiConn.close()
				devConn.close()
				appConn.close()
			}

			let discCount = 0
			let disc = () => {
				if (++discCount >= 3)
					done()
			}

			let connCount = 0
			let conn = () => {
				if (++connCount < 2)
					return
				devClient = devClientForToken(devToken)
				devPatientId = devClient.getPatientId()
				sendJson(apiConn, {
					id: 43,
					token: loginToken,
					method: 'PATCH',
					path: '/v1/user/pair',
					query: {},
					body: {
						temp_token: devClient.getPairingToken()
					}
				})
			}
			api.on('connect', (c) => {
				apiConn = c
				let state = 0
				connHandleMsg(c, obj => {
					if (state === 0) {	// waiting for app /api auth
						expect(obj.id).to.equal(42)
						expect(obj.status).to.equal(200)
						loginToken = obj.body.access_token
						userToken = loginToken
						loginAppUser(appConn)
						state = 1
					} else if (state === 1) {	// waiting for user pairing request response
						expect(obj.id).to.equal(43)
						expect(obj.status).to.equal(200)
						devClient.processIntent(undefined)
						devClient.processIntent(new DiagResult({
							displayName: 'Yes'
						}, {}))
						state = 2
					}
				})
				c.on('close', disc)
				sendJson(c, {
					id: 42,
					method: 'POST',
					path: '/v1/auth/login',
					query: {},
					body: {
						"email": "user@example.com",
						"password": "password"
					}
				})
			})
			api.connect(server.wsURL('/api'))

			dev.on('connect', (c) => {
				devConn = c
				let state = 0
				connHandleMsg(c, obj => {
					if (state === 0) {	// waiting for dev auth token
						expect(obj.type).to.equal('token')
						devToken = obj.data
						conn()
						state = 1
					} else if (state === 1) {	// waiting for GPS request
						expect(obj.type).to.equal('enableLocation')
						sendJson(c, {
							type: 'location',
							data: {
								lat: 42.0,
								lng: 43.0
							}
						})
						state = 2
					}
				})
				c.on('close', disc)
				sendJson(c, {
					type: 'firstConnexion',
					data: 1.0
				})
			})
			dev.connect(server.wsURL('/dev'))

			app.on('connect', (c) => {
				appConn = c
				let state = 0
				connHandleMsg(c, obj => {
					if (obj.type === 'newNotification')
						return
					if (state === 0) {	// waiting for app auth to success (called by /api login check)
						expect(obj.type).to.equal('tokenAccepted')
						conn()
						state = 1
					} else if (state === 1) {	// waiting for pairing accepted
						expect(obj.type).to.equal('pairingAccepted')
						sendJson(appConn, {
							type: 'enableLocation',
							patientId: devPatientId
						})
						state = 2
					} else if (state === 2) {
						expect(obj.type).to.equal('locationDiag')
						expect(obj.data).to.equal('location_unavailable')
						sendJson(devConn, {
							type: 'location',
							data: {
								lat: 12.0,
								lng: 14.0
							}
						})
						state = 3
					} else if (state === 3) {
						expDummyPos(obj, 12.0, 14.0)
						sendJson(appConn, {
							type: 'disableLocation'
						})
						finish()
						state = 3
					}
				})
				c.on('close', disc)
			})
			app.connect(server.wsURL('/app'))
		})
	}),
	describe('/app med', () => {
		itLock('should disconnect after 5 seconds no token', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after random JSON junk', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				sendText(c, 'defnotvalidjson')
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after sending binary', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				const buf = Buffer.alloc(4)
				try {
					new Connection(c, stntLog).send(buf, 'somejunk')
					expect.fail()
				} catch {
					new Connection(c, stntLog).send(buf)
					c.on('close', () => done())
					new Connection(c, stntLog).error('BAD_MSG')
				}
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after no email in login', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				sendJson(c, {
					type: 'login'
				})
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after bad email in login', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				sendJson(c, {
					type: 'login',
					email: '[definvalidmail]'
				})
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after requesting location from no patient', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				sendJson(c, {
					type: 'enableLocation',
					patientId: undefined	// verbose
				})
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after requesting location of unknown patient', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				loginAppUser(c)
				connHandleMsg(c, obj => {
					expect(obj.type === 'tokenAccepted')
					sendJson(c, {
						type: 'enableLocation',
						patientId: 'defninvalidpatient'
					})
				})
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should disconnect after sending unknown message type', done => {
			let app = new Websocket.client()
			app.on('connect', (c) => {
				sendJson(c, {
					type: 'definvalidmsgtype',
				})
				c.on('close', () => done())
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should be OK with consecutive login', done => {
				let app = new Websocket.client()
				app.on('connect', (c) => {
					sendJson(c, {
						type: 'login',
						email: 'user@example.com',
						token: userToken
					})
					let count = 0
					connHandleMsg(c, obj => {
						expect(obj.type === 'tokenAccepted')
						if (++count < 2)
							sendJson(c, {
								type: 'login',
								email: 'user@example.com',
								token: userToken
							})
						else
							c.close()
					})
					c.on('close', () => done())
				})
				app.connect(server.wsURL('/app'))
		}),
		itLock('should be OK with multiple sessions', done => {
			const count = 2
			let cconns: Websocket.connection[] = []
			let ccount = 0
			let conn = (c: Websocket.connection) => {
				cconns.push(c)
				if (++ccount < count)
					return
				for (const c of cconns)
					c.close()
			}
			let dcount = 0
			let disc = () => {
				if (++dcount >= count)
					done()
			}
			let createSession = (): Websocket.client => {
				let app = new Websocket.client()
				app.on('connect', (c) => {
					loginAppUser(c)
					connHandleMsg(c, obj => {
						expect(obj.type === 'tokenAccepted')
						conn(c)
					})
					c.on('close', disc)
				})
				app.connect(server.wsURL('/app'))
				return app
			}
			for (let i = 0; i < count; i++)
				createSession()
		})
	}),
	describe('/dev med', () => {
		itLock('should kick unlogged dev after 5 seconds', done => {
			let dev = new Websocket.client()
			dev.on('connect', (c) => {
				c.on('close', () => done())
			})
			dev.connect(server.wsURL('/dev'))
		}),
		itLock('multiple sessions will result in the only the more recent one being kept', done => {
			let dev = new Websocket.client()
			dev.on('connect', (c) => {
				sendJson(c, {
					type: 'firstConnexion',
					data: 1.0
				})
				let state = 0
				connHandleMsg(c, obj => {
					if (state === 0) {
						expect(obj.type).to.equal('token')
						let dev2 = new Websocket.client()
						dev2.on('connect', c => {
							sendJson(c, {
								type: 'login',
								data: obj.data
							})
						})
						dev2.connect(server.wsURL('/dev'))
						state = 1
					} else if (state === 1) {
						expect(obj.type).to.equal('enableLocation')
						state = 2
					} else if (state === 2)
						expect(obj.type).to.equal('error')
				})
				c.on('close', () => done())
			})
			dev.connect(server.wsURL('/dev'))
		}),
		itLock('should be able to update pairing token from the beginning on new device', done => {
			let dev = new Websocket.client()
			dev.on('connect', (c) => {
				sendJson(c, {
					type: 'firstConnexion',
					data: 1.0
				})
				let state = 0
				connHandleMsg(c, obj => {
					if (state == 0) {
						state = 1
						expect(obj.type).to.equal('token')
						devClientForToken(obj.data).updatePairingToken()
						c.close()
					}
				})
				c.on('close', () => done())
			})
			dev.connect(server.wsURL('/dev'))
		}),
		itLock('should be able to update pairing token from the beginning on paired device', done => {
			let dev = new Websocket.client()
			dev.on('connect', (co) => {
				sendJson(co, {
					type: 'login',
					data: devToken
				})
				let state = 0
				connHandleMsg(co, obj => {
					if (state == 0) {
						state = 1
						expect(obj.type).to.equal('tokenAccepted')
						devClientForToken(devToken).updatePairingToken()
						co.close()
					}
				})
				co.on('close', () => done())
			})
			dev.connect(server.wsURL('/dev'))
		}),
		itLock('should manage pairing token collision', done => {
			const count = 2
			let cconns: Websocket.connection[] = []
			let ccount = 0
			for (let i = 0; i < count; i++)
				addMakeIdRes(6, 'sametoken')
			let conn = (c: Websocket.connection) => {
				cconns.push(c)
				if (++ccount < count)
					return
				for (const c of cconns)
					c.close()
				done()
			}
			let createSession = (): Websocket.client => {
				let dev = new Websocket.client()
				dev.on('connect', c => {
					sendJson(c, {
						type: 'firstConnexion',
						data: 1.0
					})
					let state = 0
					connHandleMsg(c, obj => {
						if (state === 0) {
							state = 1
							expect(obj.type === 'token')
							conn(c)
						}
					})
				})
				dev.connect(server.wsURL('/dev'))
				return dev
			}
			for (let i = 0; i < count; i++)
				createSession()
		}),
		itLock('should not generate another pairing token if already paired', done => {
			let dev = new Websocket.client()
			dev.on('connect', (conn) => {
				sendJson(conn, {
					type: 'login',
					data: devToken
				})
				connHandleMsg(conn, obj => {
					expect(obj.type).equal('tokenAccepted')
					expect(devClientForToken(devToken).getPairingToken()).equal('')
					conn.close()
				})
				conn.on('close', () => { done() })
			})
			dev.connect(server.wsURL('/dev'))
		}),
		itLock('should be kicked after JSON w/ bad type', done => {
			let dev = new Websocket.client()
			dev.on('connect', (c) => {
				sendJson(c, {
					type: 'definvalidtype'
				})
				c.on('close', () => done())
			})
			dev.connect(server.wsURL('/dev'))
		})
	}),
	describe('GPS edge cases', () => {
		itLock('should request the offline device to turn on GPS on login', done => {
			let app = new Websocket.client()
			let dev = new Websocket.client()
			let devConn: Websocket.connection
			dev.on('connect', c => {
				devConn = c
				let state = 0
				connHandleMsg(c, obj => {
					if (state === 0) {
						expect(obj.type).to.equal('tokenAccepted')
						state = 1
					} else if (state === 1) {
						expect(obj.type).to.equal('enableLocation')
						sendJson(c, {
							type: 'location',
							data: {
								lat: 42.0,
								lng: 43.0
							}
						})
						state = 2
					}
				})
				loginDev(c)
			})
			app.on('connect', (c) => {
				let state = 0
				connHandleMsg(c, obj => {
					if (obj.type === 'newNotification')
						return
					if (state === 0) {	// waiting for dev login
						expect(obj.type).to.equal('tokenAccepted')
						sendJson(c, {
							type: 'enableLocation',
							patientId: devPatientId
						})
						state = 1
					} else if (state === 1) {
						expect(obj.type).to.equal('locationDiag')
						expect(obj.data).to.equal('location_disconnected')
						dev.connect(server.wsURL('/dev'))
						state = 2
					} else if (state === 2) {
						expDummyPos(obj)
						c.close()
						devConn.close()
						done()
					}
				})
				loginAppUser(c)
			})
			app.connect(server.wsURL('/app'))
		}),
		itLock('should request the offline device to turn on GPS on login, other way around on closure', done => {
			let app = new Websocket.client()
			let dev = new Websocket.client()
			let devConn: Websocket.connection = undefined as any
			dev.on('connect', c => {
				devConn = c
				let state = 0
				connHandleMsg(c, o => {
					if (state === 0) {
						expect(o.type).to.equal('tokenAccepted')
						state = 1
					} else if (state === 1) {
						expect(o.type).to.equal('enableLocation')
						sendJson(c, {
							type: 'locationUnavailable'
						})
						sendJson(c, {
							type: 'locationDisabled'
						})
						sendJson(c, {
							type: 'location',
							data: {
								lat: 42.0,
								lng: 43.0
							}
						})
						state = 2
					}
				})
				loginDev(c)
			})
			app.on('connect', (c) => {
				let state = 0
				connHandleMsg(c, o => {
					if (o.type === 'newNotification')
						return
					if (state === 0) {	// waiting for dev login
						expect(o.type).to.equal('tokenAccepted')
						sendJson(c, {
							type: 'enableLocation',
							patientId: devPatientId
						})
						state = 1
					} else if (state === 1) {
						expect(o.type).to.equal('locationDiag')
						expect(o.data).to.equal('location_disconnected')
						dev.connect(server.wsURL('/dev'))
						state = 3
					} else if (state === 3) {
						expect(o.type).to.equal('locationDiag')
						expect(o.data).to.equal('location_unavailable')
						state = 4
					} else if (state === 4) {
						expect(o.type).to.equal('locationDiag')
						expect(o.data).to.equal('location_disabled')
						state = 5
					} else if (state === 5) {
						expDummyPos(o)
						devConn.close()
						state = 6
					} else if (state === 6) {
						expect(o.type).to.equal('locationDiag')
						expect(o.data).to.equal('location_disconnected')
						state = 6
						c.close()
						done()
					}
				})
				loginAppUser(c)
			})
			app.connect(server.wsURL('/app'))
		})
	}),
	describe('pairing med', () => {
		itLock('should decline multiple pairing', done => {
			let api = new Websocket.client()
			let dev = new Websocket.client()
			let app = new Websocket.client()
			let devToken: string = undefined as any
			let appConn: Websocket.connection = undefined as any
			let apiConn: Websocket.connection = undefined as any
			let devConn: Websocket.connection = undefined as any
			let devClient: DevClient = undefined as any

			let finish = () => {
				appConn.close()
				apiConn.close()
				devConn.close()
			}

			let disCount = 0
			let disc = () => {
				if (++disCount >= 3)
					done()
			}

			let conCount = 0
			let conn = () => {
				if (++conCount < 2)
					return
				devClient = devClientForToken(devToken)
				devPatientId = devClient.getPatientId()
				sendJson(apiConn, {
					id: 32,
					token: userToken,
					method: 'PATCH',
					path: '/v1/user/pair',
					query: {},
					body: {
						temp_token: devClient.getPairingToken()
					}
				})
			}
			api.on('connect', (c) => {
				let state = 0
				apiConn = c
				connHandleMsg(c, obj => {
					if (state === 0) {	// waiting for user pairing request response
						expect(obj.id).to.equal(32)
						expect(obj.status).to.equal(200)
						devClient.processIntent(undefined)
						devClient.processIntent(new DiagResult({
							displayName: 'No'
						}, {}))
						state = 1
					}
				})
				c.on('close', disc)
			})
			api.connect(server.wsURL('/api'))

			dev.on('connect', (c) => {
				let state = 0
				devConn = c
				connHandleMsg(c, obj => {
					if (state === 0) {	// waiting for dev auth token
						state = 1
						expect(obj.type).to.equal('token')
						devToken = obj.data
						conn()
					}
				})
				sendJson(c, {
					type: 'firstConnexion',
					data: 1.0
				})
				c.on('close', disc)
			})
			dev.connect(server.wsURL('/dev'))

			app.on('connect', (c) => {
				let state = 0
				appConn = c
				connHandleMsg(c, obj => {
					if (obj.type === 'newNotification')
						return
					if (state === 0) {	// waiting for app auth to success (called by /api login check)
						expect(obj.type).to.equal('tokenAccepted')
						conn()
						state = 1
					} else if (state === 1) {	// waiting for pairing accepted
						state = 2
						expect(obj.type).to.equal('pairingDenied')
						finish()
					}
				})
				loginAppUser(appConn)
				c.on('close', disc)
			})
			app.connect(server.wsURL('/app'))
		})
	})
})
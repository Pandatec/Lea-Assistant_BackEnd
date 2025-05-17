import { server } from '../server'
import { expect } from 'chai'
const request = require('supertest');


describe('API routes', () => {

	let token: any = null

	describe('Register', () => {
		it('should respond 400 (nothing given)', (done) => {
			// Options
			request(server.httpServer).post('/v1/auth/register').end(function(err: any, res: any) {
				expect(res.statusCode).to.equal(400); 
				done(); 
			})
		})
		it('should respond 201 (new users)', (done) => {
			// Options
			request(server.httpServer)
			.post('/v1/auth/register')
			.send({
				"first_name": "test",
				"last_name": "test",
				"email": "test@test.fr",
				"phone": "+33000000000",
				"password": "testtest"
			})
			.end(function(err: any, res: any) {
				expect(res.statusCode).to.equal(201); 
				done(); 
			})
		})
		it('should respond 400 (user already exists)', (done) => {
			// Options
			request(server.httpServer)
			.post('/v1/auth/register')
			.send({
				"first_name": "test",
				"last_name": "test",
				"email": "test@test.fr",
				"phone": "+33000000000",
				"password": "testtest"
			})
			.end(function(err: any, res: any) {
				expect(res.statusCode).to.equal(400); 
				done(); 
			})
		})
	})


	describe('Login', () => {
		it('should respond 400 (nothing given)', (done) => {
			// Options
			request(server.httpServer).post('/v1/auth/login').end(function(err: any, res: any) {
				expect(res.statusCode).to.equal(400); 
				done(); 
			})
		})
		it('should respond 401 (bad credentials)', (done) => {
			// Options
			request(server.httpServer)
				.post('/v1/auth/login')
				.send({
					"email": "no",
					"password": "no"
				})
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(401); 
					done(); 
			})
		})
		it('should respond 200 (and give token)', (done) => {
			// Options
			request(server.httpServer)
				.post('/v1/auth/login')
				.send({
					"email": "test@test.fr",
					"password": "testtest"
				})
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(200);
					token = res.body.access_token
					done(); 
			})
		})

	})

	describe('User', () => {
		it('GET: should respond 200', (done) => {
			// Options
			request(server.httpServer)
				.get('/v1/user/get')
				.set('Authorization', 'Bearer ' + token) 
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(200);
					done(); 
			})
		})
		it('EDIT: should respond 400', (done) => {
			// Options
			request(server.httpServer)
				.patch('/v1/user/edit')
				.set('Authorization', 'Bearer ' + token)
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(400);
					done(); 
			})
		})
		it('EDIT: should respond 200', (done) => {
			// Options
			request(server.httpServer)
				.patch('/v1/user/edit')
				.set('Authorization', 'Bearer ' + token)
				.send({
					"first_name": "test"
				})
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(200);
					done(); 
			})
		})

		describe('Settings', () => {
			it('GET: should respond 200', (done) => {
				// Options
				request(server.httpServer)
					.get('/v1/user/settings/get')
					.set('Authorization', 'Bearer ' + token) 
					.end(function(err: any, res: any) {
						expect(res.statusCode).to.equal(200);
						done(); 
				})
			})
			it('EDIT: should respond 200', (done) => {
				// Options
				request(server.httpServer)
					.patch('/v1/user/settings/edit')
					.set('Authorization', 'Bearer ' + token)
					.send({
						"dark_mode": "true"
					})
					.end(function(err: any, res: any) {
						expect(res.statusCode).to.equal(200);
						done(); 
				})
			})
			it('EDIT: should respond 400', (done) => {
				// Options
				request(server.httpServer)
					.patch('/v1/user/settings/edit')
					.set('Authorization', 'Bearer ' + token)
					.end(function(err: any, res: any) {
						expect(res.statusCode).to.equal(400);
						done(); 
				})
			})
		})

		describe('Pair', () => {
			it('should respond 400 (no code)', (done) => {
				// Options
				request(server.httpServer)
					.patch('/v1/user/pair')
					.set('Authorization', 'Bearer ' + token) 
					.end(function(err: any, res: any) {
						expect(res.statusCode).to.equal(400);
						done(); 
				})
			})
			it('should respond 403 (bad code)', (done) => {
				// Options
				request(server.httpServer)
					.patch('/v1/user/pair')
					.set('Authorization', 'Bearer ' + token) 
					.send({
						"temp_token": "x"
					})
					.end(function(err: any, res: any) {
						expect(res.statusCode).to.equal(403);
						done(); 
				})
			})
			it('should respond 401 (no login)', (done) => {
				// Options
				request(server.httpServer)
				
					.patch('/v1/user/pair')
					.send({
						"temp_token": "x"
					})
					.end(function(err: any, res: any) {
						expect(res.statusCode).to.equal(401);
						done(); 
				})
			})
		})
	})

	describe('Patient', () => {
		it('GET: should respond 400 (no id)', (done) => {
			// Options
			request(server.httpServer)
				.get('/v1/patient/get')
				.set('Authorization', 'Bearer ' + token) 
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(400);
					done(); 
			})
		})
		it('GET: should respond 401 (bad id)', (done) => {
			// Options
			request(server.httpServer)
				.get('/v1/patient/get')
				.set('Authorization', 'Bearer ' + token)
				.query({
					"patientId": "test"
				})
				.end(function(err: any, res: any) {
					expect(res.statusCode).to.equal(401);
					done(); 
			})
		})
	})
})
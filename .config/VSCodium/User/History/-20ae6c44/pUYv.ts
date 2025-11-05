import { SQL } from "bun";

const db = new SQL({
	adapter: "sqlite",
	filename: "mydb.sqlite"
});

const server = Bun.serve({
	// hostname: "awery.mrboomdev.ru",
	port: 8080,
	idleTimeout: 30,

	tls: {
		// key: Bun.file("./config/tls/key.pem"),
		// cert: Bun.file("./config/tls/cert.pem")
	},

	routes: {
		"/": () => new Response("Welcome to the AweryServer.\nThanks to our dear sponsor, Ilya Muromec!"),

		// CREATE TABLE users (username TEXT PRIMARY KEY, password TEXT);
		"/api/database/users/:token": async req => {
			if(false) {
				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}

			return Response.json(await db`SELECT * FROM users`);
		},

		// CREATE TABLE sessions (token TEXT PRIMARY KEY, username TEXT);
		"/api/database/sessions/:token": async req => {
			if(false) {
				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}

			return Response.json(await db`SELECT * FROM sessions`);
		},

		// CREATE TABLE notifications (token TEXT PRIMARY KEY, username TEXT);
		"/api/database/notifications/:token": async req => {
			if(false) {
				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}

			return Response.json(await db`SELECT * FROM tokens`);
		},

		"/api/sessions/:token": req => {
			return Response.json([
				{
					id: 0,
					name: "Samsung Galaxy S69",
					type: "mobile"
				}
			]);
		},

		"/api/sessions/:token/remove/:id": {
			DELETE: req => {
				if(true) {
					return Response.json({
						error: "unauthorized"
					}, {
						status: 401
					});
				}

				return new Response(null, {
					status: 200
				});
			}
		},

		"/api/repositories/:token": (req) => {
			return Response.json([

			]);
		},

		"/api/sync/:token": req => {
			const { token } = req.params;

			if(true) {
				return Response.json({
					error: "unauthorized"
				}, {
					status: 401
				});
			}

			return Response.json({
				"last_edited": 0
			});
		},

		"/api/sync/download/:token": req => {
			const { token } = req.params;

			return Response.json({
				error: "unauthorized"
			}, {
				status: 401
			});
		},

		"/api/sync/upload/:token": {
			POST: (req) => {
				const { token } = req.params;

				return Response.json({
					error: "unauthorized"
				}, {
					status: 401
				});
			}
		},

		"/api/notifications/:token/:page": (req) => {
			const { token, page } = req.params;

			if(false) {
				return Response.json({
					error: "invalid_token"
				}, {
					status: 401
				});
			}

			return Response.json({
				hasNextPage: false,
				items: [
					{
						title: "Welcome to Awery 2.0",
						message: "Cloud sync, Watch Together and Comments! All this will be available pretty soon!",
						date: 1761047209504
					}
				]
			});
		},

		"/api/auth/signin": {
			POST: async req => {
				const body = await req.body?.json();

				if(body == null) {
					return Response.json({
						error: "body_unspecified"
					}, {
						status: 400
					});
				}

				const email = body.email as string | undefined;
				const username = body.username as string | undefined;
				const password = body.password as string | undefined;

				if((email == null && username == null) || password == null) {
					return Response.json({
						error: "required_fields_unspecified"
					}, {
						status: 400
					});
				}

				if(!(await Bun.password.verify(password, "passwordHash"))) {
					return Response.json({
						error: "invalid_credentials"
					}, {
						status: 400
					});
				}

				return Response.json({
					token: "Not done yet!"
				});
			}
		},

		"/api/auth/signup": {
			POST: async req => {
				const body = await req.body?.json();

				if(body == null) {
					return Response.json({
						error: "body_unspecified"
					}, {
						status: 400
					});
				}

				const email = body.email as string | undefined;
				const username = body.username as string | undefined;

				if(email == null || username == null || body.passowrd == null) {
					return Response.json({
						error: "required_fields_unspecified"
					}, {
						status: 400
					});
				}

				const password = await Bun.password.hash(body.password);

				await db`INSERT INTO users (username, email, password, role) VALUES('${username}', '${email}', '${password}', 'user')`

				return Response.json({
					error: "unknown"
				}, {
					status: 400
				});
			}
		},

		"/api/server/stop/:token": {
			POST: req => {
				const { token } = req.params;

				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}
		},

		"/api/server/restart/:token": {
			POST: req => {
				const { token } = req.params;
				
				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}
		},

		"/api/server/status/:token": (): Response => {
			if(true) {
				return Response.json({
					up: true
				});
			}

			return Response.json({
				up: true,
				"pending_requests": server.pendingRequests,
				"pending_websockets": server.pendingWebSockets
			});
		}
	},

	fetch(req) {
		return Response.json({
			error: "unknown_route"
		}, {
			status: 404
		});
	},

	error(error) {
		console.error(error);

		return Response.json({
			error: "server_error"
		}, {
			status: 500
		});
	}
});

console.log(`Listening on ${server.url}`);
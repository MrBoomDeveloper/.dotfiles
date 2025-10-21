const server = Bun.serve({
	// hostname: "aweryserver.mrboomdev.ru",
	port: 8080,
	idleTimeout: 30,

	tls: {
		// key: Bun.file("./config/tls/key.pem"),
		// cert: Bun.file("./config/tls/cert.pem")
	},

	routes: {
		"/": () => new Response("Welcome to the AweryServer.\nThanks to our dear sponsor, Ilya Muromec!"),

		"/sync/download/:token": (req) => {
			const { token } = req.params;

			return Response.json({
				error: "unauthorized"
			}, {
				status: 401
			});
		},

		"/sync/upload/:token": {
			POST: (req) => {
				const { token } = req.params;

				return Response.json({
					error: "unauthorized"
				}, {
					status: 401
				});
			}
		},

		"/notifications/:token/:page": (req) => {
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

		"/auth/signin": {
			POST: async req => {
				const body = await req.body?.json();

				if(body == null) {
					return Response.json({
						error: "body_unspecified"
					}, {
						status: 400
					})
				}

				const email = body.email as string | undefined;
				const username = body.username as string | undefined;
				const password = Bun.password.hash(body.password);

				if(email == null && username == null) {
					return Response.json({
						error: "nor_username_nor_email"
					}, {
						status: 400
					})
				}

				return Response.json({
					error: "invalid_credentials"
				}, {
					status: 400
				});
			}
		},

		"/auth/signup": {
			POST: async req => {
				const body = await req.body?.json();
				const email = body.email;
				const username = body.username;
				const password = Bun.password.hash(body.password);

				return Response.json({
					error: "unknown"
				}, {
					status: 400
				});
			}
		},

		"/server/stop/:token": {
			POST: req => {
				const { token } = req.params;

				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}
		},

		"/server/restart/:token": {
			POST: req => {
				const { token } = req.params;
				
				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}
		},

		"/server/status/:token": (): Response => {
			if(true) {
				return Response.json({
					error: "unauthorized"
				}, {
					status: 403
				});
			}

			return Response.json({
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
		})
	},

	error(error) {
		return Response.json({
			error: "server_error"
		}, {
			status: 500
		})
	}
});

console.log(`Listening on ${server.url}`);
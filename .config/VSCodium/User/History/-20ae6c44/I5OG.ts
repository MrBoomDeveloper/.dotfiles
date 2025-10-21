const server = Bun.serve({
	// hostname: "aweryserver.mrboomdev.ru",
	port: 8080,
	idleTimeout: 30,

	routes: {
		"/": () => new Response("Welcome to the AweryServer.\nThanks to our dear sponsor, Ilya Muromec!"),

		"/notifications/:token/:page": (req) => {
			const { token, page } = req.params;

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
				return Response.json({
					error: "invalid_credentials"
				});
			}
		},

		"/auth/signup": {
			POST: async req => {
				return Response.json({
					error: "unknown"
				});
			}
		},

		"/server/stop/:token": {
			POST: async req => {
				const { token } = req.params;

				return Response.json({
					error: "unauthorized"
				})
			}
		},

		"/server/restart/:token": {
			POST: async req => {
				const { token } = req.params;
				
				return Response.json({
					error: "unauthorized"
				})
			}
		}
	},

	fetch(req) {
		return Response.json({
			error: "unknown_route"
		}, {
			status: 404
		})
	}
});

console.log(`Listening on ${server.url}`);
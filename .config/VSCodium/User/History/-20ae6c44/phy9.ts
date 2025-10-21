const server = Bun.serve({
	port: 8080,
	routes: {
		"/": () => new Response("Welcome to the AweryServer.\nThanks to our dear sponsor, Ilya Muromec!"),

		"/notifications/:token/:page": (req) => {
			return new Response(JSON.stringify({
				hasNextPage: false,
				items: [
					{
						title: "Welcome to Awery 2.0",
						message: "Cloud sync, Watch Together and Comments! All this will be available pretty soon!",
						date: 1761047209504
					}
				]
			}));
		}
	}
});

console.log(`Listening on ${server.url}`);
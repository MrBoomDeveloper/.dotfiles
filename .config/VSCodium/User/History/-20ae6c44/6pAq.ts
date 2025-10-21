const server = Bun.serve({
	port: 8080,
	routes: {
		"/": () => new Response("Welcome to the AweryServer.\nThanks to our dear sponsor, Ilya Muromec!"),

		"/notifications/:token": (req) => {
			return new Response(JSON.stringify([
				{
					"title": "Welcome to Awery 2.0!",
					"message": "It is a "
				}
			]));
		}
	}
});

console.log(`Listening on ${server.url}`);
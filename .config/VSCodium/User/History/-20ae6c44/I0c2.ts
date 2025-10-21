const server = Bun.serve({
	port: 8080,
	routes: {
		"/": () => new Response("Welcome to the AweryServer.\nThanks to our dear sponsor, Ilya Muromec!"),
	}
});

console.log(`Listening on ${server.url}`);
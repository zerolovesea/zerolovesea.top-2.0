export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.hostname === "www.zerolovesea.top") {
			return Response.redirect(`https://zerolovesea.top${url.pathname}${url.search}`, 301);
		}

		return env.ASSETS.fetch(request);
	},
};

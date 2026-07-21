/*
 * @Author: yangzhou
 * @Email: zyaztec@gmail.com
 * @Date: 2026-07-19 21:31:20
 * @LastEditTime: 2026-07-21 09:32:37
 */
export const SITE_TITLE = "ZeroLoveSeA";
export const SITE_DESCRIPTION =
	"Yang Zhou's notes on machine learning, engineering, and life.";
export const SITE_URL = "https://zerolovesea.top";
export const SITE_IMAGE = "/img/avatar.png";
export const TWITTER_HANDLE = "";

export interface MenuItem {
	label: string;
	url: string;
}

export const menuItems: MenuItem[] = [
	{ label: "home", url: "/" },
	{ label: "writings", url: "/writings" },
	{ label: "thoughts", url: "/thoughts" },
];

export const products = [
	{
		name: "JoinQuant",
		icon: "JoinQuant",
		image: "/products/joinquant.png",
		imageFit: "contain",
		url: "https://www.joinquant.com",
	},
	{
		name: "Rumii",
		icon: "Rumii",
		image: "/products/rumiimatch.png",
		url: "https://github.com/zerolovesea/Rumiis",
	},
	{
		name: "Kaggle",
		icon: "Kaggle",
		image: "/products/kaggle.svg",
		imageFit: "contain",
		url: "https://www.kaggle.com/yaaangzhou",
	},
	{
		name: "NextRec",
		icon: "Next",
		image: "/products/nextrec.svg",
		url: "https://github.com/zerolovesea/NextRec",
	},
	{
		name: "AI DASH",
		icon: "AiDash",
		image: "/products/ai-dash.png",
	},
];

export const socialLinks = [
	{ label: "github", url: "https://github.com/zerolovesea" },
	{ label: "linkedin", url: "https://www.linkedin.com/in/zyaztec/" },
	{ label: "kaggle", url: "https://www.kaggle.com/yaaangzhou" },
	{ label: "instagram", url: "https://www.instagram.com/zyaztec" },
	{ label: "x", url: "https://x.com/zyaztec" },
	{ label: "email", url: "mailto:zyaztec@gmail.com" },
];

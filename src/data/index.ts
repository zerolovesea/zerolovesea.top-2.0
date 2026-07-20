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
		name: "NextRec",
		url: "https://github.com/zerolovesea/NextRec",
	},
	{
		name: "Kaggle notebooks",
		url: "https://github.com/zerolovesea/Kaggle_Competitions",
	},
	{
		name: "ML competitions",
		url: "https://github.com/zerolovesea/Projects_Machine_Learning",
	},
	{
		name: "Master Chow",
		url: "https://github.com/zerolovesea/master-chow",
	},
];

export const socialLinks = [
	{ label: "github", url: "https://github.com/zerolovesea" },
	{ label: "linkedin", url: "https://www.linkedin.com/in/zyaztec/" },
	{ label: "kaggle", url: "https://www.kaggle.com/yaaangzhou" },
	{ label: "zhihu", url: "https://www.zhihu.com/people/zhou-yang-33-17" },
	{ label: "bilibili", url: "https://space.bilibili.com/42997905" },
	{ label: "youtube", url: "https://www.youtube.com/@zerolovesea" },
	{ label: "instagram", url: "https://www.instagram.com/zyaztec" },
	{ label: "x", url: "https://x.com/zyaztec" },
	{ label: "email", url: "mailto:zyaztec@gmail.com" },
];

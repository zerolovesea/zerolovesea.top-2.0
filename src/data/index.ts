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
		name: "Brevia",
		icon: "Brevia",
		image: "/products/brevia.svg",
		url: "https://github.com/zerolovesea/Brevia",
	},
	{
		name: "Rumii",
		icon: "Rumii",
		image: "/products/rumiimatch.png",
		url: "https://github.com/zerolovesea/Rumiis",
	},
	{
		name: "NextRec",
		icon: "Next",
		image: "/products/nextrec.svg",
		url: "https://github.com/zerolovesea/NextRec",
	},
	{
		name: "Featune",
		icon: "Ft",
		url: "https://github.com/zerolovesea/Featune",
	},
	{
		name: "Kaggle",
		icon: "Kaggle",
		image: "/products/kaggle.svg",
		imageFit: "contain",
		url: "https://www.kaggle.com/yaaangzhou",
	},
	{
		name: "AI DASH",
		icon: "AiDash",
		image: "/products/ai-dash.png",
	},
];

export const featuredProjects = [
	{
		name: "NextRec",
		url: "https://github.com/zerolovesea/NextRec",
		description: {
			zh: "基于 Python / PyTorch 的推荐系统框架，覆盖 CTR/CVR 排序与多任务学习，将数值、类别和序列特征处理、模型训练、AUC / GAUC / LogLoss 评估及 ONNX 导出串成完整流程。",
			en: "A Python / PyTorch recommender framework for CTR/CVR ranking and multi-task learning, connecting numerical, categorical, and sequence features with training, AUC / GAUC / LogLoss evaluation, and ONNX export.",
		},
	},
	{
		name: "Featune",
		url: "https://github.com/zerolovesea/Featune",
		description: {
			zh: "面向表格数据的可审计特征工程搜索：用受控特征表达式、训练折内拟合和交叉验证评估候选，记录实验与资源消耗，并导出 sklearn pipeline。",
			en: "Auditable feature engineering for tabular data: controlled feature expressions, transforms fitted within training folds, cross-validation, experiment and resource tracking, and sklearn pipeline export.",
		},
	},
	{
		name: "Brevia · 言录",
		url: "https://github.com/zerolovesea/Brevia",
		description: {
			zh: "AI 辅助开发的本地优先会议助手，围绕录音、转写与纪要设计产品流程，集成语音识别和大语言模型，将模型能力转化为可用的应用。",
			en: "A local-first meeting assistant developed with AI assistance, combining product workflows for recording, transcription, and meeting notes with speech recognition and LLM integration.",
		},
	},
];

export const mergedContributions = [
	{
		number: 120,
		url: "https://github.com/datawhalechina/torch-rechub/pull/120",
		zh: "训练器 L1/L2 正则化",
		en: "L1/L2 regularization for trainers",
	},
	{
		number: 121,
		url: "https://github.com/datawhalechina/torch-rechub/pull/121",
		zh: "AutoInt 排序模型与交互层",
		en: "AutoInt ranking model and interaction layer",
	},
	{
		number: 128,
		url: "https://github.com/datawhalechina/torch-rechub/pull/128",
		zh: "batch 内负采样与训练器适配",
		en: "in-batch negative sampling and trainer integration",
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

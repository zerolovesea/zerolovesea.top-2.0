---
title: "struggle with chaos"
description: "Notes from January to August 2026."
pubDate: "2026-07-25 14:37:48"
---

After a few months of rest, I have recently started to feel a bit more energetic. So I have been tinkering with small things again. Since I finally have a weekend to myself, here is a quick catch-up.

## About the checkup

I had my company health check at the end of 2025. Guess what? I was overweight. By the razor-thin margin of 0.1, I had crossed the normal BMI range of 18.5–23.9. My blood lipids were a little high, too. It is hard to believe that in just three years, I pulled off the magnificent transformation from skinny guy to greasy middle-aged man. I play basketball every day, but apparently it does fuck all. I guess Luckin Coffee has way too much sugar.

![](20260725-1.jpeg)

## Survive first, figure out the rest later

At the annual meeting, I received the company's Outstanding Employee award. That was a pleasant surprise. I got lucky last year: the industry was expanding overall, and I still had the shine of a first-year newcomer. Between performance and technical exploration, I made a few real breakthroughs, which somehow added up to an award.

![](20260725-2.jpeg)

![](20260725-3.jpeg)

The good times did not last long. Over the past two months, a major setback has made the whole business much harder. We had to turn around and explore entirely new lines of business from scratch. The road is long and rough; optimism has gradually given way to anxiety. You can see it in the constant turnover of people and the tense mood in weekly meetings. When the business is still burning money, every decision feels like walking on thin ice.

As of today, our exploration has finally produced some results. Efficient overtime clearly was not for nothing. At least in the short term, we survived.

## A trip to Thailand

In April, I took some wedding leave and went to Thailand with Pingping. It was a rare break, so we spent a week in Bangkok and Phuket. Thailand is hot and humid—not really my kind of weather. Walking under the blazing sun gets irritating. But Bangkok is cheap, and the Michelin food and Thai milk tea were well worth it. Good, good.

![](20260725-4.jpeg)

![This seafood rice was delicious. 9/10](20260725-5.jpeg)

![Thai tea near a tourist attraction. 8/10](20260725-6.jpeg)

![A goofy photo of us](20260725-7.jpeg)

![](20260725-8.jpeg)

![This coconut was bad—the inside was warm. 4/10](20260725-9.jpeg)

![An Instagram-famous café. 8.5/10](20260725-10.jpeg)

![](20260725-11.jpeg)

We booked a very nice resort in Phuket, which was my favorite part of the trip: pretending to have old money while lying by the pool and playing on my phone. The pool was nice, the sunset was nice, and breakfast was nice. Best of all, I did not have to worry too much about the business, so it was genuinely relaxing.

> The price of being too relaxed: I lost my company VPN username and password after getting back, and I still have not found them.

Before our return flight, we went snorkeling. A rare experience in my life.

## Basketball tournament

In June, I joined an inter-company basketball tournament in Suzhou. It was my first indoor tournament. Even though I like to think I play every day, after just two full-court sprints my brain was basically offline. I knew nothing about how to attack a 2–3 zone, and I couldn’t make a shot on offense either.

We went 1–2 in the group stage, finishing with six points. Rough.

## From stock trading to low-frequency quant

I began trading A-shares last October. Until May, nothing much happened and I was roughly breaking even. In June I caught a run in PCBs and memory chips, making more than 40%. At the time I really felt like I had seen the light. Every evening after work, I would read The Wall Street Journal. There was no way I was not getting carried away.

The market teaches anyone who does not respect it. It took only two weeks to prove that point. A major correction in the first half of July hit me hard. In the following days, I made the retail investor's classic mistake: trading constantly for several days. Just like that, an account that had been up more than 30% turned a few percentage points negative.

After that, I started researching low-frequency quantitative strategies on JoinQuant—mainly a swing strategy based on moving averages: buy when a trend shows and sell when it breaks. After more research and backtesting, I chose one strategy and put it into live trading. As of July 25, it had returned 3% over one week, with a maximum drawdown of 2.53%, and had survived the market's big swings of the previous three days. More importantly, backtesting has made me less uncertain about when to buy and sell, and more able to hold onto a stock.

![Nearly 400% in a one-year backtest. The rotating stock universe is made up of high-beta technology stocks, but I did not find any look-ahead bias in the backtest.](20260725-12.jpeg)

## Recent tinkering

At the end of May, I started collaborating with a Spanish developer on an Airbnb-like project, helping them build a recommendation system. Since we are both working on it part-time and neither of us has much experience, communication was a little difficult at the beginning. Fortunately, I put together the MVP in just one week, which shocked Floren, my fellow developer. China speed, hahaha.

Besides that little project, I have recently been vibing on a meeting transcription app. The main reason is that Feishu Minutes costs money, so I wanted to make a substitute. This is exactly the kind of project Codex is great for tinkering with on its own. The plan is to support Chinese, English, and Spanish recognition, speaker diarization, and meeting summaries. Most importantly, I want it to run at low power. The final architecture is Tauri 2 + Rust + the MLX runtime.

I used Whisper in testing, but its Chinese recognition was not accurate enough and it occasionally hallucinated—producing content that was never said. Creepy. So I switched to SenseVoice and Qwen3-ASR for Chinese recognition. The app is now about 80% complete, but the frontend is still ugly. With another one or two months of UI polish, it should be ready to launch.

![This is Codex's taste in design](20260725-13.png)

That is enough for my elementary-school essay. I am tired. Going home to play games.

Suzhou, July 25, 2026

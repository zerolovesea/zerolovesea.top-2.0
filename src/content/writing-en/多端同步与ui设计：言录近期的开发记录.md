---
title: "Cross-Device Sync and UI Design: Recent Development Notes on Yanlu"
description: ""
pubDate: 2026-10-22 10:57:17
updatedDate: 2026-10-26T09:22:27.873Z
---

It's been a while since my last blog update. Most of that time went into my meeting-notes app, Yanlu. Sticking with it, I shipped three releases one after another: added some features, brought the performance cost down, redesigned the UI, and [website](https://brevia.work) got a new design too. So here's a summary of what the development has looked like recently.

## On feature iteration

When I wrote the last development log, the version number was still somewhere around v1.0.23. As of October 25, 2026, the latest release is 1.4.5. Along the way, quite a few features came and went.

### Rebuilding live captions

In the earlier design, the whole transcription flow started with a streaming-capable model doing a first pass, and then, once there was a reasonable pause, a better model would run the full transcription again. There's nothing wrong with the approach itself, but for a local offline app the performance and power cost was too high. It was fine on a MacBook, but on the low-voltage CPU in my Razer Book the streaming output was slow and the second pass was slower still. With delays stacking up, a 60-minute meeting could end up more than 40 minutes behind in transcription. On top of that, keeping two models resident for inference drained the battery far too fast on Windows, something early Windows users reported again and again.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/1ecc0752-135b-4c53-b585-30e025d12c74.png)

### Rich text / Markdown editor

Over the course of these releases I added rich text and Markdown editors, so users can update their notes more easily.

### Faster inference on Mac

In early October I came across mlx-audio, a speech toolkit for macOS that provides MLX-based audio recognition, transcription, and related tools. It performs noticeably better than sherpa-onnx on macOS (it can use the MacBook's acceleration units), so I spent some time porting the Mac backend over to it. After the switch, I measured the same batch of 45-second Chinese-English meeting clips on my M4 Pro: raw decoding speed for FunASR Nano and Parakeet came out at roughly 3.7x and 4.0x the previous version, and power draw dropped a lot as well. This was the big performance update of this period.

### Phone-to-desktop recording

I'd wanted to build a mobile app for a long time, one that would let phone recording work together with transcription on the computer. Given the performance and power constraints on phones, I decided to use the phone purely as a microphone: it connects over the LAN via WebSocket, you confirm pairing on the computer with a QR code or PIN, and then the phone records while the computer handles recognition and sends captions and notes back. Design took a day or two, and I got a first version of the feature working. To cover both iOS and Android, I built the app on Flutter. The motivation was that a laptop on battery has limited performance and its microphone picks up sound poorly; in in-person meetings, echo often caused recognition errors. Switching to the phone's microphone improved recognition quality markedly, and this is one feature I'm quite happy with.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/0a589716-a2e1-4791-b901-fdf56a1154f0.png)

![04-mobile-live](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/04-mobile-live.png)

### Batch and automatic corrections

In v1.4.4, following an issue filed on GitHub, I added batch and automatic caption corrections. During live transcription, a word that keeps getting misrecognized is replaced with the word the user actually wants. That way users don't have to keep fixing the model's transcription errors one by one.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/508616d8-0e72-4290-b66c-98f4473029d4.png)

### Quick recording and the floating capsule

Since the mobile app came along, the desktop app no longer really needs to keep a window open all the time. So I designed a floating capsule: when the app is minimized, a control capsule is automatically placed on the desktop. Hovering over it gives you a quick look at the transcript and notes. I also added a quick recording option, so users can start a meeting with one click instead of configuring meeting settings every time.

![06-hover-captions](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/06-hover-captions.png)

![07-hover-notes](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/07-hover-notes.png)

### Redesigning the UI

I'd been wanting to redesign Yanlu's UI for a while. The original design was based on a Japanese-style minimalist look with lots of whitespace, pulled out of a gacha roll, but in daily use it always felt like it was missing a bit of that modern app feel. So I had Codex redesign the app UI. This time I learned from past mistakes: I had Codex generate complete design mockups for every page first, then had it do a full reproduction. This approach mostly avoids unexpected design blind spots, though some alignment issues still remain. For example, the fonts, icons, whitespace, and positioning of different sections in the reproduced interface always differ from the mockups to some degree, and the actual look and feel still falls a bit short. But to get a usable release out quickly, I settled on a version and shipped it. This current version went through a complete UI and interaction rebuild, and the experience feels more modern.

![01-library](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/01-library.png)

![02-general-settings](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/02-general-settings.png)

![03-live-workspace](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/03-live-workspace.png)

![04-background-recording](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/04-background-recording.png)

I may do more design work later, but for now it'll stay as it is.

## Lessons Learned the Hard Way

I had Codex go through the commit history from the past two months and analyze all the pitfalls worth noting. Here's roughly what came out of it:

1. Transcript segmentation involves audio, model capacity, and language context, so local patches easily interfere with each other.

Starting in August, I was constantly dealing with word breaks, repeated openings, number corrections, and timestamp overlaps in recognized transcripts. The problem mainly comes from contextual sentence segmentation in VAD. How to stitch audio edges, how to produce semantically sensible sentence breaks, these strategies took a lot of tuning. Problems I ran into included:
- FunASR Nano couldn't handle the long segments in the config, so roughly 60 seconds of continuous monologue produced no recognition results.
- A VAD start point about 81 milliseconds late was enough to turn "公司" into "司".
- Zero-padding each input chunk artificially created fake silence, making segmentation results vary with input chunk size.

Lesson: audio boundaries must be verified with sample counts, actual output, and playback results.

2. When VAD decides there's "no speech," content can disappear outright.

The issue came from Japanese dialogue over background music, soft speech, and phone audio never entering the recognition queue. During the first real-time pass, the model didn't pick up this content, so it was simply lost. Later, both the real-time and offline pipelines got speech-gap recovery. Takeaway: detectors make mistakes, raw audio must be kept, and the recognition pipeline needs a chance to reprocess.

3. Windows being "very slow" masked a process startup deadlock.

From late August into early September, I repeatedly optimized Windows imports, first-load of native dependencies, and speaker analysis to try to speed up transcription. I'd put in real effort there, but it wasn't until October 18, during my own testing, that I tracked down a startup deadlock in the Windows build: when starting transcription, the parent process would block reading command input, so the Windows version would freeze outright on long content.

Lesson: when something hangs, first distinguish between the startup, queueing, loading, inference, and saving stages. Only after confirming it has reached inference should you talk about model performance.

4. Packaging and distribution are part of the product.

Over the past two months, I kept running into CI/CD problems at release time:

- CI's Node 20 didn't support the global `WebSocket` that a newly added test dependency relied on.
- SQLite connections stayed open after the transaction context ended, so cleanup of the Windows temp directory failed.
- Runtime deduplication broke the signature structure of `Python.framework`.
- The iOS app and its extension each needed explicit signing configuration.
- CUDA distribution hit one problem after another: installer format, artifact integrity, and oversized file limits. I ended up pulling the release.
- The menu bar icon worked from the dev path but resolved incorrectly from the installed path.

The lesson: the dev environment, the frozen backend, and the full installer package each need to be verified separately.

Organized into a table:

| Long-standing issue | How it kept showing up | My take |
|---|---|---|
| **Subtitle integrity** | Word breaks, repeated text at segment seams, dropped neutral tones, spurious periods, word-level timestamps, correction rules | The core product quality problem. It needs an ongoing collection of real-world failure audio. |
| **Recording lifecycle** | Start, pause, resume, stop, sleep, model switching, phone disconnect, backgrounding | The more entry points there are, the more they need to share one set of state and teardown logic. |
| **Text version consistency** | Raw vs. polished transcript selection, manual edits, translation, export, voiceprint sampling, undo | What the user sees, edits, translates, and exports must all come from the same version. |
| **Async task ownership** | Results arriving after cancellation, navigation races, duplicate starts, messages from stale processes, duplicate saves | A shared problem across the frontend, Electron, Python, and mobile. |
| **Resource limits in long sessions** | Repeated full-file reads, leftover listeners, bursts of batched requests, clustering memory, orphaned subprocesses | Many performance problems come down to redundant work and resources that were never released. |
| **UI matching actual behavior** | Restoring features after a redesign, eight languages, dark mode, animations, the website demo and its caching | This has become an ongoing maintenance cost. It needs stable components and a release checklist. |

## Other lessons worth having

This was the first app I shipped publicly, and the pitfalls weren't only in the code. I hit plenty of problems with promotion, testing, and release too. I think those lessons are more valuable than the ones about code architecture.

### On App Store submission and Android packaging

There are plenty of tutorials online about publishing an app, but getting from a finished app to a live App Store release still took me about a week. For early code testing, Apple recommends releasing through TestFlight first. TestFlight is Apple's beta platform: before release, a developer can invite testers to join the app's test plan. Typically I'd change some UI, submit to TestFlight, get approved within 30 minutes, and then my test phone would receive a push notification for the update. That part was a good experience.

![testflight](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/b4b1602b-245f-4171-a6f3-07f98f7b8547.png)

Once testing on TestFlight passed, I could submit the app for App Store release. This step requires a developer account plus app information, tags, and so on. Only the China and France regions required extra materials. Mainland China requires an ICP filing number, which you apply for through the relevant provincial portal, though apps with no server of their own can request an exemption from Apple.

My first version only connected the phone and desktop over the local network, so the initial submission was approved quickly. For the second version I wanted to add cross-network connections, so a computer at home could connect to a phone away from home. That feature brought in WebRTC, which makes network requests, so my second submission failed for mainland China: they asked me to supply an ICP number.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/d098762a-ccad-497f-8fb6-c6e353420363.png)

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/94b24b55-dc34-4deb-8d55-26fbec671273.png)

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/6a65e745-5e0f-4582-8b8d-9e9905e96f38.png)

I looked it up on Xiaohongshu, and it turns out Apple's process basically requires the developer to write a letter of assurance confirming that the app has no way of connecting to overseas servers. I suspect this is management by passing the buck to some degree, making developers vouch for the reliability of their own apps. After I signed the document and submitted it as required, the app cleared mainland China review the very next day. Nice.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/54a84738-d730-4b71-9d25-64f11c8cb131.png)

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/9a008dd9-d53a-48ec-8f3e-7db2e8499229.png)

Android is a bit more of a hassle, since every manufacturer has its own app store, each store needs a separate submission, and they all require a software license number too. So I didn't spend more time on publishing there; I just built the package and hosted it at a public URL for users to download. Apple's bar for publishing an app is considerably higher: you have to pay to become a developer, and you have to submit all sorts of documentation attesting to the app's safety. That's good for users, though slightly demanding for developers. Android's openness lets users download and install an APK straight off the web, but security is relatively weaker.

### On promoting the product

There are plenty of social media platforms you can post on these days, but because of all the platform restrictions, if you genuinely want to promote your product, the platform will want you to pay for its traffic services. I posted introductions on Xiaohongshu, LinkedIn, X, Product Hunt, and GitHub, but traffic was very low. Xiaohongshu even flagged my post for including the app's official site, warning me that links are only allowed in posts if I use their paid promotion service. So I spent 100 yuan on Xiaohongshu's impressions package, and 24 hours later it had earned me 8 likes, 4 saves, and 1,300 views. Hilarious.

You can post on X too, but without paying for the little blue check, there's no traffic boost either. Damn capitalists. As for the other channels, Product Hunt also pushes its on-site promotion service as the way to get more exposure, and some open source sharing sites on GitHub let you post and share your app as well, but the returns were just as thin. As of October 26, Brevia's repo had barely crossed 70 stars. Genuinely demoralizing.

### You only get one shot at launching your product.

"You only get one shot at launching your product."

There's a saying in product marketing that captures how much the first launch matters: users only form a first impression once, and the story of a brand new product is naturally compelling the first time around. Any launch after that needs new features and major updates as the hook. So one good launch may be worth more than ten casual promotions.

I'm fairly inclined to agree at this point. I started promoting on Xiaohongshu as early as August 11, but a glance at the commit history shows I was still fixing a Windows deadlock bug and optimizing inference speed in mid-October. Some users reached out early on with feedback about rough edges in the experience, so if I had held off and launched more recently, I might have gotten a different level of buzz.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/31cdd6d9-ab8a-4a68-99a7-06dac7430330.png)

### On the app itself

I've spent three months on this app, and from early research to UI design, feature work, and finally promotion and store submission, I essentially went through the full iteration cycle of an idea. Looking back now, it's been a valuable experience.

While building and exploring, I noticed that meeting notes and transcription isn't a novel idea; Product Hunt even has a dedicated AI meeting category for apps like this. The open source community has plenty of similar projects too, and most of them are just a wrapper around FunASR or sherpa-onnx. Compared to theirs, my project adds little more than some AI features that aren't hard to build. So even though this is a fun thing to have made, I've decided to put further exploration of the project on hold. Going forward I'll probably just rework some of the UI/UX and handle routine maintenance and updates.

brevia Completed 2026/7/29 - 2026/10/26
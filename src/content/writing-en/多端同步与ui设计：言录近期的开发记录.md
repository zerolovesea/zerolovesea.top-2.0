---
title: "Cross-Device Sync and UI Design: Recent Development Notes on Brevia"
description: ""
pubDate: 2026-10-22 10:57:17
updatedDate: 2026-10-26T09:38:50.345Z
---

It's been a while since my last blog post. I've spent most of that time working on Brevia, my meeting-notes app. Over three releases, I added features, reduced resource usage, and redesigned the UI. The [website](https://brevia.work) got a redesign too. Here's a look back at the work and what I learned along the way.

## Feature updates

Brevia was around v1.0.23 when I wrote the last development log. As of October 25, 2026, the latest version is 1.4.5. Quite a few features have been added, changed, or removed along the way.

### Rebuilding live captions

The original transcription pipeline used a streaming model for a first pass, then ran a second, more accurate model over the audio when the speaker paused. The approach itself was reasonable, but the processing load and power consumption were too high for a local, offline app. It worked well enough on a MacBook. On the low-power CPU in my RazerBook, though, the streaming pass was slow and the second pass was slower still. The delays piled up: by the end of a 60-minute meeting, transcription could be more than 40 minutes behind. Keeping both models loaded and running also drained the battery far too quickly on Windows. Early Windows users brought this up repeatedly.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/1ecc0752-135b-4c53-b585-30e025d12c74.png)

### Rich text and Markdown editing

I also added rich text and Markdown editors over these releases, making it easier for users to edit their notes.

### Faster inference on macOS

In early October, I came across mlx-audio, a speech toolkit for macOS built on MLX. It performed noticeably better than sherpa-onnx on the Mac, where it could take advantage of the machine's hardware acceleration, so I spent some time migrating the Mac backend. I tested the same set of 45-second meeting clips in Chinese and English on my M4 Pro. After the switch, decoding alone was roughly 3.7 times as fast for FunASR Nano and 4.0 times as fast for Parakeet compared with the previous version. Power consumption dropped substantially too. This was the biggest performance improvement I made during this period.

### Recording on the phone, transcribing on the desktop

I'd wanted to build a mobile app for a while, with the phone recording audio and the computer handling transcription. Given phones' processing and battery constraints, I decided to use the phone as the audio capture device. It connects to the computer over the local network via WebSocket, with QR-code or PIN pairing confirmed on the computer. The computer transcribes the incoming audio and sends captions and notes back to the phone. I got the first version working in a day or two, using Flutter to support both iOS and Android. The idea came from the limitations of a laptop's performance on battery and its built-in microphone. Echo in in-person meetings often caused recognition errors; switching to the phone's microphone noticeably improved transcription quality. It's one of the features I'm happiest with.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/0a589716-a2e1-4791-b901-fdf56a1154f0.png)

![04-mobile-live](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/04-mobile-live.png)

### Batch and automatic corrections

In v1.4.4, prompted by an issue on GitHub, I added batch and automatic corrections for captions. Users can replace a repeatedly misrecognized word with the correct one, rather than fixing the same transcription error over and over during a meeting.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/508616d8-0e72-4290-b66c-98f4473029d4.png)

### Quick recording and a floating control capsule

With the mobile app in place, there was less reason to keep the desktop app's main window open all the time. I added a small floating control capsule that appears when the app is minimized. Hovering over it lets you check the live transcript and notes. A new quick-recording option also lets users start a meeting with one click, without going through the settings each time.

![06-hover-captions](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/06-hover-captions.png)

![07-hover-notes](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/07-hover-notes.png)

### Redesigning the UI

I'd wanted to redesign Brevia's UI for some time. The original interface was a Japanese-inspired minimalist design with generous whitespace, chosen after trying a few generated variations. But in daily use, it never quite felt like a modern app. So I asked Codex to redesign it. This time, I learned from earlier attempts: I had it produce complete mockups for every screen before implementing them. That helped avoid overlooked screens and states, although the implementation still didn't quite match the designs. Fonts, icons, spacing, and the placement of different sections all differed to some degree, and the result lost a little of what made the mockups appealing. Still, I wanted to ship a usable release, so I settled on a version and released it. The current UI and interactions have been rebuilt throughout, and the app feels more modern to use.

![01-library](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/01-library.png)

![02-general-settings](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/02-general-settings.png)

![03-live-workspace](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/03-live-workspace.png)

![04-background-recording](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/04-background-recording.png)

I may revisit the design later, but I'm leaving it as it is for now.

## Lessons learned the hard way

I asked Codex to review the past two months of commits and pull out the recurring problems worth learning from. A few stood out:

1. Transcript segmentation depends on audio boundaries, model limits, and linguistic context. Fixing one part can break another.

Since August, I'd been dealing with clipped words, repeated text at the start of segments, misrecognized numbers, and overlapping timestamps. Much of this came down to how voice activity detection (VAD) divided the audio and how those boundaries interacted with linguistic context. Stitching audio segments together and choosing sentence breaks that made sense took a lot of tuning. Some examples:

- FunASR Nano couldn't handle the long segments allowed by the configuration, leaving a continuous monologue of roughly 60 seconds with no transcription.
- A VAD start point just 81 milliseconds too late could clip the first syllable of 公司 (*gongsi*, "company"), leaving only 司 (*si*).
- Zero-padding every input chunk introduced artificial silence, so changing the chunk size changed where the audio was segmented.

Lesson: check audio boundaries against sample counts, transcription output, and playback of the actual recording.

2. When VAD decides there is "no speech," content can disappear entirely.

Japanese dialogue over background music, quiet speech, and audio from phone calls sometimes never made it into the recognition queue. If the initial real-time pass missed them, they were simply dropped. I later added recovery for missed speech to both the real-time and offline pipelines. The lesson: detectors make mistakes. Keep the original audio, and leave the pipeline a way to process it again.

3. A process startup deadlock was hiding behind "Windows is slow."

From late August into early September, I kept optimizing Python imports on Windows, the initial loading of native dependencies, and speaker analysis to speed up transcription. I'd put a lot of effort into that work, but it wasn't until October 18, during my own testing, that I found a startup deadlock in the Windows version. When transcription started, the parent process could block while reading command input, causing transcription of long recordings to freeze altogether.

Lesson: when a task hangs, first work out whether it's stuck during startup, queueing, loading, inference, or saving. Don't blame model performance before confirming that inference has actually started.

4. Packaging and distribution are part of the product.

Over the past two months, I kept running into CI/CD problems at release time:

- The Node 20 environment in CI lacked the global `WebSocket` API required by a newly added test dependency.
- SQLite connections remained open after leaving the transaction context, preventing temporary-directory cleanup on Windows.
- Deduplicating runtime files broke the code-signing structure of `Python.framework`.
- The iOS app and its extension needed explicit signing configurations.
- Distributing the CUDA build ran into problems with installer formats, artifact integrity, and file-size limits. I eventually withdrew it.
- The menu bar icon loaded correctly from the development directory but not from the installed app.

Lesson: test the development environment, the packaged backend, and the complete installer separately.

The recurring issues, in one table:

| Recurring issue | How it showed up | What I took away |
|---|---|---|
| **Transcript completeness** | Clipped words, duplicated text at segment boundaries, missed quiet speech, misplaced periods, word-level timestamps, correction rules | This is the core product-quality issue. Keep collecting real recordings that expose failures. |
| **Recording lifecycle** | Starting, pausing, resuming, stopping, sleep, model switches, phone disconnections, quitting in the background | As recording gains more entry points, they need to share the same state management and cleanup logic. |
| **Text version consistency** | Choosing raw or refined transcripts, manual edits, translation, export, voiceprint sampling, undo | The text users see, edit, translate, and export must come from the same version. |
| **Async task ownership** | Results arriving after cancellation, navigation races, duplicate starts, messages from old processes, duplicate saves | The same problem spans the frontend, Electron, Python, and the mobile app. |
| **Resource limits in long sessions** | Repeated full-file reads, listeners left attached, bursts of batch requests, memory use during clustering, orphaned subprocesses | Many performance problems come from repeated work and resources that aren't released. |
| **Keeping the UI consistent with behavior** | Restoring functionality after redesigns, support for eight languages, dark mode, animations, website demos and caching | This is an ongoing maintenance cost. Stable components and release checks matter. |

## Lessons beyond the code

Brevia is the first app I've released publicly. The problems weren't limited to code: promotion, testing, and distribution all brought their own surprises. In some ways, those lessons have been more valuable than what I learned about software architecture.

### Getting onto the App Store and distributing Android builds

Despite all the publishing tutorials online, it took me about a week to go from a finished app to an App Store release. I started with TestFlight, Apple's beta-testing platform, where developers can invite people to try an app before release. In my experience, I'd make some UI changes, submit a build, and usually get approval within 30 minutes. My test phone would then get an update notification. That part worked well.

![testflight](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/b4b1602b-245f-4171-a6f3-07f98f7b8547.png)

Once TestFlight testing was done, I could submit the app to the App Store. That meant setting up a developer account and supplying the app's details, tags, and other information. In my submission process, mainland China and France were the only regions that required additional documentation. For mainland China, I was asked for an ICP filing number, obtained through the relevant provincial filing process. I also learned that apps without their own server could request an exemption from Apple.

The first version only connected the phone and desktop over a local network, so that submission went through quickly. For the second version, I wanted them to connect across networks: the computer could stay at home while I took the phone out. That involved WebRTC and network requests. This time, the mainland China submission didn't go through; I was asked to provide the ICP filing number.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/d098762a-ccad-497f-8fb6-c6e353420363.png)

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/94b24b55-dc34-4deb-8d55-26fbec671273.png)

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/6a65e745-5e0f-4582-8b8d-9e9905e96f38.png)

After looking into other developers' experiences on Xiaohongshu, I understood that I needed to submit a signed statement confirming that the app would not connect to external servers. It felt a little like passing the responsibility back to the developer: I had to personally vouch for how the app would behave. I signed and submitted the document, and the mainland China submission was approved the next day. Credit where it's due.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/54a84738-d730-4b71-9d25-64f11c8cb131.png)

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/9a008dd9-d53a-48ec-8f3e-7db2e8499229.png)

Android was more of a hassle. Different manufacturers have their own app stores, each requiring a separate submission, and the stores I looked at also required a filing number. I decided not to spend more time submitting to them. Instead, I packaged the app as an APK and made it available for download on the web. Apple's process has a higher barrier to entry: you pay for a developer account and submit documentation about the app's safety. That's reassuring for users, but it means more work for developers. Android lets users download and install an APK directly, with fewer safeguards.

### Promoting the product

There are plenty of places to post about a product, but getting people to see those posts is another matter. I posted introductions on Xiaohongshu, LinkedIn, X, Product Hunt, and GitHub, with very little traffic to show for it. Xiaohongshu even warned me for including the app's website, saying I could only include a URL if I used its paid promotion service. So I spent 100 yuan on promotion. After 24 hours, that bought me 8 likes, 4 saves, and 1,300 views. Had to laugh.

I ran into much the same thing on X: without paying for the blue check, my posts got little exposure. Damn capitalists. Product Hunt also advertised paid promotion as a way to reach more people. I shared the app through some open-source discovery projects on GitHub too, but that didn't bring much attention either. As of October 26, Brevia's repository had only just passed 70 stars. Pretty demoralizing.

### You only get one shot at launching your product

> "You only get one shot at launching your product."

It's a familiar saying in product marketing, and I can see the reasoning. People only get one first impression, and a new product gives you a natural story to tell. After that, you need new features or a major update to give people a reason to pay attention again. One well-prepared launch may be worth more than ten casual rounds of promotion.

I'm inclined to agree after this experience. I started promoting Brevia on Xiaohongshu on August 11, yet the commit history shows I was still fixing a Windows deadlock and improving inference speed in mid-October. Early users had already reached out about rough edges in the app. If I'd waited until now to launch, the reception might have been different.

![](/_posts/%E5%A4%9A%E7%AB%AF%E5%90%8C%E6%AD%A5%E4%B8%8Eui%E8%AE%BE%E8%AE%A1%EF%BC%9A%E8%A8%80%E5%BD%95%E8%BF%91%E6%9C%9F%E7%9A%84%E5%BC%80%E5%8F%91%E8%AE%B0%E5%BD%95/31cdd6d9-ab8a-4a68-99a7-06dac7430330.png)

### Looking back at the app

I've spent three months on Brevia, taking it from initial research through UI design and feature development to promotion and app-store submissions. I've more or less seen an idea through a complete development cycle. Looking back, that experience has been valuable.

Building it also made me realize that meeting notes and transcription aren't new ideas. Product Hunt even has a dedicated category for AI meeting apps. There are plenty of similar open-source projects, many of them wrappers around FunASR or sherpa-onnx. Compared with those projects, mine adds little more than a few AI features that are easy to replicate. I've enjoyed building it, but I've decided to pause further exploration of the project. For now, I'll probably limit the work to occasional UI/UX changes and routine maintenance and updates.

Brevia · July 29–October 26, 2026.

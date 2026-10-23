import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ContentStore } from './content';
import { Publisher } from './publish';

test('menu bar popover retains failed input, retries the same thought and publishes without a web view', async () => {
  if (process.platform !== 'darwin') return;
  const root = await mkdtemp(resolve(tmpdir(), 'tidemark-quick-panel-'));
  let server: ReturnType<typeof Bun.serve> | undefined;
  try {
    await mkdir(resolve(root, 'src/content'), { recursive: true });
    const git = async (...args: string[]) => {
      const process = Bun.spawn(['git', ...args], { cwd: root, stdout: 'ignore', stderr: 'pipe' });
      if (await process.exited) throw new Error(await new Response(process.stderr).text());
    };
    await git('init', '-b', 'main');
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { d: 'test-only' } }));
    await git('add', '.');
    await git('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
    const store = new ContentStore(root);
    let calls = 0;
    let interruptedStatus = false;
    const publisher = new Publisher(root, async (_args, _cwd, output) => { calls++; output('fixture publication ' + calls); return calls === 1 ? 1 : 0; });
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
      if (request.headers.get('x-studio-token') !== 'native-fixture') return Response.json({ error: 'unauthorized' }, { status: 403 });
      const url = new URL(request.url);
      try {
        if (url.pathname === '/api/save') return Response.json(await store.save(await request.json()));
        if (url.pathname === '/api/document') return Response.json(await store.read(url.searchParams.get('id')!));
        if (url.pathname === '/api/publish-plan') return Response.json(await publisher.plan());
        if (url.pathname === '/api/publish') {
          const body = await request.json();
          expect(body.confirmation).toBe('发布网站');
          return Response.json(await publisher.start(body.fingerprint));
        }
        if (url.pathname === '/api/publish-status') {
          if (calls === 1 && !interruptedStatus) { interruptedStatus = true; return Response.json({ error: 'temporary interruption' }, { status: 503 }); }
          return Response.json(publisher.state);
        }
        return new Response('missing', { status: 404 });
      } catch (error: any) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
    }});
    const swift = resolve(root, 'Check.swift'), executable = resolve(root, 'quick-panel-check');
    await writeFile(swift, `import AppKit
@main struct Check {
  @MainActor static func main() async throws {
    _ = NSApplication.shared
    UserDefaults.standard.removeObject(forKey: "quick-thought-draft")
    defer { UserDefaults.standard.removeObject(forKey: "quick-thought-draft") }
    let panel = QuickThoughtPanel(port: Int(CommandLine.arguments[1])!, token: "native-fixture")
    func views(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap { views($0) } }
    let children = views(panel.view)
    let editor = children.compactMap { $0 as? NSTextView }.first { $0.isEditable }!
    let publish = children.compactMap { $0 as? NSButton }.first { $0.title == "发布" }!
    assert(panel.popover.contentViewController === panel)
    assert(panel.popover.behavior == .transient)
    assert(!publish.isEnabled)
    editor.string = "第一行\\n第二行\\n\\n下一段"
    panel.textDidChange(Notification(name: NSText.didChangeNotification))
    assert(publish.isEnabled)
    publish.performClick(nil)
    assert(panel.busy && !editor.isEditable && !publish.isEnabled)
    assert(panel.popoverShouldClose(panel.popover))
    for _ in 0..<200 { if !panel.busy { break }; try await Task.sleep(nanoseconds: 100_000_000) }
    assert(!panel.busy && editor.string == "第一行\\n第二行\\n\\n下一段")
    assert(publish.title == "重试发布" && publish.isEnabled)
    editor.string += "\\n补充"
    panel.textDidChange(Notification(name: NSText.didChangeNotification))
    publish.performClick(nil)
    for _ in 0..<200 { if !panel.busy { break }; try await Task.sleep(nanoseconds: 100_000_000) }
    assert(!panel.busy && editor.string.isEmpty && !publish.isEnabled)
    assert(UserDefaults.standard.dictionary(forKey: "quick-thought-draft") == nil)
    assert(panel.popoverShouldClose(panel.popover))
  }
}`);
    const compile = Bun.spawn(['xcrun', 'swiftc', '-parse-as-library', resolve(import.meta.dir, 'macos/QuickThoughtPanel.swift'), swift, '-o', executable], { stdout: 'pipe', stderr: 'pipe' });
    const errors = await new Response(compile.stderr).text();
    expect(await compile.exited, errors).toBe(0);
    const check = Bun.spawn([executable, String(server.port)], { stdout: 'pipe', stderr: 'pipe' });
    const stderr = await new Response(check.stderr).text();
    expect(await check.exited, stderr).toBe(0);
    expect(calls).toBe(2);
    expect(interruptedStatus).toBe(true);
    const documents = await store.list();
    expect(documents).toHaveLength(1);
    const saved = await store.read(documents[0].id);
    expect(saved.body).toBe('第一行\n第二行\n\n下一段\n补充');
    expect(saved.meta.description).toBe(saved.body);
  } finally { server?.stop(true); await rm(root, { recursive: true, force: true }); }
}, 60_000);

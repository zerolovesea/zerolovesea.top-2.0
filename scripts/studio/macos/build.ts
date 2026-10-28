import { mkdir, cp, writeFile, rm, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { launchHTML } from './launch';

const root = resolve(import.meta.dir, '../../..');
const app = resolve(root, '.local-studio/Tidemark.app');
const contents = resolve(app, 'Contents');
const resources = resolve(contents, 'Resources');
const extension = resolve(contents, 'PlugIns/TidemarkWidgets.appex/Contents');
const identities = Bun.spawn(['security', 'find-identity', '-v', '-p', 'codesigning'], { stdout: 'pipe', stderr: 'pipe' });
const available = await new Response(identities.stdout).text();
const identity = available.match(/([A-F0-9]{40}) "Developer ID Application:/)?.[1] || available.match(/([A-F0-9]{40}) "Apple Development:/)?.[1];
if (!identity) throw new Error('系统小组件需要钥匙串中的 Developer ID Application 或 Apple Development 签名证书');
await rm(resolve(contents, 'MacOS/Studio'), { force: true });
await mkdir(resolve(contents, 'MacOS'), { recursive: true });
await mkdir(resources, { recursive: true });
await writeFile(resolve(resources, 'Launch.html'), await launchHTML());
await mkdir(resolve(extension, 'MacOS'), { recursive: true });
await mkdir(resolve(extension, 'Resources'), { recursive: true });
async function run(args: string[]) {
  const child = Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`构建失败：${args[0]}`);
}
await run(['xcrun', 'swiftc', '-parse-as-library', '-swift-version', '5', '-O', '-framework', 'AppKit', '-framework', 'WebKit', '-framework', 'QuartzCore', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx13.0`, resolve(import.meta.dir, 'Studio.swift'), resolve(import.meta.dir, 'LaunchView.swift'), resolve(import.meta.dir, 'QuickWrite.swift'), resolve(import.meta.dir, 'QuickThoughtPanel.swift'), '-o', resolve(contents, 'MacOS/Tidemark')]);
const widgetBuild = resolve(root, '.local-studio/widget-build');
const xcode = Bun.spawnSync(['xcodebuild', '-version'], { stdout: 'pipe', stderr: 'pipe' });
if (xcode.exitCode === 0) {
  await run(['xcodebuild', '-project', resolve(import.meta.dir, 'Widgets.xcodeproj'), '-scheme', 'TidemarkWidgets', '-configuration', 'Release', '-sdk', 'macosx', '-derivedDataPath', resolve(root, '.local-studio/widget-derived'), 'CODE_SIGNING_ALLOWED=NO', `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`, `CONFIGURATION_BUILD_DIR=${widgetBuild}`, 'build']);
  await cp(resolve(widgetBuild, 'TidemarkWidgets.appex'), resolve(extension, '..'), { recursive: true });
} else {
  // Static WidgetKit configurations need no App Intents metadata or full Xcode.
  // Match Xcode's macOS extension entry: Foundation bootstraps the extension before SwiftUI's main.
  await run(['xcrun', 'swiftc', '-parse-as-library', '-swift-version', '5', '-O', '-application-extension', '-Xlinker', '-e', '-Xlinker', '_NSExtensionMain', '-Xlinker', '-u', '-Xlinker', '_main', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx14.0`, '-module-name', 'TidemarkWidgets', resolve(import.meta.dir, 'QuickWriteWidget.swift'), resolve(import.meta.dir, 'QuickWrite.swift'), resolve(import.meta.dir, 'ReadingWidget.swift'), '-o', resolve(extension, 'MacOS/TidemarkWidgets')]);
  const plist = (await readFile(resolve(import.meta.dir, 'Widget-Info.plist'), 'utf8'))
    .replaceAll('$(EXECUTABLE_NAME)', 'TidemarkWidgets').replaceAll('$(PRODUCT_BUNDLE_IDENTIFIER)', 'top.zerolovesea.studio.widgets')
    .replaceAll('$(PRODUCT_NAME)', 'TidemarkWidgets').replaceAll('$(CURRENT_PROJECT_VERSION)', '14').replaceAll('$(MARKETING_VERSION)', '1.5.2')
    .replace('<key>NSExtension</key>', '<key>LSMinimumSystemVersion</key><string>14.0</string><key>NSExtension</key>');
  await writeFile(resolve(extension, 'Info.plist'), plist);
}
const widgetBinary = resolve(extension, 'MacOS/TidemarkWidgets');
const loadCommands = Bun.spawnSync(['otool', '-l', widgetBinary]);
const symbols = Bun.spawnSync(['otool', '-Iv', widgetBinary]);
const commands = loadCommands.stdout.toString();
const base = commands.match(/segname __TEXT\s+vmaddr (0x[0-9a-f]+)/)?.[1];
const entry = commands.match(/cmd LC_MAIN\s+cmdsize \d+\s+entryoff (\d+)/)?.[1];
const bootstrap = symbols.stdout.toString().match(/^(0x[0-9a-f]+)\s+\d+\s+_NSExtensionMain$/m)?.[1];
if (loadCommands.exitCode !== 0 || symbols.exitCode !== 0 || !base || !entry || !bootstrap || BigInt(base) + BigInt(entry) !== BigInt(bootstrap)) {
  throw new Error('WidgetKit 扩展启动入口无效，必须先经过 macOS NSExtensionMain');
}
const tokenPath = resolve(root, '.local-studio/widget-token');
let widgetToken: string;
try { widgetToken = await readFile(tokenPath, 'utf8'); } catch (error: any) {
  if (error.code !== 'ENOENT') throw error;
  widgetToken = randomBytes(32).toString('hex');
  await writeFile(tokenPath, widgetToken, { mode: 0o600 });
}
for (const directory of [resources, resolve(extension, 'Resources')]) await writeFile(resolve(directory, 'WidgetToken.txt'), widgetToken, { mode: 0o600 });
await cp(resolve(root, 'public/favicon-96x96.png'), resolve(extension, 'Resources/WidgetLogo.png'));
await cp(process.execPath, resolve(resources, 'bun'));
await run(['xcrun', 'swift', resolve(import.meta.dir, 'StatusIcon.swift'), resolve(root, 'public/android-icon-192x192.png'), resolve(resources, 'StatusIcon.png')]);
// shortcut: this local app is bound to the repository path; rebuild after moving the repository.
await writeFile(resolve(resources, 'project.txt'), root);
const iconset = resolve(root, '.local-studio/studio.iconset');
await mkdir(iconset, { recursive: true });
// Reuse the blog's existing cat artwork for every macOS icon resolution.
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) await run(['sips', '-s', 'format', 'png', '-z', String(size * scale), String(size * scale), resolve(root, 'public/android-icon-192x192.png'), '--out', resolve(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)]);
}
await run(['iconutil', '-c', 'icns', iconset, '-o', resolve(resources, 'Studio.icns')]);
await writeFile(resolve(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Tidemark</string>
<key>CFBundleIdentifier</key><string>top.zerolovesea.studio</string>
<key>CFBundleName</key><string>Tidemark</string>
<key>CFBundleDisplayName</key><string>Tidemark</string>
<key>CFBundleVersion</key><string>14</string>
<key>CFBundleShortVersionString</key><string>1.5.2</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleSupportedPlatforms</key><array><string>MacOSX</string></array>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleIconFile</key><string>Studio</string>
<key>CFBundleURLTypes</key><array><dict>
<key>CFBundleURLName</key><string>top.zerolovesea.studio.compose</string>
<key>CFBundleTypeRole</key><string>Editor</string>
<key>CFBundleURLSchemes</key><array><string>tidemark</string></array>
</dict></array>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>`);
for (const locale of ['en', 'zh-Hans']) {
  const directory = resolve(resources, `${locale}.lproj`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'InfoPlist.strings'), '"CFBundleName" = "Tidemark";\n"CFBundleDisplayName" = "Tidemark";\n');
}
const entitlements = resolve(root, '.local-studio/widget-entitlements.plist');
await writeFile(entitlements, '<?xml version="1.0"?><plist version="1.0"><dict><key>com.apple.security.app-sandbox</key><true/><key>com.apple.security.network.client</key><true/></dict></plist>');
await run(['plutil', '-lint', resolve(extension, 'Info.plist')]);
await run(['plutil', '-lint', resolve(contents, 'Info.plist')]);
await run(['codesign', '--force', '--sign', identity, '--timestamp=none', resolve(resources, 'bun')]);
await run(['codesign', '--force', '--sign', identity, '--timestamp=none', '--entitlements', entitlements, resolve(extension, '..')]);
await run(['codesign', '--force', '--sign', identity, '--timestamp=none', app]);
await run(['codesign', '--verify', '--deep', '--strict', app]);
console.log(`\n已生成 macOS 应用：${app}`);

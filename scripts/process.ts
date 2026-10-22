export type Run = (args: string[], cwd: string, output: (text: string) => void) => Promise<number>;
export const run: Run = async (args, cwd, output) => {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const consume = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader(), decoder = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break; output(decoder.decode(value, { stream: true })); }
    output(decoder.decode());
  };
  await Promise.all([consume(child.stdout), consume(child.stderr)]);
  return await child.exited;
};

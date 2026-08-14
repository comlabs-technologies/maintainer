export function fileFromUnifiedDiff(patch: string): string | null {
  const lines = patch.split("\n");
  const output: string[] = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      started = true;
      continue;
    }
    if (!started) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) output.push(line.slice(1));
    else if (line.startsWith("-") && !line.startsWith("---")) continue;
    else if (line.startsWith("\\")) continue;
    else output.push(line.startsWith(" ") ? line.slice(1) : line);
  }
  if (!started) return null;
  return output.join("\n");
}

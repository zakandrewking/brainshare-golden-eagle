export function detectHandoffIntentFromText(text: string): boolean {
  const normalized = text.toLowerCase();
  const patterns: RegExp[] = [
    /\[tool\]/,
    /<tool>/,
    /```tool/,
    /use_tool:/,
    /call_tool:/,
    /<<tool:/,
  ];
  return patterns.some((p) => p.test(normalized));
}

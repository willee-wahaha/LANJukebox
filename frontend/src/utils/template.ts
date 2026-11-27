export function fillTemplate(source: string, values: Record<string, string>): string {
  return source.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? '');
}

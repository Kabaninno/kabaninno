import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllProjects } from '~/content';

/** Every gallery / demo file referenced by content exists in public/ and stays light. */
describe('portfolio assets', () => {
  const files = getAllProjects().flatMap((project) => [
    ...project.gallery.map((item) => ({ project: project.slug, ...item })),
    ...(project.demo?.type === 'video'
      ? [{ project: project.slug, src: project.demo.src, width: 0, height: 0 }]
      : []),
  ]);

  it.each(files)('$src exists ($project)', ({ src }) => {
    expect(existsSync(join(process.cwd(), 'public', src))).toBe(true);
  });

  it('SVG placeholders match their declared size and are a few KB', () => {
    for (const { src, width, height } of files.filter((file) => file.src.endsWith('.svg'))) {
      const path = join(process.cwd(), 'public', src);
      const svg = readFileSync(path, 'utf8');
      expect(svg).toContain(`width="${width}" height="${height}"`);
      expect(statSync(path).size).toBeLessThan(8 * 1024);
      // No text that would need translating.
      expect(svg).not.toMatch(/<text/);
    }
  });

  it('every stub case has a gallery and the demo types are covered', () => {
    expect(getAllProjects().every((project) => project.gallery.length >= 2)).toBe(true);
    const types = new Set(getAllProjects().map((project) => project.demo?.type));
    expect(types.has('iframe')).toBe(true);
    expect(types.has('mockup')).toBe(true);
  });
});

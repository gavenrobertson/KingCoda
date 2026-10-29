import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { renderMarkdown } = await import('../src/lib/markdown');

describe('renderMarkdown', () => {
  it('renders GFM and maths', async () => {
    const html = await renderMarkdown(
      'Sum `xs`, where $x_i \\le 10$.\n\n| a | b |\n| - | - |\n| 1 | 2 |',
    );
    expect(html).toContain('<code>xs</code>');
    expect(html).toContain('class="katex"');
    expect(html).toContain('<table>');
  });

  it('strips raw HTML, scripts and javascript: links', async () => {
    const html = await renderMarkdown(
      '<script>alert(1)</script><img src=x onerror=alert(1)> [x](javascript:alert(1)) <b onclick="x()">b</b>',
    );
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:/i);
  });

  it('keeps KaTeX from running TeX-level tricks', async () => {
    const html = await renderMarkdown('$\\href{javascript:alert(1)}{x}$ $\\htmlId{a}{b}$');
    // \href is refused (rendered as error text); the source survives only as inert annotation text.
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toContain('id="a"');
  });
});

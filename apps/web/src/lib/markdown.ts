import 'server-only';
import rehypeKatex, { type Options as KatexOptions } from 'rehype-katex';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

// GitHub's sanitize schema plus the math classes remark-math emits. Sanitizing runs before
// KaTeX, so only KaTeX's own output (built from the sanitized TeX source) adds markup after it.
const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', 'language-math', 'math-inline', 'math-display'],
    ],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'math', 'math-inline']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math', 'math-display']],
  },
  // No raw HTML at all in statements, links can't run script, images only over https.
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'], src: ['https'] },
  clobberPrefix: 'md-',
};

// rehype-katex never throws: bad TeX renders as an inline error.
const katex: KatexOptions = { strict: 'ignore', trust: false };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSanitize, schema)
  .use(rehypeKatex, katex)
  .use(rehypeStringify);

/** Markdown (GFM + $maths$) to sanitized HTML. Raw HTML in the source is dropped. */
export async function renderMarkdown(md: string): Promise<string> {
  return String(await processor.process(md));
}

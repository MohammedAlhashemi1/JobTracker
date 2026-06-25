import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: ({ children }) => <h1 className="text-base font-bold text-white mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mt-2 mb-1 first:mt-0">{children}</h3>,
  p:  ({ children }) => <p  className="text-sm text-slate-300 leading-relaxed mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em:     ({ children }) => <em     className="italic text-slate-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-0.5 mb-2 text-sm text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-2 text-sm text-slate-300">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-slate-700 my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-500 pl-3 italic text-slate-400 mb-2">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="text-xs bg-slate-700 text-emerald-300 px-1.5 py-0.5 rounded font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-slate-700 rounded-lg p-3 overflow-x-auto mb-2 text-xs font-mono text-slate-300">{children}</pre>
  ),
};

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";

const languageFor = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase();
  return ({ tsx: "tsx", ts: "typescript", jsx: "jsx", js: "javascript", json: "json", css: "css", html: "html", md: "markdown", yml: "yaml", yaml: "yaml", sh: "bash" } as Record<string, string>)[extension ?? ""] ?? "text";
};

export function CodePreview({ code, path }: { code: string; path: string }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let current = true;
    void codeToHtml(code, { lang: languageFor(path), theme: "github-dark-default" })
      .then((value) => { if (current) setHtml(value); })
      .catch(() => { if (current) setHtml(""); });
    return () => { current = false; };
  }, [code, path]);
  return html
    ? <div className="shiki-preview" dangerouslySetInnerHTML={{ __html: html }} />
    : <pre><code>{code}</code></pre>;
}

export function MarkdownPreview({ content }: { content: string }) {
  const components = useMemo(() => ({
    img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => <img src={src} alt={alt ?? ""} loading="lazy" />,
    a: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} target="_blank" rel="noreferrer">{children}</a>
  }), []);
  return <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown></article>;
}

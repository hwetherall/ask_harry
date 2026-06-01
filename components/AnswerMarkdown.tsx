"use client";

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => <span className="placeholder">…</span>,
});

export function AnswerMarkdown({ text }: { text: string }) {
  return <ReactMarkdown>{text}</ReactMarkdown>;
}

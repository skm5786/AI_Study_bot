import { useState } from "react";

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-border bg-panel px-3 py-2 text-sm font-medium hover:bg-panelSoft"
    >
      {copied ? "Copied" : "Copy text"}
    </button>
  );
}

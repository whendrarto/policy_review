"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/chat/client";

type ChatPanelProps = {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onRetry: () => void;
};

/** A chat transcript with a message box. It knows nothing about the document being drafted. */
export function ChatPanel({ messages, pending, error, onSend, onRetry }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const canSend = !pending && input.trim() !== "";

  // Keep the latest message in view. Scrolling the list itself never moves the page.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending, error]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  }

  // Enter sends and Shift+Enter starts a new line, except while an IME is composing text.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5 max-lg:max-h-[60vh]" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === "user" ? "rounded-br-sm bg-primary/15 text-navy" : "rounded-bl-sm bg-zinc-100 text-zinc-900"
              }`}
            >
              <span className="sr-only">{message.role === "user" ? "You: " : "Assistant: "}</span>
              {message.content}
            </p>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <span className="sr-only">The assistant is typing…</span>
            <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3" aria-hidden>
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={onRetry} className="shrink-0 font-medium underline hover:no-underline">
              Retry
            </button>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-zinc-200 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type your answer…"
          className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}

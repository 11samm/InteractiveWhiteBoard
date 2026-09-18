import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, BookOpen, Image as ImageIcon, Square, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import type { Editor } from 'tldraw';
import {
  getBoardMessages,
  sendChatMessage,
  type CitationDto,
  type MessageDto,
  type MessageRole,
} from '../lib/api';

interface ChatPanelProps {
  boardId: string;
  editor: Editor | null;
  theme: 'light' | 'dark';
  onClose: () => void;
}

interface DisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  citations: CitationDto[];
  pending?: boolean;
}

function toDisplay(m: MessageDto): DisplayMessage {
  return { id: m.id, role: m.role, content: m.content, citations: m.citations };
}

/** Captures a PNG snapshot of the current page, downscaled, as a bare base64 string (no data-URL prefix). */
async function captureBoardSnapshot(editor: Editor): Promise<string | undefined> {
  const shapeIds = [...editor.getCurrentPageShapeIds()];
  if (shapeIds.length === 0) return undefined;
  try {
    const { url } = await editor.toImageDataUrl(shapeIds, {
      format: 'png',
      background: true,
      padding: 32,
      pixelRatio: 1,
    });
    const commaIndex = url.indexOf(',');
    return commaIndex === -1 ? undefined : url.slice(commaIndex + 1);
  } catch {
    return undefined; // best-effort — chat still works without a board snapshot
  }
}

/**
 * Floating grounded-tutor chat (PLAN.md 5.2, Phase 4). Streams tokens as
 * they arrive, shows the retrieved sources behind each answer, and
 * distinguishes the failure states the plan calls out (no key, rate limit,
 * budget, model failure) instead of failing silently.
 */
export function ChatPanel({ boardId, editor, theme, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [includeBoard, setIncludeBoard] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBoardMessages(boardId)
      .then((history) => setMessages(history.map(toDisplay)))
      .catch(() => {
        // History is a nice-to-have; an empty transcript is still usable.
      });
  }, [boardId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    setIsSending(true);

    const userMsg: DisplayMessage = { id: `local-${Date.now()}`, role: 'user', content: text, citations: [] };
    const assistantId = `pending-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', citations: [], pending: true }]);

    const boardImage = includeBoard && editor ? await captureBoardSnapshot(editor) : undefined;

    const controller = new AbortController();
    abortRef.current = controller;

    await sendChatMessage(
      boardId,
      text,
      boardImage,
      {
        onToken: (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        },
        onDone: ({ messageId, citations }) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, id: messageId, citations, pending: false } : m)),
          );
        },
        onError: ({ message }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, role: 'error', content: message, pending: false } : m,
            ),
          );
        },
      },
      controller.signal,
    );

    abortRef.current = null;
    setIsSending(false);
  }, [boardId, editor, includeBoard, input, isSending]);

  const handleCancel = () => abortRef.current?.abort();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`fixed bottom-24 right-8 z-50 w-[32rem] max-w-[calc(100vw-4rem)] h-[36rem] max-h-[80vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden ${
        isDark ? 'bg-slate-900/95 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-300 text-slate-900'
      }`}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <h2 className="font-semibold text-sm">AI Tutor</h2>
        <button onClick={onClose} aria-label="Close chat" title="Close chat" className="p-1 rounded hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Ask about the board, or about anything in your uploaded files.
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} isDark={isDark} />
        ))}
      </div>

      <div className={`px-4 py-2 border-t flex items-center gap-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setIncludeBoard((v) => !v)}
          title={includeBoard ? 'Board snapshot will be sent with your question' : 'Board snapshot will not be sent'}
          aria-pressed={includeBoard}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
            includeBoard
              ? 'bg-cyan-500/20 text-cyan-400'
              : isDark
                ? 'bg-slate-800 text-slate-500'
                : 'bg-slate-200 text-slate-500'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Board
        </button>
        <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {isSending ? 'Answering…' : ''}
        </span>
      </div>

      <div className={`p-3 flex items-end gap-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question…"
          rows={1}
          className={`flex-1 resize-none rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
            isDark ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-slate-100 text-slate-900 placeholder:text-slate-400'
          }`}
        />
        {isSending ? (
          <button
            type="button"
            onClick={handleCancel}
            title="Stop"
            aria-label="Stop generating"
            className="p-2.5 rounded-lg bg-red-500/90 text-white hover:opacity-90"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            title="Send"
            aria-label="Send question"
            className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white disabled:opacity-40 hover:opacity-90"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, isDark }: { message: DisplayMessage; isDark: boolean }) {
  if (message.role === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{message.content}</span>
      </div>
    );
  }

  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-xl px-3 py-2 text-sm break-words ${
          isUser
            ? 'max-w-[85%] whitespace-pre-wrap bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
            : isDark
              ? 'w-full max-w-full bg-slate-800 text-slate-100'
              : 'w-full max-w-full bg-slate-100 text-slate-900'
        }`}
      >
        {isUser ? (
          message.content
        ) : message.content ? (
          <AssistantMarkdown content={message.content} isDark={isDark} />
        ) : message.pending ? (
          '…'
        ) : null}
        {message.citations.length > 0 && (
          <div className={`mt-2 pt-2 border-t space-y-1 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            {message.citations.map((c) => (
              <details key={c.id} className="text-xs opacity-80">
                <summary className="cursor-pointer flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {c.filename} · p.{c.page}
                </summary>
                <p className="mt-1 pl-4 opacity-80 whitespace-pre-wrap">{c.excerpt}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantMarkdown({ content, isDark }: { content: string; isDark: boolean }) {
  const muted = isDark ? 'border-slate-500 text-slate-300' : 'border-slate-300 text-slate-600';
  const codeBg = isDark ? 'bg-black/30' : 'bg-black/10';
  return (
    <div className="leading-relaxed">
      <Markdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className={`border-l-2 pl-3 my-2 ${muted}`}>{children}</blockquote>
          ),
          pre: ({ children }) => (
            <pre className={`my-2 overflow-x-auto rounded-md px-2 py-1.5 text-xs ${codeBg}`}>{children}</pre>
          ),
          code: ({ children, className }) =>
            className ? (
              <code className="font-mono text-xs">{children}</code>
            ) : (
              <code className={`rounded px-1 py-0.5 font-mono text-xs ${codeBg}`}>{children}</code>
            ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline text-cyan-400">
              {children}
            </a>
          ),
          hr: () => <hr className={`my-2 ${isDark ? 'border-slate-700' : 'border-slate-300'}`} />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

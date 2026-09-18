import { useEffect, useRef, useState } from 'react';
import type { Editor } from 'tldraw';
import type { AnnotationAction } from '../../../shared/annotationSchema';
import { applyAnnotations, captureAnnotationContext, type AnnotationContext } from '../annotations';
import { requestAnnotations } from '../lib/api';

interface Props {
  boardId: string;
  editor: Editor | null;
  theme: 'light' | 'dark';
}

function describe(action: AnnotationAction): string {
  if (action.type === 'note') return `Note: ${action.text}`;
  if (action.type === 'text') return `Text: ${action.text}`;
  if (action.type === 'arrow') return `Arrow: ${action.label}`;
  return 'Highlight an area of the board';
}

export function AnnotationComposer({ boardId, editor, theme }: Props) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ actions: AnnotationAction[]; context: AnnotationContext } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isDark = theme === 'dark';

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async () => {
    if (!editor || !instruction.trim() || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProposal(null);
    try {
      const context = await captureAnnotationContext(editor);
      if (controller.signal.aborted) return;
      const actions = await requestAnnotations(boardId, instruction.trim(), context.boardImage, controller.signal);
      if (controller.signal.aborted) return;
      if (actions.length === 0) {
        setNotice('The tutor did not propose a board change. Try a more specific request.');
      } else {
        setProposal({ actions, context });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Could not generate annotations.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const apply = () => {
    if (!editor || !proposal) return;
    try {
      applyAnnotations(editor, proposal.actions, proposal.context.bounds);
      setNotice(`Added ${proposal.actions.length} AI annotation${proposal.actions.length === 1 ? '' : 's'} to the shared board. One Undo removes the set.`);
      setProposal(null);
      setInstruction('');
    } catch {
      setError('Could not add the annotations to the board. Please try again.');
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
      <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
        Describe what the tutor should add. Select shapes first to focus on them; otherwise it uses the whole board.
      </p>
      <textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        maxLength={600}
        rows={4}
        placeholder="Example: Add a note explaining this equation and highlight the important step."
        aria-label="Instructions for AI board annotations"
        className={`w-full resize-y rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-slate-100 text-slate-900 placeholder:text-slate-400'}`}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!editor || !instruction.trim() || busy}
          onClick={() => void generate()}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {busy ? 'Generating…' : 'Propose annotations'}
        </button>
        {busy && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500">
            Stop
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-red-400">{error}</p>}
      {notice && <p role="status" className="text-cyan-400">{notice}</p>}
      {proposal && (
        <section className={`rounded-xl border p-3 space-y-3 ${isDark ? 'border-violet-400/40 bg-violet-500/10' : 'border-violet-300 bg-violet-50'}`}>
          <div>
            <h3 className="font-semibold">Review proposed board changes</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Positioned relative to {proposal.context.selected ? 'the selected shapes' : 'the board'}.
            </p>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {proposal.actions.map((action, index) => <li key={index} className="break-words">{describe(action)}</li>)}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={apply} className="px-3 py-2 rounded-lg bg-violet-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
              Add to shared board
            </button>
            <button type="button" onClick={() => setProposal(null)} className="px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500">
              Discard
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

import { useState } from 'react';

interface NamePromptProps {
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
}

/**
 * Full-screen "what's your name?" gate, used both for the host (creating a
 * board on `HomePage`) and for guests (opening a board link on
 * `BoardPage`). Leaving the field blank falls back to `placeholder`
 * ("Host"/"Guest") — the name is only used for presence (cursor labels,
 * avatars), never as an access credential.
 */
export function NamePrompt({ title, description, placeholder, confirmLabel, onSubmit }: NamePromptProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name.trim() || placeholder);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-slate-950 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">{title}</h1>
        <p className="text-slate-400 mb-6">{description}</p>

        <label htmlFor="display-name" className="sr-only">
          Your name
        </label>
        <input
          id="display-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          maxLength={40}
          className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-4 text-center"
        />

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium hover:opacity-90 transition-opacity"
        >
          {confirmLabel}
        </button>

        <p className="mt-4 text-xs text-slate-500">
          Leave it blank to join as “{placeholder}”.
        </p>
      </form>
    </div>
  );
}

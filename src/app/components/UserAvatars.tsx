interface Collaborator {
  id: string;
  name: string;
  color: string;
}

interface UserAvatarsProps {
  theme: 'light' | 'dark';
  collaborators: Collaborator[];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Shows who else is currently on this board. Backed by real tldraw presence
 * records (see `BoardPage`), not mock data — tldraw itself already renders
 * live collaborator cursors on the canvas; this is just a compact roster.
 */
export function UserAvatars({ theme, collaborators }: UserAvatarsProps) {
  const canvasBackgroundColor = theme === 'dark' ? '#020617' : '#f8fafc';

  if (collaborators.length === 0) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40 flex items-center">
      <div className="flex -space-x-3">
        {collaborators.map((user, index) => (
          <div key={user.id} className="relative group" style={{ zIndex: collaborators.length - index }}>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm cursor-default hover:scale-110 transition-transform ${
                theme === 'dark' ? 'border-2 border-slate-900' : 'border-2 border-slate-100'
              }`}
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {initialsFor(user.name)}
            </div>
            <div
              className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full"
              style={{ border: `2px solid ${canvasBackgroundColor}` }}
            />

            {/* Tooltip */}
            <div
              className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity ${
                theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'
              }`}
            >
              {user.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

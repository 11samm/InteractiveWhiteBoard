interface User {
  id: string;
  name: string;
  color: string;
  initials: string;
}

interface UserAvatarsProps {
  theme: 'light' | 'dark';
}

export function UserAvatars({ theme }: UserAvatarsProps) {
  const users: User[] = [
    { id: '1', name: 'Sarah Chen', color: 'bg-blue-500', initials: 'SC' },
    { id: '2', name: 'Alex Morgan', color: 'bg-purple-500', initials: 'AM' },
    { id: '3', name: 'Jordan Lee', color: 'bg-green-500', initials: 'JL' },
  ];

  const canvasBackgroundColor = theme === 'dark' ? '#020617' : '#f8fafc';

  return (
    <div className="fixed top-6 left-6 z-40 flex items-center">
      <div className="flex -space-x-3">
        {users.map((user, index) => (
          <div
            key={user.id}
            className="relative group"
            style={{ zIndex: users.length - index }}
          >
            <div
              className={`w-10 h-10 rounded-full ${user.color} flex items-center justify-center text-white font-medium text-sm cursor-pointer hover:scale-110 transition-transform ${
                theme === 'dark' ? 'border-2 border-slate-900' : 'border-2 border-slate-100'
              }`}
              title={user.name}
            >
              {user.initials}
            </div>
            <div 
              className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full"
              style={{
                border: `2px solid ${canvasBackgroundColor}`
              }}
            />
            
            {/* Tooltip */}
            <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity ${
              theme === 'dark' 
                ? 'bg-slate-800 text-white' 
                : 'bg-slate-900 text-white'
            }`}>
              {user.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
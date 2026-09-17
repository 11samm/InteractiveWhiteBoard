/**
 * Placeholder for the host-only administration surface described in
 * PLAN.md 4.2/4.5. In later phases this becomes a loopback-only (or
 * admin-secret-protected) page served by the host process, where the host
 * enters their Gemini API key and sees join links / usage. It intentionally
 * does nothing yet: there is no backend to talk to until Phase 2, and no
 * key should ever be accepted or stored by client-side code alone.
 */
export default function HostSetupPage() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-md px-6 text-center text-slate-300">
        <h1 className="text-2xl font-semibold text-white mb-3">Host setup</h1>
        <p className="mb-4">
          This is where the host will configure their Gemini API key, view guest join links,
          and manage boards once the host server (Phase 2) exists.
        </p>
        <p className="text-sm text-slate-500">
          This page is a placeholder and does not accept or store any credentials yet.
        </p>
      </div>
    </div>
  );
}

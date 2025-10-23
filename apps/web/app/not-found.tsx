export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-9xl font-bold text-blue-500">404</h1>
        <p className="text-2xl text-slate-300">Page Not Found</p>
        <p className="text-sm text-slate-500">
          The page you're looking for doesn't exist.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <a
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
          >
            Home
          </a>
          <a
            href="/vpn"
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all"
          >
            VPN Client
          </a>
        </div>
      </div>
    </div>
  );
}


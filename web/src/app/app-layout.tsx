import { Link, Outlet } from 'react-router';

export function AppLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm">
        <Link to="/" className="font-semibold">
          Flash Sale
        </Link>
        <Link to="/orders" className="underline-offset-4 hover:underline">
          Check purchase
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center p-4 sm:items-center">
        <Outlet />
      </main>
    </div>
  );
}

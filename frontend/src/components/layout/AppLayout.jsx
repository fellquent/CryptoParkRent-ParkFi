import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <main className="app-root">
      <Outlet />
    </main>
  );
}

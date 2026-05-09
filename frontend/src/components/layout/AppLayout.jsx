import { Link, Outlet, useLocation } from "react-router-dom";
import { ConnectionStatus } from "../shared/ConnectionStatus";

export function AppLayout() {
  const location = useLocation();
  const isTestRoute = location.pathname.startsWith("/tests");

  return (
    <main>
      {isTestRoute ? (
        <>
          <nav>
            <Link to="/">Home</Link>{" "}
            <Link to="/tests/getters">/tests/getters</Link>{" "}
            <Link to="/tests/createSpot">/tests/createSpot</Link>
          </nav>

          <ConnectionStatus />
        </>
      ) : null}

      <Outlet />
    </main>
  );
}

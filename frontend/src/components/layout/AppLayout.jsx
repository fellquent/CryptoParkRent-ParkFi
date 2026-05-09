import { Link, Outlet } from "react-router-dom";
import { ConnectionStatus } from "../shared/ConnectionStatus";

export function AppLayout() {
  return (
    <main>
      <h1>ParkFi Frontend</h1>

      <nav>
        <Link to="/">Home</Link>{" "}
        <Link to="/tests/getters">/tests/getters</Link>{" "}
        <Link to="/tests/createSpot">/tests/createSpot</Link>
      </nav>

      <ConnectionStatus />

      <Outlet />
    </main>
  );
}

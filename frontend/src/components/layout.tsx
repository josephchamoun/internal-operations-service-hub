import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { Button } from "./button";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const admin = user?.role === "admin";
  return (
    <div className="app-shell">
      <header>
        <Link to="/queue" className="brand">
          Ops Hub
        </Link>
        <nav>
          <NavLink to="/queue">Queue</NavLink>
          <NavLink to="/mine">My requests</NavLink>
          <NavLink to="/new">New request</NavLink>
          {admin && <NavLink to="/admin/users">Admin</NavLink>}
        </nav>
        <div className="identity">
          <span>
            {user?.userId} · {user?.role}
          </span>
          <Button className="quiet" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

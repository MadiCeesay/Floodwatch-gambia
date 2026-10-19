import { useEffect } from "react";
import {
  NavLink,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Waves,
  House,
  Map,
  Plus,
  ShieldCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Radio,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
const citizenLinks = [
  ["/", "Home", House],
  ["/map", "Flood map", Map],
  ["/report", "Report", Plus],
  ["/safety", "Stay safe", ShieldCheck],
  ["/my-reports", "My reports", ClipboardList],
];
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <Waves size={26} />
      </span>
      <span>
        FloodWatch<small> GAMBIA</small>
      </span>
      <span className="sr-only"> home</span>
    </Link>
  );
}
function Navigation({ links, className }) {
  return (
    <nav
      className={className}
      aria-label={
        className === "bottom-nav" ? "Mobile navigation" : "Main navigation"
      }
    >
      {links.map(([path, text, Icon]) => (
        <NavLink key={path} to={path} end={path === "/" || path === "/admin"}>
          <Icon size={19} />
          <span>{text}</span>
        </NavLink>
      ))}
    </nav>
  );
}
export function CitizenShell() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <Navigation
            className="desktop-nav"
            links={citizenLinks.filter((link) => link[0] !== "/report")}
          />
          <Link className="button primary header-report" to="/report">
            <Plus size={18} />
            Report flooding
          </Link>
        </div>
      </header>
      <main id="main" tabIndex="-1">
        <Outlet />
      </main>
      <footer className="site-footer">
        <Brand />
        <p>Community observations. Better informed responses.</p>
        <Link to="/login">
          Authority sign in <ArrowUpRight size={14} />
        </Link>
      </footer>
      <Navigation className="bottom-nav" links={citizenLinks} />
    </>
  );
}
export function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <Brand />
        <p className="eyebrow">OPERATIONS WORKSPACE</p>
        <Navigation
          className="admin-nav"
          links={[
            ["/admin", "Overview", LayoutDashboard],
            ["/admin/reports", "Reports", ClipboardList],
            ["/admin/map", "Incident map", Map],
            ["/admin/emergencies", "Help requests", Radio],
          ]}
        />
        <div className="sidebar-bottom">
          <Link to="/">
            Public website <ArrowUpRight size={16} />
          </Link>
          <span>{user?.name}</span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <span>
            <span className="status-dot" />
            FloodWatch · Authority workspace
          </span>
          <span>Administrator</span>
        </header>
        <main id="main" tabIndex="-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.title = `${pathname.startsWith("/admin") ? "Authority workspace" : "FloodWatch Gambia"} · Community flood reporting`;
  }, [pathname]);
  return null;
}

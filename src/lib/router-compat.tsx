// Compatibility shim so pages migrated from react-router-dom keep working
// with minimal edits on top of @tanstack/react-router.
import {
  useNavigate as useTSNavigate,
  useLocation as useTSLocation,
  useParams as useTSParams,
  Outlet,
  Link as TSLink,
} from "@tanstack/react-router";
import { forwardRef, useCallback, type ComponentProps, type ReactNode } from "react";

export { Outlet };
export { Link } from "@tanstack/react-router";

export function useLocation() {
  const loc = useTSLocation();
  return {
    ...loc,
    pathname: loc.pathname,
    search: typeof (loc as any).searchStr === "string" ? (loc as any).searchStr : "",
    hash: loc.hash ?? "",
    state: (loc as any).state ?? null,
  };
}

export function useNavigate() {
  const navigate = useTSNavigate();
  return useCallback((to: string | number, opts?: { replace?: boolean }) => {
    if (typeof to === "number") {
      if (to < 0 && typeof window !== "undefined") window.history.go(to);
      return;
    }
    const [pathPart, queryPart] = to.split("?");
    const search = queryPart
      ? Object.fromEntries(new URLSearchParams(queryPart).entries())
      : undefined;
    navigate({ to: pathPart, search: search as any, replace: opts?.replace });
  }, [navigate]);
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>) => void
] {
  const location = useTSLocation();
  const navigate = useTSNavigate();
  const sp = new URLSearchParams(
    typeof (location as any).searchStr === "string" ? (location as any).searchStr : ""
  );
  const setSp = (next: URLSearchParams | Record<string, string>) => {
    const obj =
      next instanceof URLSearchParams ? Object.fromEntries(next.entries()) : next;
    navigate({ to: location.pathname, search: obj as any });
  };
  return [sp, setSp];
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useTSParams({ strict: false } as any) as T;
}

type RenderFn = (state: { isActive: boolean; isPending: boolean }) => ReactNode | string;

export interface NavLinkProps
  extends Omit<ComponentProps<typeof TSLink>, "className" | "children"> {
  className?: string | RenderFn;
  children?: ReactNode | RenderFn;
  /** react-router-dom compat: when true, only match exact path */
  end?: boolean;
  /** react-router-dom compat: extra class when active */
  activeClassName?: string;
  /** react-router-dom compat: extra class when pending */
  pendingClassName?: string;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, children, end, activeClassName, pendingClassName, ...props }, ref) => {
    const buildClass = (state: any) => {
      const isActive = !!state?.isActive;
      const base =
        typeof className === "function"
          ? (className as RenderFn)({ isActive, isPending: false })
          : className;
      const parts = [base, isActive ? activeClassName : undefined].filter(Boolean);
      return parts.join(" ");
    };
    return (
      <TSLink
        {...(props as any)}
        ref={ref as any}
        activeOptions={end ? { exact: true } : undefined}
        className={buildClass as any}
      >
        {typeof children === "function"
          ? (((state: any) =>
              (children as RenderFn)({
                isActive: !!state?.isActive,
                isPending: false,
              })) as any)
          : children}
      </TSLink>
    );
  }
);
NavLink.displayName = "NavLink";

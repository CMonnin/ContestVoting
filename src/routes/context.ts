import type { Context, Hono } from "hono";
import type { AuthDeps, User } from "../auth.ts";
import type { Lang } from "../i18n.ts";
import type { Phase } from "../phase.ts";
import type { layout } from "../views.ts";

export type Env = {
  Variables: { lang: Lang; user: User | null; deviceId: string; ip: string };
};

export type App = Hono<Env>;

export const SESSION_COOKIE = "sid";
export const DEVICE_COOKIE = "did";
export const LANG_COOKIE = "lang";
export const YEAR_S = 365 * 24 * 3600;

/** What every route module gets from createApp(). */
export type RouteCtx = {
  deps: AuthDeps;
  photosDir: string;
  cookieOpts: { path: string; httpOnly: boolean; secure: boolean; sameSite: "Lax" };
  phaseNow: () => Phase;
  render: (c: Context<Env>, body: Parameters<typeof layout>[2], status?: 200 | 400 | 429) => Response | Promise<Response>;
};

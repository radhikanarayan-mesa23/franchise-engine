import "server-only";
import { cache } from "react";
import * as repo from "./repo";

/* Read-only, per-request memoised reads for pages and layouts: the layout and the page share one
   database round-trip instead of repeating it. API routes (which write) keep using repo directly. */
export const getSession = cache(repo.getSession);
export const latestSnapshots = cache(repo.latestSnapshots);
export const getReviewActions = cache(repo.getReviewActions);
export const getStageEvents = cache(repo.getStageEvents);
export const getChat = cache(repo.getChat);
export const latestTokenFor = cache(repo.latestTokenFor);

export const EVENTS_HOME_HREF = "/#events";
export const EVENTS_PAGE_PATH = "/events";

/** Home → teaser section; other pages → full events page. */
export function getEventsNavHref(isHome: boolean) {
  return isHome ? EVENTS_HOME_HREF : EVENTS_PAGE_PATH;
}

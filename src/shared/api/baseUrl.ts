export function apiUrl(path: string) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

  if (!apiBaseUrl || !path.startsWith("/api")) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

export function apiRequestInput(input: RequestInfo | URL): RequestInfo | URL {
  return typeof input === "string" ? apiUrl(input) : input;
}

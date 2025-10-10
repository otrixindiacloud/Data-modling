import { getAuthToken } from "./authToken";

if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Handle both direct URL and Request object inputs
    let url: string;
    let requestInit: RequestInit = init || {};

    if (input instanceof Request) {
      url = input.url;
      // Merge request properties with init
      requestInit = {
        ...requestInit,
        method: requestInit.method || input.method,
        headers: requestInit.headers || input.headers,
        body: requestInit.body || input.body,
        // Copy other properties if needed
      };
    } else {
      url = typeof input === 'string' ? input : input.toString();
    }

    const requestUrl = new URL(url, window.location.origin);

    // Only add auth header for same-origin API requests
    if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith("/api")) {
      const token = getAuthToken();
      
      if (token) {
        // Merge auth header with existing headers
        const headers = new Headers(requestInit.headers);
        headers.set("Authorization", `Bearer ${token}`);
        requestInit.headers = headers;
      }
    }

    return originalFetch(url, requestInit);
  };
}

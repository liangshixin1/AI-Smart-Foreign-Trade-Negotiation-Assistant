function getAuthHeaders() {
  const headers = {};
  if (state.auth.token) {
    headers["Authorization"] = `Bearer ${state.auth.token}`;
  }
  return headers;
}

async function fetchWithAuth(url, options = {}) {
  const merged = { ...options };
  merged.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  const response = await fetch(url, merged);
  if (
    response.status === 401
    && typeof window !== "undefined"
    && typeof window.handleUnauthorizedResponse === "function"
  ) {
    window.handleUnauthorizedResponse();
  }
  return response;
}


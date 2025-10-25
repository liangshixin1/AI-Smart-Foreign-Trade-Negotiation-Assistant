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
  return fetch(url, merged);
}


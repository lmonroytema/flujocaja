export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
export const AUTH_TOKEN_STORAGE_KEY = "flujo_caja_auth_token";

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function getAuthHeaders(headers?: HeadersInit): Headers {
  const resolvedHeaders = new Headers(headers);
  const token = typeof window !== "undefined" ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null;

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  return resolvedHeaders;
}

async function extractErrorPayload(response: Response): Promise<{ message: string; payload?: unknown }> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: string };
    return {
      message: payload.message ?? "No se pudo completar la solicitud.",
      payload,
    };
  }

  return {
    message: (await response.text()) || "No se pudo completar la solicitud.",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: getAuthHeaders(init?.headers),
  });

  if (!response.ok) {
    const error = await extractErrorPayload(response);
    throw new ApiError(error.message, response.status, error.payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function resolveFileName(response: Response, fallbackFileName: string): string {
  const contentDisposition = response.headers.get("Content-Disposition");
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);

  return match?.[1] ?? fallbackFileName;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: "DELETE",
    }),
  postFile: <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return request<T>(path, {
      method: "POST",
      body: formData,
    });
  },
  download: async (path: string, fallbackFileName: string) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await extractErrorPayload(response);
      throw new ApiError(error.message, response.status, error.payload);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = resolveFileName(response, fallbackFileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

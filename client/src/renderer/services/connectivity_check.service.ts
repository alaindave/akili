const RETRY_WINDOW = 60_000;
const RETRY_INTERVAL = 5_000;
const REQUEST_TIMEOUT = 10_000;
const API_URL = import.meta.env.VITE_API_URL;

const API_URL_PROMISE = window.electron.sync.getApiUrl(API_URL);

const hasInternetAccess = async (): Promise<boolean> => {
  return navigator.onLine;
};

export const checkOnline = async (): Promise<boolean> => {
  const hasInternet = await hasInternetAccess();

  if (!hasInternet) {
    console.log("NO INTERNET CONNECTION. BACKEND CHECK SKIPPED.");
    return false;
  }

  const API_URL = await API_URL_PROMISE;
  const startTime = Date.now();

  console.log(`CHECKING BACKEND: ${API_URL}/health`);

  while (Date.now() - startTime < RETRY_WINDOW) {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(`${API_URL}/health`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.ok) {
          console.log("BACKEND AVAILABLE.");
          return true;
        }

        console.log(`BACKEND RETURNED STATUS ${response.status}.`);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

      console.log(`BACKEND NOT READY YET (${elapsedSeconds}s).`);
    }

    if (Date.now() - startTime >= RETRY_WINDOW) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
  }

  console.error("BACKEND COULD NOT BE REACHED AFTER 60 SECONDS.");
  return false;
};

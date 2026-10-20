import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
export function useResource(path, authenticated = false) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
  });
  const key = `${path}:${authenticated}:${version}`;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api(path, { signal: controller.signal, authenticated })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, loading: false, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, loading: false, data: null, error });
      });
    return () => controller.abort();
  }, [path, authenticated, version, key]);
  return {
    ...(state.key === key ? state : { loading: true, data: null, error: null }),
    reload,
  };
}

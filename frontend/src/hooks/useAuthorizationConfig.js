import { useMemo } from "react";
import { authorizationConfig } from "../utils/apiConfig.js";

/**
 * Returns a stable Axios configuration containing the current bearer token.
 * @param {string|null} token Current access token.
 * @returns {{headers: {Authorization: string}}} Memoized Axios request config.
 */
export default function useAuthorizationConfig(token) {
  return useMemo(() => authorizationConfig(token), [token]);
}

export function authorizationConfig(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
}

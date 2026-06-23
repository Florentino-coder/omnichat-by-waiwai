export function readAccessTokenFromCookieHeader(
  cookieHeader: string | undefined
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const match = cookieHeader.match(/(?:^|;\s*)omnichat\.accessToken=([^;]+)/);
  if (!match?.[1]) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function readRefreshTokenFromCookieHeader(
  cookieHeader: string | undefined
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const match = cookieHeader.match(/(?:^|;\s*)omnichat\.refreshToken=([^;]+)/);
  if (!match?.[1]) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

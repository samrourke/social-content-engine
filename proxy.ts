export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};

export default function middleware(request: Request) {
  const header = request.headers.get('authorization');

  if (header?.startsWith('Basic ')) {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(':');
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);

    if (user === process.env.SITE_USER && pass === process.env.SITE_PASSWORD) {
      return; // let the request through
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Protected", charset="UTF-8"' },
  });
}
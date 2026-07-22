import { next } from '@vercel/functions';

export const config = {
  matcher: '/:path*',
};

const unauthorizedPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hidden Land Dharma — Private Curriculum</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
      color: #473a31;
      background: #f8f3ea;
      font-family: Georgia, 'Times New Roman', serif;
    }
    main { width: min(34rem, 100%); text-align: center; }
    .mark { color: #b96827; font-size: 2.5rem; line-height: 1; }
    h1 { margin: 1rem 0 .75rem; font-size: clamp(2rem, 7vw, 3.5rem); font-weight: 400; }
    p { margin: 0; font-size: 1.1rem; line-height: 1.65; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">&#10043;</div>
    <h1>Hidden Land Dharma</h1>
    <p>This curriculum is private. Enter the shared username and password in the sign-in window to continue.</p>
  </main>
</body>
</html>`;

function safeEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function reject(status = 401) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
  };

  if (status === 401) {
    headers['WWW-Authenticate'] = 'Basic realm="Hidden Land Dharma", charset="UTF-8"';
  }

  return new Response(unauthorizedPage, { status, headers });
}

export default function middleware(request) {
  const expectedPassword = process.env.SITE_PASSWORD;
  const expectedUsername = process.env.SITE_USERNAME || 'hidden-land';

  // Fail closed if the deployment has not been configured yet.
  if (!expectedPassword) {
    return reject(503);
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Basic ')) {
    return reject();
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(':');
    const username = separator >= 0 ? decoded.slice(0, separator) : '';
    const password = separator >= 0 ? decoded.slice(separator + 1) : '';

    if (safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword)) {
      return next();
    }
  } catch {
    // Invalid credentials receive the same response as incorrect credentials.
  }

  return reject();
}

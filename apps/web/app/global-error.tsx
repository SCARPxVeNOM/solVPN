"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Error - solVPN</title>
      </head>
      <body>
        <h1>Error</h1>
        <p>{error?.message || "Something went wrong"}</p>
        <a href="/">Go Home</a>
      </body>
    </html>
  );
}


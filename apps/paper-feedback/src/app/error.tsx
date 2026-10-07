"use client";
export default function ErrorPage({reset}:{reset:()=>void}) {return <main id="main" className="login"><h1>Workspace unavailable</h1><p>We could not load the paper feedback workspace. Check the database configuration or try again.</p><button onClick={reset}>Try again</button></main>;}

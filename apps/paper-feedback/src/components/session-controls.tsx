"use client";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { useState, type FormEvent } from "react";
const client = createAuthClient();
export function SignIn() {
  const router = useRouter();
  const [error,setError]=useState(""); const [pending,setPending]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault();setPending(true);setError(""); const data=new FormData(event.currentTarget);
    try {const result=await client.signIn.email({email:String(data.get("email")),password:String(data.get("password"))});if(result.error)setError("Your email or password was not recognised.");else {router.push("/");router.refresh();}}catch{setError("Could not sign in. Please try again.");}finally{setPending(false);} }
  return <form onSubmit={submit} className="stack"><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error&&<p role="alert" className="error">{error}</p>}<button disabled={pending}>{pending?"Signing in…":"Sign in"}</button></form>;
}
export function SignOut() { const router = useRouter(); const [pending,setPending]=useState(false);return <button className="secondary" disabled={pending} onClick={async()=>{setPending(true);try{await client.signOut();router.push("/login");router.refresh();}catch{setPending(false);}}}>{pending?"Signing out…":"Sign out"}</button>; }

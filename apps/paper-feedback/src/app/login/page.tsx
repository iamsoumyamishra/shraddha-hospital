import { getStaff } from "@/lib/staff";
import { redirect } from "next/navigation";
import { SignIn } from "@/components/session-controls";
export const runtime="nodejs";
export default async function Login() {if(await getStaff())redirect("/");return <main id="main" className="login"><div className="eyebrow">Paper feedback imports</div><h1>Staff sign in</h1><p>Use your existing hospital staff account. A hospital administrator reviews each paper response before it is saved.</p><SignIn /></main>;}

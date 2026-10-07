import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { hospitalAdminIds } from "@hospital/identity/scope";
import { listPaperSurveys } from "@/modules/imports";
import { ImportWorkspace } from "@/components/import-workspace";
import { SignOut } from "@/components/session-controls";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export default async function Home() {
  const staff=await getStaff();if(!staff)redirect("/login");
  const webUrl=process.env.NEXT_PUBLIC_WEB_URL;const link=webUrl&&/^https?:\/\//.test(webUrl)?webUrl:undefined;
  return <main id="main" className="workspace"><div className="page-heading"><div><div className="eyebrow">Patient experience · Paper forms</div><h1>Review paper feedback</h1><p>Turn photographed forms into reviewed hospital responses.</p></div><div className="actions">{link&&<a className="button secondary" href={link}>Open hospital portal</a>}<SignOut /></div></div>{hospitalAdminIds(staff).length?<ImportWorkspace surveys={await listPaperSurveys(staff)} reviewer={staff.displayName}/>:<section className="panel"><h2>Administrator access required</h2><p>Your account is signed in, but it does not have hospital-wide administrator permission to import responses.</p></section>}</main>;
}

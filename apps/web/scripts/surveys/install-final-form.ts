import "dotenv/config";
import { prisma } from "@hospital/database/cli";
import { createFinalForm } from "../../src/modules/survey/create-final-form";
import { matchesFinalForm } from "@hospital/forms";
const hospitalSlug=process.argv.slice(2).find(value=>!value.startsWith("--"))?.trim() || process.env.PUBLIC_SURVEY_HOSPITAL_SLUG?.trim();
if(!hospitalSlug)throw Error("Specify one hospital slug: pnpm survey:install-final -- <hospital-slug>");
try {
  const result=await prisma.$transaction(async tx=>{
    const hospital=await tx.hospital.findUniqueOrThrow({where:{slug:hospitalSlug}});
    await tx.$queryRaw`SELECT id FROM hospitals WHERE id = ${hospital.id}::uuid FOR UPDATE`;
    const source=await tx.surveyVersion.findFirstOrThrow({where:{hospitalId:hospital.id,status:"PUBLISHED"},orderBy:{version:"desc"},include:{questions:{orderBy:{sortOrder:"asc"},include:{translations:{where:{locale:"en",status:"PUBLISHED"}}}}}});
    if(matchesFinalForm(source.questions.map(q=>({key:q.key,type:q.type,prompt:q.translations[0]?.prompt??""}))))return source;
    return createFinalForm(tx,{hospitalId:hospital.id,slug:source.slug});
  },{timeout:20000});
  console.log(`Final feedback form available as version ${result.version}. Historical versions retained.`);
}finally{await prisma.$disconnect();}

import { randomUUID } from "node:crypto";
import type { Prisma } from "@hospital/database/client";
import { FINAL_FORM_ID, FINAL_FORM_QUESTIONS, FINAL_RATING_LABELS } from "@hospital/forms";
import { POLICY_V1 } from "@hospital/scoring";

/** Caller must authorize scope and lock the hospital before allocating versions. */
export async function createFinalForm(tx: Prisma.TransactionClient, source: {hospitalId:string;slug:string}, reviewerStaffId?:string) {
  const latest = await tx.surveyVersion.aggregate({where:source,_max:{version:true}});
  const policyVersion = await tx.scoringPolicyVersion.aggregate({where:{hospitalId:source.hospitalId},_max:{version:true}});
  const policy = await tx.scoringPolicyVersion.create({data:{hospitalId:source.hospitalId,version:(policyVersion._max.version??0)+1,name:"SH-OMR-01 patient experience policy",rules:{...POLICY_V1,scale:{...POLICY_V1.scale,labels:FINAL_RATING_LABELS}}}});
  const categoryKeys = [...new Set(FINAL_FORM_QUESTIONS.filter(q=>q.type==="RATING").map(q=>q.categoryKey))];
  await tx.surveyVersion.updateMany({where:{...source,status:"DRAFT"},data:{status:"RETIRED"}});
  const survey = await tx.surveyVersion.create({data:{...source,version:(latest._max.version??0)+1,title:"Patient feedback form",description:"Share your experience of our hospital services.",visitTypes:["unspecified","outpatient","inpatient","diagnostic","pharmacy"],scoringPolicyVersionId:policy.id,patientPresentation:{formId:FINAL_FORM_ID,services:[{key:"hospital",label:"Hospital services"}],categoryLabels:Object.fromEntries(categoryKeys.map(key=>[key,key.replaceAll("_"," ")]))}}});
  for(const [index,key] of categoryKeys.entries()) {
    const category = await tx.category.create({data:{surveyVersionId:survey.id,key,weight:1,isCore:true,sortOrder:index}});
    for(const [order,q] of FINAL_FORM_QUESTIONS.entries()) if(q.categoryKey===key) {
      await tx.question.create({data:{id:randomUUID(),surveyVersionId:survey.id,categoryId:category.id,key:q.key,type:q.type,isRequired:q.type!=="TEXT",sortOrder:order,
        translations:{create:(["en","hi","mr"] as const).map(locale=>({locale,prompt:q[locale],status:locale==="en"?"PUBLISHED":"DRAFT",...(locale==="en"?{reviewedAt:new Date(),reviewedById:reviewerStaffId}: {})}))}}});
    }
  }
  const published = await tx.surveyVersion.update({where:{id:survey.id},data:{status:"PUBLISHED",publishedAt:new Date()}});
  await tx.auditLog.create({data:{hospitalId:source.hospitalId,actorStaffId:reviewerStaffId,action:"RESET_SURVEY_DEFAULTS",entityType:"SurveyVersion",entityId:survey.id,metadata:{formId:FINAL_FORM_ID,version:published.version}}});
  return published;
}

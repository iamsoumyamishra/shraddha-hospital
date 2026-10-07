import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@hospital/database";
import { POLICY_V1 } from "@hospital/scoring";
import { NotAuthorisedError, type StaffContext } from "@hospital/identity/scope";
import { listPaperSurveys, savePaperImport } from "../../src/modules/imports";
import { TEMPLATE_VERSION } from "../../src/modules/contracts";
afterAll(()=>prisma.$disconnect());
async function fixture() {
  const slug=`paper-test-${randomUUID()}`;const hospital=await prisma.hospital.create({data:{name:"Synthetic paper hospital",slug}});
  const user=await prisma.user.create({data:{name:"Synthetic reviewer",email:`${slug}@example.test`}});
  const reviewer=await prisma.staffUser.create({data:{authUserId:user.id,email:user.email,displayName:user.name}});
  const staff: StaffContext={staffUserId:reviewer.id,email:reviewer.email,displayName:reviewer.displayName,memberships:[{id:randomUUID(),hospitalId:hospital.id,role:"HOSPITAL_ADMIN",scopeType:"HOSPITAL",branchId:null,departmentId:null}]};
  const policy=await prisma.scoringPolicyVersion.create({data:{hospitalId:hospital.id,version:1,name:"Synthetic policy",rules:POLICY_V1}});
  const survey=await prisma.surveyVersion.create({data:{hospitalId:hospital.id,slug,version:1,status:"PUBLISHED",title:"Synthetic questionnaire",visitTypes:["outpatient"],patientPresentation:{services:[{key:"reception",label:"Reception"}]},scoringPolicyVersionId:policy.id}});
  for(let i=0;i<4;i++){const category=await prisma.category.create({data:{surveyVersionId:survey.id,key:`category-${i}`,sortOrder:i}});await prisma.question.create({data:{surveyVersionId:survey.id,categoryId:category.id,key:`question-${i}`,sortOrder:i,translations:{create:{locale:"en",status:"PUBLISHED",prompt:`Question ${i}`}}}});}
  const questions=await prisma.question.findMany({where:{surveyVersionId:survey.id},orderBy:{sortOrder:"asc"}});
  const payload={surveyVersionId:survey.id,templateVersion:TEMPLATE_VERSION,pageHashes:[randomUUID().replaceAll("-","").repeat(2)],idempotencyKey:randomUUID(),locale:"en",visitType:"outpatient",servicesUsed:["reception"],respondentRole:"PATIENT",overallRating:4,comment:"Synthetic paper comment",confirmed:true,answers:questions.map(q=>({questionId:q.id,rating:4,reviewed:true}))};
  return {staff,survey,payload};
}
describe("reviewed paper imports",()=>{
  it("saves one atomic response, scores and audit visible to the web database",async()=>{const {staff,survey,payload}=await fixture();expect(await savePaperImport(staff,payload)).toEqual({saved:true,replayed:false});const row=await prisma.feedbackSubmission.findFirstOrThrow({where:{surveyVersionId:survey.id},include:{paperImport:true,answers:true,categoryScores:true,followUpContact:true}});expect(Number(row.patientIndex)).toBe(75);expect(row.answers).toHaveLength(4);expect(row.categoryScores).toHaveLength(4);expect(row.paperImport?.reviewerStaffId).toBe(staff.staffUserId);expect(row.followUpContact).toBeNull();expect(await prisma.auditLog.count({where:{entityId:row.id,action:"PAPER_FEEDBACK_IMPORTED"}})).toBe(1);});
  it("atomically deduplicates concurrent imports of the same photo",async()=>{const {staff,survey,payload}=await fixture();const outcomes=await Promise.all([savePaperImport(staff,payload),savePaperImport(staff,{...payload,idempotencyKey:randomUUID()})]);expect(outcomes.filter(r=>r.replayed)).toHaveLength(1);expect(await prisma.feedbackSubmission.count({where:{surveyVersionId:survey.id}})).toBe(1);expect(await prisma.paperFeedbackImport.count({where:{hospitalId:staff.memberships[0]!.hospitalId}})).toBe(1);});
  it("denies cross-hospital, analyst and branch-only imports and survey reads",async()=>{const {staff,payload}=await fixture();const outsider={...staff,memberships:[{...staff.memberships[0]!,hospitalId:randomUUID()}]};await expect(savePaperImport(outsider,payload)).rejects.toBeInstanceOf(NotAuthorisedError);expect(await listPaperSurveys(outsider)).toEqual([]);for(const changes of [{role:"ANALYST" as const},{scopeType:"BRANCH" as const}]){const forbidden={...staff,memberships:[{...staff.memberships[0]!,...changes}]};await expect(savePaperImport(forbidden,payload)).rejects.toBeInstanceOf(NotAuthorisedError);await expect(listPaperSurveys(forbidden)).rejects.toBeInstanceOf(NotAuthorisedError);}});
  it("requires review, exact IDs, valid metadata and correct page count",async()=>{const {staff,survey,payload}=await fixture();for(const invalid of [{...payload,confirmed:false},{...payload,answers:payload.answers.map(a=>({...a,reviewed:false}))},{...payload,answers:payload.answers.slice(1)},{...payload,answers:[...payload.answers.slice(1),payload.answers[1]]},{...payload,answers:payload.answers.map(a=>({...a,questionId:randomUUID()}))},{...payload,servicesUsed:["invented"]},{...payload,visitType:"invented"},{...payload,pageHashes:[...payload.pageHashes,payload.pageHashes[0]]}])await expect(savePaperImport(staff,invalid)).rejects.toThrow();expect(await prisma.feedbackSubmission.count({where:{surveyVersionId:survey.id}})).toBe(0);});
  it("preserves explicit N/A as an incomplete response without an official index",async()=>{const {staff,survey,payload}=await fixture();await savePaperImport(staff,{...payload,answers:payload.answers.map(a=>({...a,rating:null}))});const row=await prisma.feedbackSubmission.findFirstOrThrow({where:{surveyVersionId:survey.id},include:{answers:true}});expect(row.status).toBe("INCOMPLETE");expect(row.patientIndex).toBeNull();expect(row.answers.every(a=>a.state==="NOT_APPLICABLE"&&a.value===null)).toBe(true);});
});

describe("SH-OMR-01 written feedback",()=>{
  async function finalFixture(){
    const {staff,survey}=await fixture();
    const {createFinalForm}=await import("../../../web/src/modules/survey/create-final-form");
    const final=await prisma.$transaction(tx=>createFinalForm(tx,{hospitalId:survey.hospitalId,slug:survey.slug},staff.staffUserId));
    const questions=await prisma.question.findMany({where:{surveyVersionId:final.id},orderBy:{sortOrder:"asc"}});
    const payload={surveyVersionId:final.id,templateVersion:"sh-omr-01-v1",pageHashes:[randomUUID().replaceAll("-","").repeat(2)],idempotencyKey:randomUUID(),locale:"hi",visitType:"unspecified",servicesUsed:["hospital"],respondentRole:"CAREGIVER",overallRating:5,comment:"Ignored unrelated field",confirmed:true,answers:questions.map(q=>({questionId:q.id,...(q.type==="TEXT"?{text:q.key==="feedback_comments"?"कृत्रिम अभिप्राय":q.key==="staff_dissatisfied"?"":"Synthetic nurse"}:{rating:q.type==="OVERALL"?5:3}),reviewed:true}))};
    return {staff,final,questions,payload};
  }
  it("stores Unicode text and blank written fields, excludes overall/text from scoring",async()=>{
    const {staff,final,payload}=await finalFixture();await savePaperImport(staff,payload);
    const row=await prisma.feedbackSubmission.findFirstOrThrow({where:{surveyVersionId:final.id},include:{answers:true,categoryScores:true}});
    expect(Number(row.patientIndex)).toBe(50);expect(row.overallRating).toBe(5);expect(row.comment).toBe("कृत्रिम अभिप्राय");expect(row.answers).toHaveLength(9);expect(row.categoryScores).toHaveLength(5);
    expect(row.answers.filter(a=>a.textValue!==null)).toHaveLength(2);expect(row.answers.filter(a=>a.state==="SKIPPED")).toHaveLength(1);
  });
  it("rejects numeric answers for written fields, fabricated N/A and patient details",async()=>{
    const {staff,payload,questions}=await finalFixture();const text=questions.find(q=>q.type==="TEXT")!,rating=questions.find(q=>q.type==="RATING")!;
    for(const invalid of [{...payload,patientName:"Synthetic patient"},{...payload,answers:payload.answers.map(a=>a.questionId===text.id?{questionId:a.questionId,rating:5,reviewed:true}:a)},{...payload,answers:payload.answers.map(a=>a.questionId===rating.id?{...a,rating:null}:a)},{...payload,overallRating:1}])await expect(savePaperImport(staff,invalid)).rejects.toThrow();
  });
});

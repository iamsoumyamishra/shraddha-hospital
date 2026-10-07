import { test, expect } from "@playwright/test";
import { templateRows, templateSvg, WIDTH, HEIGHT } from "../../src/modules/template";
import type { PaperSurvey } from "../../src/modules/contracts";

test("anonymous staff cannot access imports", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  const denied = await page.request.post("/api/imports", { data: {}, headers: { Origin: new URL(page.url()).origin } });
  expect(denied.status()).toBe(401);
});

test("administrator prints, aligns, reviews and saves a photographed form", async ({ page }) => {
  test.skip(process.env.PAPER_E2E_ISOLATED !== "1" || !process.env.SEED_STAFF_PASSWORD, "Requires an explicitly isolated synthetic test server");
  const { prisma } = await import("@hospital/database/cli");
  const row = await prisma.surveyVersion.findFirstOrThrow({ where: { version: 1, status: "PUBLISHED", hospital: { slug: "shraddha-hospital" } }, include: { hospital: true, questions: { orderBy: { sortOrder: "asc" }, include: { translations: { where: { locale: "en", status: "PUBLISHED" } } } } } });
  const survey: PaperSurvey = { id: row.id, version: row.version, title: row.title, hospital: row.hospital.name, visitTypes: row.visitTypes, services: [], ratingLabels: ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"], questions: row.questions.map(q => ({ id: q.id, prompt: q.translations[0]!.prompt })) };
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@shraddha.example");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review paper feedback" })).toBeVisible();
  await page.getByRole("combobox", { name: "Survey version", exact: true }).selectOption(row.id);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download printable PDF" }).click();
  expect((await download).suggestedFilename()).toContain("feedback-v1");
  const count = Math.ceil(survey.questions.length / 12);
  for (let i = 0; i < count; i++) {
    await page.getByRole("combobox", { name: "Page", exact: true }).selectOption(String(i));
    const rows = templateRows(survey, i);
    const photo = await page.evaluate(async ({ svg, rows, width, height, nonce }) => {
      const img = new Image();img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;await img.decode();
      const canvas = document.createElement("canvas");canvas.width = width;canvas.height = height;
      const ctx = canvas.getContext("2d")!;ctx.drawImage(img,0,0);ctx.strokeStyle = "#000";ctx.lineWidth = 4;
      for (const row of rows) { const box = row.boxes[3]!;ctx.beginPath();ctx.moveTo(box.x+12,box.y+18);ctx.lineTo(box.x+18,box.y+25);ctx.lineTo(box.x+32,box.y+8);ctx.stroke(); }
      ctx.font = "10px Arial";ctx.fillText(nonce,60,1310);
      return canvas.toDataURL("image/png").split(",")[1]!;
    }, { svg: templateSvg(survey,i), rows, width: WIDTH, height: HEIGHT, nonce: `Synthetic ${test.info().project.name} ${Date.now()} ${i}` });
    await page.getByLabel(`Upload page ${i+1}`).setInputFiles({name:`synthetic-${i}.png`,mimeType:"image/png",buffer:Buffer.from(photo,"base64")});
    await expect(page.locator(".photo")).toBeVisible();
    await expect(page.getByText("Opening photograph…", { exact: true })).toHaveCount(0);
    const bounds = (await page.locator(".photo").boundingBox())!;
    for (const [x,y] of [[40,40],[960,40],[960,1374],[40,1374]]) await page.locator(".photo").dispatchEvent("pointerdown", { clientX: bounds.x+x!/WIDTH*bounds.width, clientY: bounds.y+y!/HEIGHT*bounds.height });
    await page.getByRole("button", { name: "Align & find marks" }).click();
    await expect(page.locator(".field-crop")).toHaveCount(rows.filter(r=>r.id!=="overall").length);
    for(const answer of await page.locator(".answer").all()) {
      await expect(answer.getByRole("combobox", { name: "Selected answer", exact: true })).toHaveValue("4");
      await answer.getByLabel("Reviewed", { exact: true }).check();
    }
  }
  await page.getByRole("combobox", { name: "Visit type", exact: true }).selectOption(survey.visitTypes[0]!);
  await page.getByRole("combobox", { name: "Completed by", exact: true }).selectOption("PATIENT");
  await page.locator(".services input").first().check();
  await expect(page.getByRole("combobox", { name: "Overall experience", exact: true })).toHaveValue("4");
  const comment = `Synthetic reviewed paper response ${Date.now()}`;
  await page.getByLabel("Optional comment", { exact: true }).fill(comment);
  await expect(page.getByRole("button", {name:"Save to hospital records"})).toBeDisabled();
  await page.getByLabel("I checked the survey version", { exact: false }).check();
  await page.getByRole("button", {name:"Save to hospital records"}).click();
  await expect(page.getByRole("heading", {name:"Import complete"})).toBeVisible();
  const saved = await prisma.feedbackSubmission.findFirstOrThrow({where:{comment},include:{paperImport:true,answers:true}});
  expect(saved.paperImport).not.toBeNull();expect(saved.answers).toHaveLength(survey.questions.length);expect(Number(saved.patientIndex)).toBe(75);
  if (process.env.WEB_E2E_BASE_URL) {
    await page.goto(`${process.env.WEB_E2E_BASE_URL}/en/login`);
    await page.getByLabel("Email", {exact:true}).fill("admin@shraddha.example");
    await page.getByLabel("Password", {exact:true}).fill(process.env.SEED_STAFF_PASSWORD!);
    await page.getByRole("button", {name:"Sign in",exact:true}).click();
    await page.waitForURL(/\/en\/dashboard/);
    await page.goto(`${process.env.WEB_E2E_BASE_URL}/en/dashboard/responses/${saved.id}`);
    await expect(page.getByText("Paper import",{exact:true})).toBeVisible();
    await expect(page.getByText(comment,{exact:true})).toBeVisible();
  }
  await prisma.$disconnect();
});

test("final sheet imports circled ratings and written feedback without patient identifiers",async({page})=>{
  test.skip(process.env.PAPER_E2E_ISOLATED!=="1"||!process.env.SEED_STAFF_PASSWORD,"Isolated synthetic test server required");
  const {prisma}=await import("@hospital/database/cli");
  const row=await prisma.surveyVersion.findFirstOrThrow({where:{status:"PUBLISHED",hospital:{slug:"shraddha-hospital"},patientPresentation:{path:["formId"],equals:"SH-OMR-01"}},orderBy:{version:"desc"},include:{questions:{orderBy:{sortOrder:"asc"}}}});
  await page.goto("/login");await page.getByLabel("Email",{exact:true}).fill("admin@shraddha.example");await page.getByLabel("Password",{exact:true}).fill(process.env.SEED_STAFF_PASSWORD!);await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Review paper feedback"})).toBeVisible();await page.getByRole("combobox",{name:"Survey version",exact:true}).selectOption(row.id);
  const photo=await page.evaluate(async(nonce)=>{const image=new Image();image.src="/forms/sh-omr-01.png";await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d")!;ctx.drawImage(image,0,0);ctx.strokeStyle="#171717";ctx.lineWidth=4;
    for(const [i,y] of [599,657,716,780,843,909].entries()){const x=i===5?1033:941;ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x-2,y+7);ctx.lineTo(x+10,y-10);ctx.stroke();}
    ctx.font="22px Arial";ctx.fillStyle="#111";ctx.fillText("SYNTHETIC PRIVATE NAME",45,303);ctx.fillText("Synthetic nurse A",46,1070);ctx.fillText("Synthetic desk B",570,1070);ctx.fillText(nonce,45,1235);return canvas.toDataURL("image/png").split(",")[1]!;
  },`Synthetic written feedback ${Date.now()}`);
  await page.getByLabel("Upload page 1").setInputFiles({name:"synthetic-final.png",mimeType:"image/png",buffer:Buffer.from(photo,"base64")});
  await expect(page.getByRole("button",{name:"Align & find marks"})).toBeEnabled();await page.getByRole("button",{name:"Align & find marks"}).click();
  await expect(page.locator(".field-crop")).toHaveCount(9);
  const choices=page.getByRole("combobox",{name:"Selected answer",exact:true});await expect(choices).toHaveCount(6);
  for(let i=0;i<6;i++)await expect(choices.nth(i)).toHaveValue(i===5?"5":"4");
  await expect(page.getByRole("button",{name:"Save to hospital records"})).toBeDisabled();
  if(process.env.PAPER_OCR_SMOKE==="1" && test.info().project.name==="chromium") {
    await page.locator(".answer").nth(8).getByRole("button",{name:"Read this field with OCR"}).click();
    await expect(page.getByRole("textbox",{name:"OCR draft",exact:true})).toBeVisible({timeout:45000});
    await expect(page.getByRole("textbox",{name:"OCR draft",exact:true})).toHaveValue(/Synthetic/i);
    // OCR remains a draft; it must never fill the approved answer automatically.
    await expect(page.getByLabel("Written answer 9",{exact:true})).toHaveValue("");
  }
  await page.getByLabel("Written answer 7",{exact:true}).fill("Synthetic nurse A");await page.getByLabel("Written answer 8",{exact:true}).fill("Synthetic desk B");
  const comment=`Synthetic checked comment ${Date.now()}`;await page.getByLabel("Written answer 9",{exact:true}).fill(comment);
  for(const checkbox of await page.getByLabel("Reviewed",{exact:true}).all())await checkbox.check();
  // Editing one written field invalidates its review without touching another field.
  await page.getByLabel("Written answer 8",{exact:true}).fill("Synthetic revised desk B");await expect(page.getByLabel("Reviewed",{exact:true}).nth(7)).not.toBeChecked();await expect(page.getByLabel("Reviewed",{exact:true}).nth(6)).toBeChecked();await page.getByLabel("Reviewed",{exact:true}).nth(7).check();
  await page.getByRole("combobox",{name:"Completed by",exact:true}).selectOption("PATIENT");await page.getByLabel("I checked the survey version",{exact:false}).check();
  const submitted=page.waitForRequest(request=>request.url().endsWith("/api/imports")&&request.method()==="POST");await page.getByRole("button",{name:"Save to hospital records"}).click();
  const payload=(await submitted).postDataJSON();expect(JSON.stringify(payload)).not.toContain("SYNTHETIC PRIVATE NAME");expect(payload.patientName).toBeUndefined();expect(payload.answers.filter((a:{text?:string})=>a.text!==undefined)).toHaveLength(3);
  await expect(page.getByRole("heading",{name:"Import complete"})).toBeVisible();
  const saved=await prisma.feedbackSubmission.findFirstOrThrow({where:{comment},include:{answers:true}});expect(Number(saved.patientIndex)).toBe(75);expect(saved.overallRating).toBe(5);expect(saved.answers.filter(a=>a.textValue!==null)).toHaveLength(3);expect(saved.visitType).toBe("unspecified");
  await prisma.$disconnect();
});

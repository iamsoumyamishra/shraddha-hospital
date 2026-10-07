"use client";
/* eslint-disable @next/next/no-img-element -- volatile local photo and canvas previews */
import { useRef, useState, type PointerEvent } from "react";
import { FINAL_TEMPLATE_VERSION, TEMPLATE_VERSION, type PaperSurvey } from "@/modules/contracts";
import { COMMENT_REGION, templateRows, type Rect } from "@/modules/template";
import { finalRows, isFinalForm, LANGUAGE_BOXES, paperPages, TEXT_REGIONS } from "@/modules/final-layout";
import { detectMarks, findSquareMarkers, printedInkAgreement, type Point } from "@/modules/marks";
import { alignPhoto, downloadFile, fieldCrop, prepareWrittenCrop, referenceCanvas } from "@/modules/images";

type ReviewedAnswer = { value:string; text:string; reviewed:boolean; note:string };
type Photo = {source:HTMLCanvasElement;hash:string;preview:string;corners:Point[];aligned?:HTMLCanvasElement;reference?:HTMLCanvasElement};
type OcrDraft = {text:string;confidence:number};
const cornerNames=["top-left (TL)","top-right (TR)","bottom-right (BR)","bottom-left (BL)"];
const emptyAnswer=():ReviewedAnswer=>({value:"",text:"",reviewed:false,note:"Review against the photograph."});

export function ImportWorkspace({surveys,reviewer}:{surveys:PaperSurvey[];reviewer:string}) {
  const [surveyId,setSurveyId]=useState(surveys[0]?.id??"");
  const survey=surveys.find(item=>item.id===surveyId);
  const [page,setPage]=useState(0);
  const [photos,setPhotos]=useState<Record<number,Photo>>({});
  const [answers,setAnswers]=useState<Record<string,ReviewedAnswer>>({});
  const [overall,setOverall]=useState("");
  const [comment,setComment]=useState("");
  const [ocrDrafts,setOcrDrafts]=useState<Record<string,OcrDraft>>({});
  const [services,setServices]=useState<string[]>([]);
  const [visitType,setVisitType]=useState("");
  const [role,setRole]=useState("");
  const [locale,setLocale]=useState("en");
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<string|null>(null);
  const key=useRef<string|null>(null);
  if(!survey)return <section className="panel"><h2>No compatible paper questionnaire</h2><p>Use Reset defaults on the hospital Questions page to publish the final SH-OMR-01 questionnaire. Historical rating-only templates remain available.</p></section>;
  const finalForm=isFinalForm(survey),pageCount=paperPages(survey),photo=photos[page];
  const rows=finalForm?finalRows(survey):templateRows(survey,page);
  const questions=finalForm?survey.questions:survey.questions.filter(q=>rows.some(row=>row.id===q.id));
  const reviewed=survey.questions.filter(q=>answers[q.id]?.reviewed&&(q.type==="TEXT"||answers[q.id]!.value!=="")).length;
  const overallValue=finalForm?answers[survey.questions.find(q=>q.type==="OVERALL")!.id]?.value??"":overall;
  const ready=reviewed===survey.questions.length&&Array.from({length:pageCount},(_,i)=>photos[i]?.aligned).every(Boolean)&&role&&overallValue&&confirmed&&(finalForm||(services.length>0&&visitType));

  function reset(id=surveyId){setSurveyId(id);setPage(0);setPhotos({});setAnswers({});setOverall("");setComment("");setOcrDrafts({});setServices([]);setVisitType("");setRole("");setLocale("en");setConfirmed(false);setError("");setSaved(null);key.current=null;}
  function updateAnswer(id:string,changes:Partial<ReviewedAnswer>){setAnswers(previous=>({...previous,[id]:{...emptyAnswer(),...previous[id],...changes}}));setConfirmed(false);}
  function clearPageReviews(){setAnswers(previous=>{const next={...previous};for(const q of questions)delete next[q.id];return next;});setOcrDrafts({});if(page===pageCount-1){setOverall("");setComment("");}setConfirmed(false);}
  function changeCorners(corners:Point[]){if(!photo)return;setPhotos(previous=>({...previous,[page]:{...photo,corners,aligned:undefined,reference:undefined}}));clearPageReviews();}
  async function printable(){setBusy("Preparing printable form…");setError("");try{const {jsPDF}=await import("jspdf");const pdf=new jsPDF({unit:"mm",format:"a4"});for(let i=0;i<pageCount;i++){if(i)pdf.addPage();const canvas=await referenceCanvas(survey!,i);pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,210,297);}downloadFile(pdf.output("blob"),`feedback-v${survey!.version}-${survey!.id}.pdf`);}catch{setError("Could not prepare the printable form.");}finally{setBusy("");}}
  async function upload(file:File){
    setError("");if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024){setError("Choose a JPEG, PNG or WebP image up to 10 MB.");return;}
    setBusy("Opening photograph…");const url=URL.createObjectURL(file);
    try{const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>40000000)throw Error("Image too large");
      const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight)),source=document.createElement("canvas");source.width=Math.round(image.naturalWidth*scale);source.height=Math.round(image.naturalHeight*scale);source.getContext("2d")!.drawImage(image,0,0,source.width,source.height);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),byte=>byte.toString(16).padStart(2,"0")).join("");
      const corners=finalForm?findSquareMarkers(source.getContext("2d")!.getImageData(0,0,source.width,source.height)):[];
      setPhotos(previous=>({...previous,[page]:{source,hash,preview:source.toDataURL("image/jpeg",.9),corners}}));clearPageReviews();key.current=null;
    }catch{setError("Could not read the photo. Use a clear, smaller image.");}finally{URL.revokeObjectURL(url);setBusy("");}
  }
  function selectCorner(event:PointerEvent<HTMLDivElement>){if(!photo||photo.corners.length===4||busy)return;const bounds=event.currentTarget.getBoundingClientRect();changeCorners([...photo.corners,{x:(event.clientX-bounds.left)/bounds.width*photo.source.width,y:(event.clientY-bounds.top)/bounds.height*photo.source.height}]);}
  async function analyse(){if(!photo)return;setBusy("Aligning form and reading marks…");setError("");try{
    const blank=await referenceCanvas(survey!,page),aligned=alignPhoto(photo.source,photo.corners,finalForm),reference=blank.getContext("2d")!.getImageData(0,0,blank.width,blank.height),filled=aligned.getContext("2d")!.getImageData(0,0,aligned.width,aligned.height);
    if(printedInkAgreement(reference,filled,rows.flatMap(row=>row.boxes))<.55)throw Error("The printed circles or boxes do not align. Check the form and four marker centres, then retry.");
    const next:Record<string,ReviewedAnswer>={};
    for(const row of rows){const detection=detectMarks(reference,filled,row.boxes);const value=detection.selected===null?"":detection.selected===5?"na":String(detection.selected+1);
      next[row.id]={...emptyAnswer(),value,note:({suggested:"Suggested mark · review required",blank:"No mark found · check the paper",ambiguous:"Multiple or unclear marks · check the paper",faint:"Faint mark · choose manually"})[detection.state]};if(row.id==="overall")setOverall(value);
    }
    for(const q of questions.filter(q=>q.type==="TEXT"))next[q.id]=emptyAnswer();
    if(finalForm){const language=detectMarks(reference,filled,LANGUAGE_BOXES);if(language.selected!==null)setLocale(["en","hi","mr"][language.selected]!);}
    setAnswers(previous=>({...previous,...next}));setPhotos(previous=>({...previous,[page]:{...photo,aligned,reference:blank}}));setOcrDrafts({});setConfirmed(false);
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not align this form.");}finally{setBusy("");}}
  async function extractWritten(id:string,rect:Rect){const last=photos[finalForm?0:pageCount-1];if(!last?.aligned||!last.reference)return;setBusy("Reading this written field…");setError("");try{
    const crop=prepareWrittenCrop(last.aligned,last.reference,rect),{createWorker,PSM}=await import("tesseract.js");
    const worker=await createWorker(({en:"eng",hi:"hin",mr:"mar"} as const)[locale as "en"|"hi"|"mr"]);
    try{await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:"1"});const result=await worker.recognize(crop);setOcrDrafts(previous=>({...previous,[id]:{text:result.data.text.trim().slice(0,2000),confidence:result.data.confidence}}));}finally{await worker.terminate();}
  }catch{setError("Could not read this field. Transcribe it from the crop instead.");}finally{setBusy("");}}
  async function save(){if(!ready)return;setBusy("Saving reviewed response…");setError("");key.current??=crypto.randomUUID();try{
    const response=await fetch("/api/imports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({surveyVersionId:survey!.id,templateVersion:finalForm?FINAL_TEMPLATE_VERSION:TEMPLATE_VERSION,pageHashes:Array.from({length:pageCount},(_,i)=>photos[i]!.hash),idempotencyKey:key.current,locale,visitType:finalForm?"unspecified":visitType,servicesUsed:finalForm?["hospital"]:services,respondentRole:role,overallRating:Number(overallValue),comment:finalForm?"":comment,confirmed:true,answers:survey!.questions.map(q=>({questionId:q.id,...(q.type==="TEXT"?{text:answers[q.id]!.text}:{rating:answers[q.id]!.value==="na"?null:Number(answers[q.id]!.value)}),reviewed:answers[q.id]!.reviewed}))})});
    const result=await response.json();if(!response.ok)throw Error(result.error??"Could not save.");setSaved(result.replayed?"These photos were already imported. No second response was created.":"Reviewed response saved. It is now available in the hospital dashboard.");setPhotos({});setAnswers({});setComment("");setOcrDrafts({});
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not save. Retry with the same photos.");}finally{setBusy("");}}
  function cropPreview(rect:Rect,label:string){return photo?.aligned?<img className="field-crop" src={fieldCrop(photo.aligned,rect).toDataURL("image/png")} alt={label}/>:null;}
  function ocrReview(id:string,onUse:(text:string)=>void){const draft=ocrDrafts[id];if(!draft)return null;return <div className="ocr"><p className="hint">OCR draft · engine confidence {Math.round(draft.confidence)}%. This is not a guarantee of correctness. Check every word.</p><label>OCR draft<textarea value={draft.text} maxLength={2000} disabled={Boolean(busy)} onChange={event=>setOcrDrafts(previous=>({...previous,[id]:{...draft,text:event.target.value}}))}/></label><button className="secondary" disabled={Boolean(busy)} onClick={()=>onUse(draft.text)}>Use checked text</button></div>;}
  if(saved)return <section className="panel success" role="status"><h2>Import complete</h2><p>{saved}</p><button onClick={()=>reset()}>Import another form</button></section>;
  return <>
    <section className="panel intro"><div><span className="eyebrow">1 · Choose the paper form</span><h2>Published questionnaire</h2><p>{finalForm?"SH-OMR-01 · Your final multilingual sheet, with six rating rows and three written responses.":"Use the survey version printed on the form."} Photos stay on this device; only reviewed feedback answers are saved.</p></div><label>Survey version<select aria-label="Survey version" value={surveyId} disabled={Boolean(busy)} onChange={event=>reset(event.target.value)}>{surveys.map(s=><option key={s.id} value={s.id}>{s.hospital} · {s.title} · v{s.version}{isFinalForm(s)?" · SH-OMR-01":""}</option>)}</select></label><button className="secondary" disabled={Boolean(busy)} onClick={()=>void printable()}>Download printable PDF</button></section>
    <div className="import-grid"><section className="panel photo-panel"><div className="section-heading"><div><span className="eyebrow">2 · Photograph & align</span><h2>Paper form</h2></div><span className="badge">Page {page+1} of {pageCount}</span></div>
      <label>Page<select aria-label="Page" value={page} disabled={Boolean(busy)} onChange={event=>{setPage(Number(event.target.value));setError("");}}>{Array.from({length:pageCount},(_,i)=><option key={i} value={i}>Page {i+1}{photos[i]?.aligned?" · aligned":""}</option>)}</select></label>
      <label className="upload">Upload page {page+1}<input key={`${surveyId}-${page}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);}}/></label>
      {photo?<><p className="hint">{photo.corners.length<4?`Select the centre of the ${cornerNames[photo.corners.length]} printed marker.`:"Check the four marker centres, then align and find marks. Automatic corners are suggestions."}</p><div className="photo" onPointerDown={selectCorner} role="img" aria-label="Photographed form"><img src={photo.preview} alt="Photographed paper feedback" draggable={false}/>{photo.corners.map((point,i)=><span className="corner" key={i} style={{left:`${point.x/photo.source.width*100}%`,top:`${point.y/photo.source.height*100}%`}}>{i+1}</span>)}</div>
        <div className="actions"><button disabled={Boolean(busy)||photo.corners.length!==4} onClick={()=>void analyse()}>Align & find marks</button><button className="secondary" disabled={Boolean(busy)} onClick={()=>changeCorners([])}>Reset corners</button></div>
        <details><summary>Enter corner positions with the keyboard</summary><div className="corner-inputs">{[0,1,2,3].map(i=><fieldset key={i}><legend>{cornerNames[i]}</legend>{(["x","y"] as const).map(axis=><label key={axis}>{axis.toUpperCase()} (%)<input type="number" min="0" max="100" step="0.1" disabled={Boolean(busy)} value={photo.corners[i]?Number((photo.corners[i]![axis]/(axis==="x"?photo.source.width:photo.source.height)*100).toFixed(1)):""} onChange={event=>{const points=[...photo.corners];while(points.length<4)points.push({x:0,y:0});points[i]={...points[i]!,[axis]:Number(event.target.value)/100*(axis==="x"?photo.source.width:photo.source.height)};changeCorners(points);}}/></label>)}</fieldset>)}</div></details>
      </>:<div className="empty"><strong>Photograph the exact printed sheet</strong><p>Include all four markers. Keep the page flat and use even lighting.</p></div>}
    </section>
    <section className="panel review-panel"><div className="section-heading"><div><span className="eyebrow">3 · Review feedback answers</span><h2>Detected responses</h2></div><span className="badge">{reviewed}/{survey.questions.length} reviewed</span></div><p className="hint">Check every crop. OCR is an editable draft; handwriting often needs manual transcription. Patient-details and signature fields are not extracted or saved.</p>
      {questions.map(q=>{const answer=answers[q.id]??emptyAnswer(),textField=q.type==="TEXT",row=rows.find(r=>r.id===q.id),rect=textField?TEXT_REGIONS[q.key!]:row?{x:row.boxes[0]!.x-3,y:row.boxes[0]!.y-3,width:row.boxes.at(-1)!.x+row.boxes.at(-1)!.width-row.boxes[0]!.x+6,height:row.boxes[0]!.height+6}:undefined;
        return <div key={q.id} className={`answer ${answer.reviewed?"reviewed":""}`}><strong>{survey.questions.findIndex(item=>item.id===q.id)+1}. {q.prompt}</strong>{rect&&cropPreview(rect,`Original response for ${q.prompt}`)}
          {textField?<><label>Written answer<textarea aria-label={`Written answer ${survey.questions.findIndex(item=>item.id===q.id)+1}`} rows={3} maxLength={2000} value={answer.text} disabled={Boolean(busy)} onChange={event=>updateAnswer(q.id,{text:event.target.value,reviewed:false})}/></label><p className="hint">Leave empty only if the paper is blank, then mark Reviewed. Unreadable writing needs verification; do not invent text.</p><button className="secondary" disabled={Boolean(busy)||!photo?.aligned} onClick={()=>void extractWritten(q.id,rect!)}>Read this field with OCR</button>{ocrReview(q.id,text=>updateAnswer(q.id,{text,reviewed:false}))}</>:<label>Selected answer<select aria-label="Selected answer" disabled={Boolean(busy)} value={answer.value} onChange={event=>updateAnswer(q.id,{value:event.target.value,reviewed:false,note:"Edited manually"})}><option value="">Unresolved</option>{survey.ratingLabels.map((label,i)=><option key={i} value={i+1}>{label}</option>)}{!finalForm&&<option value="na">Explicit N/A mark</option>}</select></label>}
          <label className="check"><input type="checkbox" checked={answer.reviewed} disabled={Boolean(busy)||!photo?.aligned||(!textField&&!answer.value)} onChange={event=>updateAnswer(q.id,{reviewed:event.target.checked})}/>Reviewed</label><p className="hint">{answer.note}</p>
        </div>;
      })}
    </section></div>
    <section className="panel"><span className="eyebrow">4 · Verify response details</span><h2>Response details</h2><div className="details-grid"><label>Completed by<select aria-label="Completed by" value={role} disabled={Boolean(busy)} onChange={event=>{setRole(event.target.value);setConfirmed(false);}}><option value="">Select from verified context</option><option value="PATIENT">Patient</option><option value="CAREGIVER">Caregiver</option></select></label><label>Original response language<select aria-label="Original response language" value={locale} disabled={Boolean(busy)} onChange={event=>{setLocale(event.target.value);setConfirmed(false);}}><option value="en">English</option><option value="hi">Hindi</option><option value="mr">Marathi</option></select></label>
      {!finalForm&&<><label>Visit type<select aria-label="Visit type" value={visitType} disabled={Boolean(busy)} onChange={event=>{setVisitType(event.target.value);setConfirmed(false);}}><option value="">Select visit type</option>{survey.visitTypes.map(type=><option key={type}>{type}</option>)}</select></label><label>Overall experience<select aria-label="Overall experience" value={overall} disabled={Boolean(busy)} onChange={event=>{setOverall(event.target.value);setConfirmed(false);}}><option value="">Unresolved</option>{survey.ratingLabels.map((label,i)=><option key={i} value={i+1}>{label}</option>)}</select></label></>}
    </div>{finalForm?<p className="hint">Question 6 supplies the overall rating. Visit type is recorded as unspecified because this sheet does not ask it. Scores use only questions 1–5.</p>:<><fieldset className="services"><legend>Services used</legend>{survey.services.map(service=><label className="check" key={service.key}><input type="checkbox" checked={services.includes(service.key)} disabled={Boolean(busy)} onChange={event=>{setServices(previous=>event.target.checked?[...previous,service.key]:previous.filter(key=>key!==service.key));setConfirmed(false);}}/>{service.label}</label>)}</fieldset><label>Optional comment<textarea maxLength={2000} rows={4} value={comment} disabled={Boolean(busy)} onChange={event=>{setComment(event.target.value);setConfirmed(false);}}/></label><button className="secondary" disabled={Boolean(busy)||!photos[pageCount-1]?.aligned} onClick={()=>void extractWritten("legacy-comment",COMMENT_REGION)}>Read comments with OCR</button>{ocrReview("legacy-comment",text=>{setComment(text);setConfirmed(false);})}</>}
    </section>
    <section className="panel save-panel"><div><h2>Save reviewed feedback</h2><p>Reviewed by {reviewer}. Only checked feedback answers are saved; raw photos and patient identifiers stay out of the database.</p><label className="check"><input type="checkbox" disabled={Boolean(busy)} checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I checked the survey version, all page photos, every answer, overall rating and response details against the paper.</label></div><button disabled={Boolean(busy)||!ready} onClick={()=>void save()}>Save to hospital records</button></section>
    {busy&&<p role="status" className="notice">{busy}</p>}{error&&<p role="alert" className="notice error">{error}</p>}
  </>;
}

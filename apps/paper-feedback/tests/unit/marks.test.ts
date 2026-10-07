import { describe, expect, it } from "vitest";
import { detectMarks, projectiveMap, type Pixels } from "../../src/modules/marks";
import { templateRows, templateSvg } from "../../src/modules/template";
import type { PaperSurvey } from "../../src/modules/contracts";
function image(): Pixels { return { width: 160, height: 80, data: new Uint8ClampedArray(160*80*4).fill(255) }; }
function stroke(pixels: Pixels, x: number, y: number, width=4, height=12) { for(let row=y;row<y+height;row++)for(let column=x;column<x+width;column++){const offset=(row*pixels.width+column)*4;pixels.data[offset]=pixels.data[offset+1]=pixels.data[offset+2]=0;} }
const boxes=[{x:10,y:10,width:40,height:40},{x:65,y:10,width:40,height:40}];
describe("paper marks",()=>{
  it("detects an irregular connected mark without requiring a tick glyph",()=>{const blank=image(),filled=image();stroke(filled,23,24);stroke(filled,27,20);expect(detectMarks(blank,filled,boxes)).toMatchObject({selected:0,state:"suggested"});});
  it("excludes printed ink and small alignment differences",()=>{const blank=image(),filled=image();stroke(blank,18,18);stroke(filled,20,18);expect(detectMarks(blank,filled,boxes)).toMatchObject({selected:null,state:"blank"});});
  it("does not guess between two marked answers",()=>{const blank=image(),filled=image();stroke(filled,23,24);stroke(filled,78,24);expect(detectMarks(blank,filled,boxes)).toMatchObject({selected:null,state:"ambiguous"});});
  it("keeps a faint or tiny mark unresolved",()=>{const blank=image(),filled=image();stroke(filled,23,24,2,4);expect(detectMarks(blank,filled,boxes)).toMatchObject({selected:null,state:"faint"});});
  it("does not overlook a weaker second mark",()=>{const blank=image(),filled=image();stroke(filled,23,24,4,15);stroke(filled,78,24,2,8);expect(detectMarks(blank,filled,boxes)).toMatchObject({selected:null,state:"ambiguous"});});
  it("rejects mismatched images and out-of-page regions",()=>{expect(()=>detectMarks(image(),{...image(),width:1},boxes)).toThrow();expect(()=>detectMarks(image(),image(),[{x:0,y:0,width:40,height:40}])).toThrow();});
  it("maps perspective-distorted corners accurately",()=>{const points=[{x:20,y:15},{x:150,y:30},{x:140,y:180},{x:10,y:160}];const map=projectiveMap(points);for(const [index,position] of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]] as const){const p=map(position[0],position[1]);expect(p.x).toBeCloseTo(points[index]!.x);expect(p.y).toBeCloseTo(points[index]!.y);}});
  it("rejects crossed, reversed and degenerate corner selections",()=>{expect(()=>projectiveMap([{x:0,y:0},{x:100,y:100},{x:100,y:0},{x:0,y:100}])).toThrow();expect(()=>projectiveMap(Array(4).fill({x:0,y:0}))).toThrow();});
});
describe("published paper template",()=>{
  const survey: PaperSurvey={id:"synthetic-version",version:1,title:"Feedback <script>",hospital:"Hospital & Clinic",visitTypes:["outpatient"],services:[],ratingLabels:["Very dissatisfied","Dissatisfied","Neutral","Satisfied","Very satisfied"],questions:Array.from({length:15},(_,i)=>({id:String(i),prompt:`Question ${i+1}`}))};
  it("paginates stable question IDs and places overall on the last page only",()=>{expect(templateRows(survey,0).map(row=>row.id)).toEqual(Array.from({length:12},(_,i)=>String(i)));expect(templateRows(survey,1).map(row=>row.id)).toEqual(["12","13","14","overall"]);expect(()=>templateRows(survey,2)).toThrow();});
  it("escapes printed text and labels the version and page",()=>{const svg=templateSvg(survey,0);expect(svg).toContain("Feedback &lt;script&gt;");expect(svg).toContain("Hospital &amp; Clinic");expect(svg).toContain("Page 1/2");expect(svg).not.toContain("<script>");});
});

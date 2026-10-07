import type { Rect } from "./template";
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };
export type Point = { x: number; y: number };
export type MarkResult = { selected: number | null; state: "suggested" | "blank" | "ambiguous" | "faint"; counts: number[] };

/** Compare extra ink, not the shape of a perfect tick. Remove printed ink plus a 2px margin. */
export function detectMarks(blank: Pixels, filled: Pixels, boxes: Rect[]): MarkResult {
  if (blank.width !== filled.width || blank.height !== filled.height || blank.data.length !== blank.width*blank.height*4 || filled.data.length !== filled.width*filled.height*4) throw new Error("Aligned images must have matching dimensions");
  const gray = (image: Pixels, x: number, y: number) => { const i=(y*image.width+x)*4; return (image.data[i]!+image.data[i+1]!+image.data[i+2]!)/3; };
  const counts = boxes.map(box => {
    if (box.x < 2 || box.y < 2 || box.x+box.width+2 >= blank.width || box.y+box.height+2 >= blank.height) throw new Error("Answer region outside page");
    let count=0;
    for(let y=box.y;y<box.y+box.height;y++) for(let x=box.x;x<box.x+box.width;x++) {
      if(gray(filled,x,y)>145) continue;
      let printed=false;
      for(let dy=-2;dy<=2&&!printed;dy++) for(let dx=-2;dx<=2;dx++) if(gray(blank,x+dx,y+dy)<210) { printed=true;break; }
      if(!printed) count++;
    }
    return count;
  });
  const marked=counts.map((count,index)=>({count,index})).filter(item=>item.count>=Math.max(24,boxes[item.index]!.width*boxes[item.index]!.height*0.02));
  if(marked.length>1) return { selected:null,state:"ambiguous",counts };
  if(marked.length===1) {
    const chosen=marked[0]!;
    if(counts.some((count,index)=>index!==chosen.index && count>Math.max(8,chosen.count*0.2))) return {selected:null,state:"ambiguous",counts};
    return {selected:chosen.index,state:"suggested",counts};
  }
  return { selected:null,state:counts.some(count=>count>=6)?"faint":"blank",counts };
}

/** Project a unit rectangle into the selected photo quadrilateral. */
export function projectiveMap(points: Point[]) {
  if(points.length!==4 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) throw new Error("Select four corners");
  const [p0,p1,p2,p3]=points as [Point,Point,Point,Point];
  const area=points.reduce((sum,p,i)=>{const next=points[(i+1)%4]!;return sum+p.x*next.y-next.x*p.y;},0)/2;
  if(area<100) throw new Error("Select the corners clockwise: TL, TR, BR, BL");
  for(let i=0;i<4;i++) {const a=points[i]!,b=points[(i+1)%4]!,c=points[(i+2)%4]!; if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<=0)throw new Error("Corners must outline the page without crossing");}
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
  const determinant=dx1*dy2-dx2*dy1;
  if(Math.abs(determinant)<1e-8) throw new Error("Corners are too close together");
  const g=(dx3*dy2-dx2*dy3)/determinant,h=(dx1*dy3-dx3*dy1)/determinant;
  const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y;
  return (u:number,v:number):Point=>{const den=g*u+h*v+1;if(Math.abs(den)<1e-8)throw new Error("Invalid page perspective");return {x:(a*u+b*v+p0.x)/den,y:(d*u+e*v+p0.y)/den};};
}

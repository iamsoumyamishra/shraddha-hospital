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
    let background=0;
    for(let y=box.y;y<box.y+box.height;y++)for(let x=box.x;x<box.x+box.width;x++)background+=gray(filled,x,y);
    const threshold=Math.max(80,Math.min(190,background/(box.width*box.height)-45));
    let count=0;
    for(let y=box.y;y<box.y+box.height;y++) for(let x=box.x;x<box.x+box.width;x++) {
      if(gray(filled,x,y)>threshold) continue;
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

/** Solve a homography between arbitrary printed marker centres and photo centres. */
export function mapBetweenQuads(from:Point[],to:Point[]) {
  projectiveMap(from);projectiveMap(to);
  const equations:number[][]=[];
  for(let i=0;i<4;i++){const {x,y}=from[i]!,p=to[i]!;equations.push([x,y,1,0,0,0,-p.x*x,-p.x*y,p.x],[0,0,0,x,y,1,-p.y*x,-p.y*y,p.y]);}
  for(let column=0;column<8;column++) {
    let pivot=column;for(let row=column+1;row<8;row++)if(Math.abs(equations[row]![column]!)>Math.abs(equations[pivot]![column]!))pivot=row;
    [equations[column],equations[pivot]]=[equations[pivot]!,equations[column]!];
    const value=equations[column]![column]!;if(Math.abs(value)<1e-9)throw Error("Invalid page alignment");
    for(let j=column;j<9;j++)equations[column]![j]!/=value;
    for(let row=0;row<8;row++)if(row!==column){const factor=equations[row]![column]!;for(let j=column;j<9;j++)equations[row]![j]!-=factor*equations[column]![j]!;}
  }
  const h=equations.map(row=>row[8]!);
  return (x:number,y:number):Point=>{const denominator=h[6]!*x+h[7]!*y+1;return {x:(h[0]!*x+h[1]!*y+h[2]!)/denominator,y:(h[3]!*x+h[4]!*y+h[5]!)/denominator};};
}

/** Conservative marker suggestions: dark square border with a light central hole. */
export function findSquareMarkers(image:Pixels):Point[] {
  const {width,height,data}=image;const gray=(x:number,y:number)=>{const i=(y*width+x)*4;return (data[i]!+data[i+1]!+data[i+2]!)/3;};
  const visited=new Uint8Array(width*height);const candidates:Array<Point & {size:number}>=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    if((x>width*.4&&x<width*.6)||(y>height*.25&&y<height*.75))continue;
    const start=y*width+x;if(visited[start]||gray(x,y)>110)continue;
    const queue=[start];visited[start]=1;let minX=x,maxX=x,minY=y,maxY=y;
    for(let pos=0;pos<queue.length;pos++){const p=queue[pos]!,px=p%width,py=Math.floor(p/width);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);for(const [nx,ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]])if(nx!>=0&&ny!>=0&&nx!<width&&ny!<height){const n=ny!*width+nx!;if(!visited[n]&&gray(nx!,ny!)<110){visited[n]=1;queue.push(n);}}}
    const w=maxX-minX+1,h=maxY-minY+1,cx=Math.round((minX+maxX)/2),cy=Math.round((minY+maxY)/2);
    if(w>=10&&h>=10&&w<width*.13&&h<height*.12&&w/h>.65&&w/h<1.55&&gray(cx,cy)>180&&queue.length/(w*h)>.2&&queue.length/(w*h)<.9)candidates.push({x:cx,y:cy,size:queue.length});
  }
  const chosen=[candidates.filter(p=>p.x<width/2&&p.y<height/2),candidates.filter(p=>p.x>width/2&&p.y<height/2),candidates.filter(p=>p.x>width/2&&p.y>height/2),candidates.filter(p=>p.x<width/2&&p.y>height/2)].map((group,index)=>{const corner=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}][index]!;return group.sort((a,b)=>Math.hypot((a.x-corner.x)/width,(a.y-corner.y)/height)-Math.hypot((b.x-corner.x)/width,(b.y-corner.y)/height))[0];});
  if(chosen.some(p=>!p))return [];
  try{projectiveMap(chosen as Point[]);return chosen.map(p=>({x:p!.x,y:p!.y}));}catch{return [];}
}

export function printedInkAgreement(blank:Pixels,filled:Pixels,boxes:Rect[]) {
  let total=0,matches=0;
  const gray=(p:Pixels,x:number,y:number)=>{const i=(y*p.width+x)*4;return (p.data[i]!+p.data[i+1]!+p.data[i+2]!)/3;};
  for(const box of boxes)for(let y=box.y;y<box.y+box.height;y++)for(let x=box.x;x<box.x+box.width;x++)if(gray(blank,x,y)<130){total++;let matched=false;for(let dy=-2;dy<=2&&!matched;dy++)for(let dx=-2;dx<=2;dx++)if(gray(filled,x+dx,y+dy)<190){matched=true;break;}if(matched)matches++;}
  return total?matches/total:0;
}

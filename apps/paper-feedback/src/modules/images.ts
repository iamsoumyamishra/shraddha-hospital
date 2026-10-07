import { HEIGHT, WIDTH } from "./template";
import { projectiveMap, type Point } from "./marks";
export async function svgCanvas(svg: string): Promise<HTMLCanvasElement> {
  const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));
  try {const image=new Image();image.src=url;await image.decode();const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;canvas.getContext("2d")!.drawImage(image,0,0);return canvas;} finally {URL.revokeObjectURL(url);}
}
export function alignPhoto(source: HTMLCanvasElement, corners: Point[]): HTMLCanvasElement {
  const map=projectiveMap(corners),pixels=source.getContext("2d")!.getImageData(0,0,source.width,source.height);
  const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext("2d")!,output=ctx.createImageData(WIDTH,HEIGHT);output.data.fill(255);
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){const point=map((x-40)/(WIDTH-80),(y-40)/(HEIGHT-80)),sx=Math.round(point.x),sy=Math.round(point.y);if(sx<0||sy<0||sx>=source.width||sy>=source.height)continue;const from=(sy*source.width+sx)*4,to=(y*WIDTH+x)*4;for(let c=0;c<3;c++)output.data[to+c]=pixels.data[from+c]!;}
  ctx.putImageData(output,0,0);return canvas;
}
export function downloadFile(blob: Blob, filename: string) { const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }

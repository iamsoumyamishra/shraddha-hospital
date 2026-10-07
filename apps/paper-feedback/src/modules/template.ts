import { QUESTIONS_PER_PAGE, TEMPLATE_VERSION, type PaperSurvey } from "./contracts";
export const WIDTH = 1000;
export const HEIGHT = 1414;
export type Rect = { x: number; y: number; width: number; height: number };
export type TemplateRow = { id: string; prompt: string; boxes: Rect[] };
export const COMMENT_REGION: Rect = { x: 60, y: 1170, width: 880, height: 125 };
const escape = (value: string) => value.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

export function templateRows(survey: PaperSurvey, page: number): TemplateRow[] {
  const count = Math.ceil(survey.questions.length / QUESTIONS_PER_PAGE);
  if (!Number.isInteger(page) || page < 0 || page >= count) throw new Error("Invalid template page");
  const questions = survey.questions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const rows = questions.map(q => ({ id: q.id, prompt: q.prompt }));
  if (page === count - 1) rows.push({ id: "overall", prompt: "Overall, how satisfied were you with your visit?" });
  return rows.map((row, index) => ({ ...row, boxes: Array.from({ length: row.id === "overall" ? 5 : 6 }, (_, column) => ({ x: 548 + column * 65, y: 252 + index * 64, width: 42, height: 42 })) }));
}
function lines(text: string, max = 47): string[] {
  const result: string[] = []; let current = "";
  for (const word of text.split(/\s+/)) { if ((current + " " + word).trim().length > max && current) { result.push(current); current = word; } else current = (current + " " + word).trim(); }
  if (current) result.push(current); return result;
}
export function templateSvg(survey: PaperSurvey, page: number): string {
  const count = Math.ceil(survey.questions.length / QUESTIONS_PER_PAGE);
  const rows = templateRows(survey, page);
  const titles = lines(survey.title, 70).slice(0, 2);
  const markers = [[40,40,"TL"],[960,40,"TR"],[960,1374,"BR"],[40,1374,"BL"]].map(([x,y,label]) => `<path d="M ${Number(x)-9} ${y} h 18 M ${x} ${Number(y)-9} v 18" stroke="black" stroke-width="3"/><text x="${Number(x)+12}" y="${Number(y)+5}" font-size="12">${label}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="100%" height="100%" fill="white"/><g fill="#111" font-family="Arial, sans-serif">${markers}<text x="60" y="88" font-size="23" font-weight="bold">${escape(survey.hospital.slice(0,65))}</text>${titles.map((title,i)=>`<text x="60" y="${125+i*24}" font-size="19">${escape(title)}</text>`).join("")}<text x="60" y="181" font-size="14">Version ${survey.version} · Page ${page+1}/${count} · ${TEMPLATE_VERSION}</text><text x="60" y="205" font-size="13">Tick ONE box per question. Use N/A only when the question does not apply.</text><text x="60" y="224" font-size="11">${survey.id}</text>${["1","2","3","4","5","N/A"].map((label,i)=>`<text x="${559+i*65}" y="240" font-size="15">${label}</text>`).join("")}${rows.map((row,i)=>`<g><text x="60" y="${row.boxes[0]!.y+14}" font-size="14">${row.id === "overall" ? "Overall" : page*QUESTIONS_PER_PAGE+i+1}.</text>${lines(row.prompt).map((text,j)=>`<text x="100" y="${row.boxes[0]!.y+12+j*Math.min(16,50/lines(row.prompt).length)}" font-size="${Math.min(14,48/lines(row.prompt).length)}">${escape(text)}</text>`).join("")}${row.boxes.map(box=>`<rect x="${box.x+11}" y="${box.y+9}" width="20" height="20" fill="white" stroke="#111" stroke-width="1.5"/>`).join("")}</g>`).join("")}<text x="60" y="1085" font-size="12">Completed by: Patient / Caregiver · Visit type: ____________________</text><text x="60" y="1105" font-size="12">Services used (names): ______________________________________________________________</text><text x="60" y="1130" font-size="${Math.min(12,880/(survey.ratingLabels.map((label,i)=>`${i+1}: ${label}`).join(" · ").length*.6))}">${escape(survey.ratingLabels.map((label,i)=>`${i+1}: ${label}`).join(" · "))}</text>${page===count-1?`<text x="60" y="1155" font-size="14">Optional comments (please do not include medical or contact details):</text><rect x="60" y="1170" width="880" height="125" fill="none" stroke="#bbb"/>`:""}<text x="60" y="1330" font-size="12">Feedback is reviewed by hospital staff. For urgent assistance, contact the hospital directly.</text></g></svg>`;
}

import { matchesFinalForm } from "@hospital/forms";
import type { PaperSurvey } from "./contracts";
import type { Point } from "./marks";
import type { Rect } from "./template";
export const FINAL_WIDTH=1102, FINAL_HEIGHT=1427;
export const FINAL_CORNERS:Point[]=[{x:34,y:28},{x:1068,y:28},{x:1061,y:1386},{x:44,y:1386}];
export const FINAL_ASSET="/forms/sh-omr-01.png";
export const TEXT_REGIONS:Record<string,Rect>={
  staff_most_satisfied:{x:42,y:1053,width:494,height:43},
  staff_dissatisfied:{x:568,y:1053,width:494,height:43},
  feedback_comments:{x:41,y:1217,width:1024,height:89},
};
export const LANGUAGE_BOXES=[487,709,923].map(x=>({x:x-18,y:128,width:36,height:36}));
export const isFinalForm=(survey:PaperSurvey)=>matchesFinalForm(survey.questions);
export function finalRows(survey:PaperSurvey){
  const y=[599,657,716,780,843,909];
  return survey.questions.filter(q=>q.type!=="TEXT").map((q,i)=>({id:q.id,prompt:q.prompt,boxes:[672,765,851,941,1033].map(x=>({x:x-20,y:y[i]!-20,width:40,height:40}))}));
}
export function paperPages(survey:PaperSurvey){return isFinalForm(survey)?1:Math.ceil(survey.questions.length/12);}

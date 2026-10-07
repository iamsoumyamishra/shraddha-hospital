/** User-approved SH-OMR-01 questionnaire. Printed percentages map to internal 1–5 values. */
export const FINAL_FORM_ID = "SH-OMR-01";
export const FINAL_FORM_QUESTIONS = [
  {key:"hospital_cleanliness",categoryKey:"cleanliness",type:"RATING",en:"How was the cleanliness of the hospital?",hi:"अस्पताल की स्वच्छता कैसी थी?",mr:"रुग्णालयाची स्वच्छता कशी होती?"},
  {key:"hospital_staff_behaviour",categoryKey:"staff_behaviour",type:"RATING",en:"How was the behaviour of the hospital staff?",hi:"अस्पताल के कर्मचारियों का व्यवहार कैसा था?",mr:"रुग्णालयातील कर्मचाऱ्यांचा व्यवहार कसा होता?"},
  {key:"hospital_basic_facilities",categoryKey:"accessibility",type:"RATING",en:"What basic facilities did you receive from the hospital?",hi:"आपको अस्पताल से कैसी मूलभूत सुविधाएँ मिलीं?",mr:"रुग्णालयातून तुम्हाला कोणत्या मूलभूत सुविधा मिळाल्या?"},
  {key:"medicines_on_time",categoryKey:"pharmacy",type:"RATING",en:"Did you receive the prescribed medicines at the scheduled time?",hi:"क्या आपको निर्धारित समय पर दवाइयाँ मिलीं?",mr:"आपल्याला निर्धारित वेळी औषधे मिळाली का?"},
  {key:"doctor_treatment_satisfaction",categoryKey:"doctor_communication",type:"RATING",en:"Are you satisfied with the treatment provided by the doctors?",hi:"क्या आप डॉक्टरों द्वारा दिए गए उपचार से संतुष्ट हैं?",mr:"डॉक्टरांकडून मिळालेल्या उपचारांबद्दल तुम्ही समाधानी आहात का?"},
  {key:"overall_services",categoryKey:"staff_behaviour",type:"OVERALL",en:"Overall, how satisfied are you with the services provided?",hi:"कुल मिलाकर, आप अस्पताल की दी गई सेवाओं से कितने संतुष्ट हैं?",mr:"एकूण, दिलेल्या सेवांबद्दल तुम्ही किती समाधानी आहात?"},
  {key:"staff_most_satisfied",categoryKey:"staff_behaviour",type:"TEXT",en:"Which hospital employee's service are you most satisfied with?",hi:"आप किस अस्पताल कर्मचारी की सेवा से सबसे अधिक संतुष्ट हैं?",mr:"तुम्हाला कोणत्या रुग्णालयातील कर्मचाऱ्याची सेवा सर्वाधिक आवडली?"},
  {key:"staff_dissatisfied",categoryKey:"staff_behaviour",type:"TEXT",en:"Which hospital employee's service are you dissatisfied with?",hi:"आप किस अस्पताल कर्मचारी की सेवा से असंतुष्ट हैं?",mr:"तुम्हाला कोणत्या रुग्णालयातील कर्मचाऱ्याची सेवा आवडली नाही?"},
  {key:"feedback_comments",categoryKey:"staff_behaviour",type:"TEXT",en:"If you have any suggestions or comments regarding our hospital services, please write below.",hi:"यदि आपके पास हमारे अस्पताल की सेवाओं के बारे में कोई सुझाव या टिप्पणी है, तो कृपया नीचे लिखें।",mr:"आमच्या रुग्णालयाच्या सेवांबद्दल तुमच्या काही सूचना किंवा अभिप्राय असल्यास, कृपया खाली लिहा."},
] as const;
export const FINAL_RATING_LABELS = ["0% — Completely dissatisfied","25% — Dissatisfied","50% — Average","75% — Satisfied","100% — Completely satisfied"];
export function matchesFinalForm(questions: readonly {key?:string;type?:string;prompt:string}[]) {
  return questions.length === FINAL_FORM_QUESTIONS.length && questions.every((q,i)=>q.key===FINAL_FORM_QUESTIONS[i]!.key && q.type===FINAL_FORM_QUESTIONS[i]!.type && q.prompt===FINAL_FORM_QUESTIONS[i]!.en);
}

export type QuestionKind = "RATING" | "TEXT" | "OVERALL";
export function normalizeAnswer(kind: QuestionKind, answer: {rating?:number|null;text?:string}) {
  if(kind==="TEXT") {
    if(answer.rating!==undefined || typeof answer.text!=="string" || answer.text.length>2000) throw new Error("Written questions require text, not a rating.");
    const text=answer.text.trim();
    return {state:text?"ANSWERED" as const:"SKIPPED" as const,value:null,textValue:text||null};
  }
  if(answer.text!==undefined || answer.rating===undefined || (answer.rating!==null && (!Number.isInteger(answer.rating)||answer.rating<1||answer.rating>5)) || (kind==="OVERALL" && answer.rating===null)) throw new Error("Rating questions require a valid marked choice.");
  return {state:answer.rating===null?"NOT_APPLICABLE" as const:"ANSWERED" as const,value:answer.rating,textValue:null};
}

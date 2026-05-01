export const CLASSIFY_TOPIC_TEMPLATE = (question: string) => `\
You are classifying a student question by topic.

Question: ${question}

Reply with only a short topic label of 2 to 5 words (e.g. "binary search trees",
"TCP/IP model", "merge sort complexity"). No punctuation. No explanation.
`;

export const RETRIEVE_PROMPT = (question: string) => `\
You are a study assistant. A student has asked: ${question}

Using ONLY the provided course materials, identify and quote the most relevant
passages (up to 5). For each passage, state which source it comes from.

Format your response as:
SOURCE: [material name or timestamp]
EXCERPT: [the relevant passage]

If no relevant material is found, reply with: NO_RELEVANT_CONTENT
`;

export const RECALL_TEMPLATE = (question: string, context: string, topic: string) => `\
You are a learning assistant helping a student understand ${topic}.

The student asked: ${question}

Relevant material:
${context}

Your task: respond with a single guided question at the recall level.
The question should help the student locate a specific fact or definition
from the material. Include one brief hint pointing to where the answer
can be found. Do not give the answer directly.
`;

export const APPLICATION_TEMPLATE = (question: string, context: string, topic: string) => `\
You are a learning assistant helping a student understand ${topic}.

The student asked: ${question}

Relevant material:
${context}

Your task: respond with a single guided question at the application level.
The question should ask the student to use a concept from the material
in a concrete scenario or small worked example.
Offer one indirect hint only if the concept is non-obvious.
Do not give the answer directly.
`;

export const ANALYSIS_TEMPLATE = (question: string, context: string, topic: string) => `\
You are a learning assistant helping a student understand ${topic}.

The student asked: ${question}

Relevant material:
${context}

Your task: respond with a single guided question at the analysis level.
The question should require the student to compare trade-offs, identify
limitations, or reason across multiple parts of the material.
Do not include hints. Do not give the answer directly.
`;

export const CLASSIFY_CORRECTNESS_TEMPLATE = (
  guidedQuestion: string,
  context: string,
  studentReply: string,
  hintRequested: boolean,
) => `\
You are evaluating a student's answer to a guided learning question.

Guided question: ${guidedQuestion}

Relevant material used to generate the question:
${context}

Student's reply: ${studentReply}
Hint was requested: ${hintRequested ? "yes" : "no"}

Classify the reply as exactly one of:
  correct
  correct_with_hint
  incorrect

Reply with only the classification label. No explanation.
`;

export const TIER_TEMPLATES = {
  recall: RECALL_TEMPLATE,
  application: APPLICATION_TEMPLATE,
  analysis: ANALYSIS_TEMPLATE,
} as const;

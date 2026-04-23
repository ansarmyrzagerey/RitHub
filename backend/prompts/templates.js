/**
 * Prompt templates for OpenAI requests
 */

const SYSTEM_PROMPTS = {
    QUIZ_GENERATOR: `You are an expert quiz generator. Create educational, accurate, and engaging quiz questions. Always respond with valid JSON only, no additional text.`,
};

/**
 * Build a prompt for quiz generation
 * @param {Object} params - Quiz generation parameters
 * @param {string} params.topic - The quiz topic
 * @param {number} params.questionCount - Number of questions to generate
 * @param {string} params.proficiencyLevel - beginner, intermediate, or expert
 * @param {string} params.questionType - multiple-choice, true-false, or open-ended
 * @returns {string} The formatted prompt
 */
function buildQuizPrompt(params) {
    const { topic, questionCount, proficiencyLevel, questionType } = params;

    let questionTypeInstructions = '';
    let exampleFormat = '';

    if (questionType === 'multiple-choice') {
        questionTypeInstructions = 'Each question should have exactly 4 options.';
        exampleFormat = `{
  "id": "1",
  "question": "Question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 2
}`;
    } else if (questionType === 'true-false') {
        questionTypeInstructions = 'Each question should be a true/false statement with exactly 2 options: "True" and "False".';
        exampleFormat = `{
  "id": "1",
  "question": "Statement to evaluate",
  "options": ["True", "False"],
  "correctAnswer": 0
}`;
    } else if (questionType === 'open-ended') {
        questionTypeInstructions = 'Each question should require a written answer (code or text). The correctAnswer should be a sample/example answer.';
        exampleFormat = `{
  "id": "1",
  "question": "Question requiring written answer",
  "options": [],
  "correctAnswer": "Sample answer or code here"
}`;
    }

    return `${SYSTEM_PROMPTS.QUIZ_GENERATOR}

Generate a quiz with the following specifications:
- Topic: ${topic}
- Number of questions: ${questionCount}
- Proficiency level: ${proficiencyLevel}
- Question type: ${questionType}

${questionTypeInstructions}

Return ONLY a JSON object with this exact structure:
{
  "questions": [
    ${exampleFormat}
  ]
}

Important:
- For proficiency level "${proficiencyLevel}", adjust question difficulty appropriately
- Ensure all questions are accurate and relevant to "${topic}"
- The "correctAnswer" field is the index (0-based) for multiple-choice and true-false, or the sample answer text for open-ended
- Generate exactly ${questionCount} questions
- Return ONLY valid JSON, no markdown, no code blocks, no additional text`;
}

module.exports = {
    SYSTEM_PROMPTS,
    buildQuizPrompt,
};

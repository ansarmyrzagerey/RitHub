> For setup and usage, see [README.md](./README.md).

# RitHub: Platform Architecture & Features

## 1. Executive Summary

RitHub is a specialized, web-based evaluation platform designed for academic and professional human-subject studies of software engineering artifacts. 

As Large Language Models (LLMs) increasingly generate code, architecture diagrams, and documentation, the risk of "hallucinations" (confident but incorrect outputs) has surged. Concurrently, human evaluation of these artifacts is often tainted by brand or author bias (e.g., scoring an artifact higher simply because it was written by an expert or a famous AI model). 

RitHub solves this by providing a controlled **Blind Evaluation Engine** equipped with strict participant qualification protocols and deeply integrated AI tooling, drastically reducing the time required to architect and execute rigorous academic studies.

---

## 2. The "Blind Evaluation" Engine

The cornerstone of RitHub is its strict adherence to double-blind testing principles. The platform fundamentally abstracts the origin of any artifact from the human evaluator. 

When a participant is evaluating a codebase, reading a bug report, or comparing PlantUML diagrams, **authorship is completely hidden**. Participants cannot see whether an artifact was written by:
- A novice student
- A senior staff engineer
- An AI model (like GPT-4 or Claude)

This mechanism forces the participant to evaluate the artifact purely on its technical merit, logic, and clarity, entirely neutralizing the pervasive "author bias" found in modern human-computer interaction studies.

---

## 3. AI-Powered Tooling

RitHub is not just for testing AI; it leverages AI to automate the most tedious parts of study creation. The platform seamlessly integrates with OpenAI to provide three core services to Researchers:

### AI Artifact Generation
Researchers can generate test subjects directly within the platform without leaving their dashboard. RitHub's `ArtifactGenerationService` can instantly produce:
- **Source Code:** (Java, Python, C++, TypeScript, C#) complete with documentation.
- **UML Diagrams:** Generates PlantUML syntax and automatically renders it into visual PNGs via the PlantUML server.
- **Code Clones:** Generates intentional code duplicates (Type 1 through Type 4 clones) to test a participant's ability to spot plagiarism or refactoring opportunities.
- **Requirements, Bug Reports, & Documentation:** Generates robust, markdown-formatted technical documents.
*Note: All AI-generated artifacts are strictly tagged with hidden metadata (`generatedBy: 'ai'`) so researchers can track them, even while they remain hidden from participants.*

### AI Quiz Generation
To ensure participants are qualified, researchers can prompt the `QuizGenerationService` to automatically generate competency quizzes based on a specific topic and difficulty level. The AI builds multi-choice, open-ended, and code-based questions instantly.

### AI Artifact Analysis
Upon uploading or generating an artifact, the `AnalysisService` runs automated metrics tracking. It estimates cyclomatic complexity, calculates a maintainability score, and assesses requirement clarity. This gives researchers an immediate, AI-calculated baseline to compare against their human evaluators' data.

---

## 4. Comprehensive User Roles

RitHub enforces strict Role-Based Access Control (RBAC) to manage the lifecycle of a study securely.

### 🧑‍💻 Participant
- **Competency Badges:** Participants must pass topic-specific quizzes (e.g., *Java Expert*, *QuickSort Proficiency*) to earn persistent badges. 
- **Automated Invitations:** Badged participants receive random, automated invitations to studies that require their specific skill sets.
- **Blind Evaluation:** They perform rigorous side-by-side artifact comparisons or multi-criteria ratings on a custom dashboard, completely blinded to the artifact's author.

### 🔬 Researcher
- **Study Architect:** Researchers build collections of artifacts (either manually uploaded or AI-generated).
- **Task Generation:** They define custom evaluation criteria (e.g., 5-star scales, custom rubrics) and group artifacts. The platform's `TaskGenerationService` automatically builds the side-by-side UI for the participants.
- **Real-Time Analytics:** Researchers track participant progress, grading statuses, and final metric distributions from a live dashboard.

### 🛡️ Reviewer
- **Methodological QA:** Reviewers do not participate in the study; they review the study's design.
- **Ethical Safeguards:** They have the power to analyze evaluations and explicitly "Flag" unethical behavior, biased study designs, or data fabrication.

### ⚙️ Admin
- **System Overseer:** Admins manage global configurations, define the global Competency Badges that users can earn, and monitor the flags raised by Reviewers.
- **Moderation:** They possess the authority to suspend or permanently ban malicious users from the platform.

---

## 5. Study Mechanics & Evaluation Workflows

RitHub supports highly flexible evaluation configurations to match various research methodologies:

1. **Artifact Comparisons (A/B or A/B/C Testing):**
   Participants are presented with 2 or 3 artifacts side-by-side. The UI features synchronized scrolling and highlighting, allowing the participant to seamlessly compare code snippets or diagrams before declaring which is superior based on the researcher's criteria.
   
2. **Artifact Rating (Single Evaluation):**
   Participants focus entirely on one artifact, evaluating it across multiple specific dimensions (e.g., "Rate the Time Complexity", "Rate the Variable Naming Clarity") using custom rating scales.

3. **Strict State Management:**
   Studies move through a strict lifecycle: `Draft -> Active -> Completed -> Archived`. Tasks can only be generated and regenerated while in the `Draft` state. Once `Active`, the schema is locked to ensure absolute data integrity during the human data collection phase.

---

## 6. Data Integrity & Platform Health

To protect valuable academic data, RitHub implements a robust "Soft Deletion" and Trash Bin architecture.
- **Trash Bins:** The platform includes dedicated recovery modules (`StudyTrashBin`, `QuizTrashBin`, `EvaluationTrashBin`).
- **Soft Deletion:** Deleting an artifact, a quiz, or an entire study does not permanently destroy the relational data in the PostgreSQL database. It is instead marked as `is_deleted`. 
- **Recovery:** Researchers can easily restore accidentally deleted assets without corrupting ongoing study statistics or participant progress metrics.

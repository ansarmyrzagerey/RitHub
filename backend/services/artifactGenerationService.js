const OpenAIClientFactory = require('./openai/client-factory');
const config = require('../config/openai.config');

/**
 * Artifact Generation Service
 * Generates artifacts using AI based on user prompts
 */
class ArtifactGenerationService {
    constructor() {
        this.client = OpenAIClientFactory.createClient();
        console.log(`[ArtifactGenerationService] Initialized with model: ${config.defaultModel}`);
    }

    /**
     * Generate an artifact based on user prompt and type
     * @param {Object} params - Generation parameters
     * @param {string} params.prompt - User's generation prompt
     * @param {string} params.type - Artifact type (source_code, requirements, etc.)
     * @param {string} params.name - Optional artifact name
     * @param {string} params.language - Optional programming language for code
     * @returns {Promise<Object>} Generated artifact data
     */
    async generateArtifact(params) {
        const {
            prompt,
            type,
            name = 'Generated Artifact',
            language = 'java',
            renderDiagram = true // New option to render UML diagrams as images
        } = params;

        console.log(`[ArtifactGenerationService] Generating ${type} artifact...`);

        // Build context-aware prompt based on artifact type
        const fullPrompt = this.buildPromptForType(type, prompt, language);

        try {
            const response = await this.client.generateCompletion({
                prompt: fullPrompt,
                model: config.defaultModel,
                maxTokens: this.getMaxTokensForType(type),
                temperature: 0.7
            });

            console.log(`[ArtifactGenerationService] Generated successfully - Model: ${response.model}, Tokens: ${response.tokensUsed.total}`);

            let content = response.content;
            let extension = this.determineFileExtension(type, language);

            // For UML diagrams, optionally render as image
            let imageUrl = null;
            if (type === 'uml_diagram' && renderDiagram) {
                console.log('[ArtifactGenerationService] Attempting to render UML diagram...');
                try {
                    imageUrl = await this.renderPlantUML(content);
                    if (imageUrl) {
                        console.log('[ArtifactGenerationService] UML diagram rendered successfully:', imageUrl);
                    } else {
                        console.warn('[ArtifactGenerationService] UML rendering returned null URL');
                    }
                } catch (renderError) {
                    console.warn('[ArtifactGenerationService] UML rendering failed:', renderError.message);
                }
            }

            // Determine file extension
            const fileName = name.includes('.') ? name : `${name}${extension}`;

            return {
                success: true,
                content: content,
                fileName: fileName,
                imageUrl: imageUrl, // Include imageUrl for UML diagrams (null otherwise)
                metadata: {
                    generatedBy: 'ai',
                    model: response.model,
                    tokensUsed: response.tokensUsed,
                    prompt: prompt,
                    generatedAt: new Date().toISOString(),
                    ...(imageUrl && { renderedImage: imageUrl, diagramType: 'uml' })
                }
            };

        } catch (error) {
            console.error('[ArtifactGenerationService] Generation error:', error);
            throw new Error(`Failed to generate artifact: ${error.message}`);
        }
    }

    /**
     * Render PlantUML code to image using PlantUML server
     * @private
     */
    async renderPlantUML(plantUMLCode) {
        try {
            // Use PlantUML's public encoding service
            const plantumlEncoder = require('plantuml-encoder');
            const encoded = plantumlEncoder.encode(plantUMLCode);

            // Use public PlantUML server to generate PNG
            const imageUrl = `http://www.plantuml.com/plantuml/png/${encoded}`;

            console.log(`[ArtifactGenerationService] PlantUML diagram rendered: ${imageUrl}`);
            return imageUrl;
        } catch (error) {
            console.error('[ArtifactGenerationService] PlantUML rendering error:', error);
            return null;
        }
    }

    /**
     * Build type-specific prompts for better results
     * @private
     */
    buildPromptForType(type, userPrompt, language) {
        const basePrompts = {
            source_code: `You are an expert ${language} developer. Generate clean, well-documented, production-quality code.

Task: ${userPrompt}

Requirements:
- Write code in ${language} programming language
- Include proper comments and documentation
- Follow best practices and coding standards
- Add error handling where appropriate
- Make the code complete and ready to use

Generate ONLY the code, no explanations or markdown. Start immediately with the code.`,

            test_case: `You are an expert test engineer. You MUST generate test cases in ${language} using the appropriate testing framework for that language.

Task: ${userPrompt}

Language: ${language}
${this.getTestFrameworkGuidance(language)}

Requirements:
- Write ALL test code in ${language} (NOT in any other language)
- Cover positive and negative scenarios
- Include edge cases
- Add descriptive test names and comments
- Use proper syntax for ${language}

Generate ONLY the test code in ${language}, no explanations or markdown.`,

            requirements: `You are an expert requirements analyst. Generate clear, detailed requirements documentation.

Task: ${userPrompt}

Requirements:
- Use clear, unambiguous language
- Include functional and non-functional requirements
- Organize requirements logically
- Use markdown formatting for structure

Generate a well-structured requirements document.`,

            documentation: `You are an expert technical writer. Generate clear, comprehensive documentation.

Task: ${userPrompt}

Requirements:
- Use markdown formatting
- Include examples where helpful
- Organize with clear headings
- Make it easy to understand

Generate the documentation.`,

            uml_diagram: `You are an expert software architect. Generate a UML diagram in PlantUML syntax.

Task: ${userPrompt}

Requirements:
- Use valid PlantUML syntax
- Include all relevant components
- Add clear labels and relationships
- Make it comprehensive but readable

Generate ONLY the PlantUML code, starting with @startuml and ending with @enduml.`,

            bug_report: `You are an expert QA engineer. Generate a realistic, detailed bug report in markdown format.

Task: ${userPrompt}

Requirements:
- Use professional, clear language
- Include a descriptive title
- Add severity level (Critical/High/Medium/Low)
- Specify affected component/module
- Provide detailed description of the bug
- List specific steps to reproduce
- Clearly state expected vs actual behavior
- Describe impact on users/system
- Format in markdown with proper headings

Generate a complete, professional bug report.`,

            code_clone: `You are an expert code reviewer. Generate a pair of similar code fragments demonstrating code clones/duplicates.

Task: ${userPrompt}

Language: ${language}

Requirements:
- Generate TWO separate code fragments (Fragment A and Fragment B)
- Make them similar but not identical (realistic code duplication)
- Include variable/function renaming or minor logical modifications
- Write both fragments in ${language}
- Clearly label each fragment with "## Fragment A" and "## Fragment B"
- Add a brief analysis section explaining:
  * Clone type (Type 1: Exact, Type 2: Renamed, Type 3: Modified, Type 4: Semantic)
  * Similarity percentage estimate
  * Refactoring suggestion
- Use markdown formatting

Generate both code fragments with analysis in markdown format.`
        };

        return basePrompts[type] || `Generate content for: ${userPrompt}`;
    }

    /**
     * Get testing framework guidance based on language
     * @private
     */
    getTestFrameworkGuidance(language) {
        const frameworks = {
            java: '- Use JUnit framework (import org.junit.*, use @Test annotations)',
            python: '- Use pytest framework (def test_* functions, use assert statements)',
            javascript: '- Use Jest framework (describe/test blocks, expect assertions)',
            typescript: '- Use Jest framework (describe/test blocks, expect assertions)',
            cpp: '- Use Google Test framework (TEST macros, EXPECT_* assertions)',
            csharp: '- Use NUnit framework ([Test] attributes, Assert methods)'
        };

        return frameworks[language.toLowerCase()] || `- Use appropriate testing framework for ${language}`;
    }

    /**
     * Determine file extension based on artifact type
     * @private
     */
    determineFileExtension(type, language) {
        const extensions = {
            source_code: {
                java: '.java',
                python: '.py',
                javascript: '.js',
                typescript: '.ts',
                cpp: '.cpp',
                csharp: '.cs',
                default: '.txt'
            },
            test_case: {
                java: '.java',
                python: '.py',
                javascript: '.test.js',
                typescript: '.test.ts',
                cpp: '.cpp',
                csharp: '.cs',
                default: '.test'
            },
            requirements: '.md',
            documentation: '.md',
            uml_diagram: '.puml',
            bug_report: '.md',
            code_clone: '.md'
        };

        if (type === 'source_code' || type === 'test_case' || type === 'code_clone') {
            if (typeof extensions[type] === 'object') {
                return extensions[type][language.toLowerCase()] || extensions[type].default;
            }
        }

        return extensions[type] || '.txt';
    }

    /**
     * Get appropriate max tokens based on artifact type
     * @private
     */
    getMaxTokensForType(type) {
        const tokenLimits = {
            source_code: 2000,
            test_case: 1500,
            requirements: 1000,
            documentation: 1500,
            uml_diagram: 800,
            bug_report: 1200,
            code_clone: 1800
        };

        return tokenLimits[type] || 1000;
    }
}

module.exports = new ArtifactGenerationService();

/**
 * Process Bulk Import - Helper function
 * Handles the actual import processing asynchronously with job tracking
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const Artifact = require('../models/artifact');
const Collection = require('../models/collection');

async function processBulkImport(job, file, user, errorPolicy, collectionName) {
    const results = {
        total: 0,
        imported: 0,
        failed: 0,
        errors: [],
        collectionId: null
    };

    try {
        job.status = 'running';
        const fileExtension = path.extname(file.originalname).toLowerCase();

        // Create a collection for this import
        const collection = await Collection.create({
            name: collectionName || `Bulk Import - ${file.originalname}`,
            description: `Bulk imported from ${fileExtension} file on ${new Date().toLocaleString()}`,
            importSource: fileExtension.substring(1),
            createdBy: user.id
        });

        results.collectionId = collection.id;
        job.collectionId = collection.id;

        if (fileExtension === '.zip') {
            await processZipImport(job, file, collection, user, errorPolicy, results);
        } else if (fileExtension === '.csv') {
            await processCsvImport(job, file, collection, user, errorPolicy, results);
        } else if (fileExtension === '.json') {
            await processJsonImport(job, file, collection, user, errorPolicy, results);
        }

        job.complete(collection.id);

    } catch (error) {
        console.error('Error in bulk import:', error);
        job.setError(error.message);
    } finally {
        // Cleanup uploaded file
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
    }
}

async function processZipImport(job, file, collection, user, errorPolicy, results) {
    const zip = new AdmZip(file.path);
    const zipEntries = zip.getEntries();

    results.total = zipEntries.length;
    job.totalItems = zipEntries.length;

    for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        // Check for cancellation
        if (job.cancelled) {
            return;
        }

        try {
            const fileName = path.basename(entry.entryName);
            const fileExt = path.extname(fileName).toLowerCase();

            const allowedTypes = ['.java', '.py', '.md', '.txt', '.pdf', '.uml', '.diff', '.patch', '.png', '.jpg', '.jpeg', '.json'];
            if (!allowedTypes.includes(fileExt)) {
                results.failed++;
                results.errors.push({
                    item: fileName,
                    message: `File type ${fileExt} is not allowed`
                });
                job.updateProgress(results.imported + results.failed, results.failed, results.errors);
                if (errorPolicy === 'abort') throw new Error(`Unsupported file type: ${fileExt}`);
                continue;
            }

            const fileBuffer = entry.getData();
            let artifactType = 'documentation';
            if (['.java', '.py'].includes(fileExt)) artifactType = 'source_code';
            else if (fileExt === '.uml') artifactType = 'uml_diagram';
            else if (['.md', '.txt'].includes(fileExt)) artifactType = 'requirements';
            else if (['.diff', '.patch'].includes(fileExt)) artifactType = 'code_clone_diff';
            else if (['.png', '.jpg', '.jpeg'].includes(fileExt)) artifactType = 'ui_snapshot';
            else if (fileExt === '.json') artifactType = 'documentation';

            let content = null;
            const textTypes = ['.java', '.py', '.md', '.txt', '.diff', '.patch', '.json', '.uml'];
            if (textTypes.includes(fileExt)) {
                try {
                    content = fileBuffer.toString('utf8');
                } catch (e) {
                    content = null;
                }
            }

            const filePath = path.join('uploads', `${Date.now()}-${fileName}`);
            fs.writeFileSync(filePath, fileBuffer);

            const artifact = await Artifact.create({
                name: fileName,
                type: artifactType,
                file_path: filePath,
                file_size: fileBuffer.length,
                mime_type: getMimeType(fileExt),
                content: content,
                metadata: {
                    originalName: fileName,
                    source: 'bulk_import_zip',
                    importedAt: new Date().toISOString()
                },
                uploaded_by: user.id,
                collection_id: collection.id
            });

            results.imported++;
            job.updateProgress(results.imported + results.failed, results.failed);

        } catch (error) {
            console.error('Error processing ZIP entry:', error);
            results.failed++;
            results.errors.push({
                item: entry.entryName,
                message: error.message
            });
            job.updateProgress(results.imported + results.failed, results.failed, [{ item: entry.entryName, message: error.message }]);
            if (errorPolicy === 'abort') throw error;
        }
    }
}

async function processCsvImport(job, file, collection, user, errorPolicy, results) {
    // CSV import logic (simplified for now - can expand later)
    results.total = 0;
    job.totalItems = 0;
    job.complete(collection.id);
}

async function processJsonImport(job, file, collection, user, errorPolicy, results) {
    const jsonContent = fs.readFileSync(file.path, 'utf8');
    let data = JSON.parse(jsonContent);

    // Detect SOLID violations format (code_examples wrapper)
    console.log('DEBUG: Checking data structure:', {
        hasCodeExamples: !!data.code_examples,
        isArray: Array.isArray(data.code_examples),
        dataKeys: Object.keys(data).slice(0, 5)
    });
    const isSOLIDFormat = data.code_examples && Array.isArray(data.code_examples);
    if (isSOLIDFormat) {
        console.log(`Detected SOLID violations format with ${data.code_examples.length} code examples`);
        // Transform to create TWO artifacts per example: one for input, one for output
        const transformedData = [];
        data.code_examples.forEach((example, index) => {
            // Input artifact (violating code)
            transformedData.push({
                title: `${example.violation} Violation (Input) - ${example.level} #${index + 1}`,
                type: 'source_code',
                content: example.input,
                tags: [example.violation, example.level, example.language, 'input', 'violating'],
                description: `SOLID ${example.violation} violation - violating code (${example.level} difficulty)`,
                violation: example.violation,
                level: example.level,
                language: example.language,
                codeType: 'input'
            });

            // Output artifact (fixed code)
            transformedData.push({
                title: `${example.violation} Violation (Output) - ${example.level} #${index + 1}`,
                type: 'source_code',
                content: example.output,
                tags: [example.violation, example.level, example.language, 'output', 'fixed'],
                description: `SOLID ${example.violation} violation - fixed code (${example.level} difficulty)`,
                violation: example.violation,
                level: example.level,
                language: example.language,
                codeType: 'output'
            });
        });
        data = transformedData;
        console.log(`Transformed into ${data.length} artifacts (${data.length / 2} input + ${data.length / 2} output)`);
    }

    if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of artifact objects or a code_examples array');
    }

    results.total = data.length;
    job.totalItems = data.length;

    const isBugReportMetadata = data.some(item => item.bug_url);
    let fetchResults = null;

    if (isBugReportMetadata && !job.cancelled) {
        console.log(`Detected bug report metadata with ${data.length} items. Fetching from URLs...`);
        const { fetchBugReportsBatch } = require('../services/bugReportFetcher');
        fetchResults = await fetchBugReportsBatch(data);

        if (fetchResults.errors.length > 0) {
            console.log(`Failed to fetch ${fetchResults.errors.length} bug reports`);
        }
    }

    for (let i = 0; i < data.length; i++) {
        if (job.cancelled) return;

        try {
            const item = data[i];
            let artifactName, artifactType, content = item.content;

            if (isBugReportMetadata) {
                artifactName = item.defects4j_id || item.title || `Bug #${item.bug_id || i + 1}`;
                artifactType = 'bug_report';
                if (fetchResults && fetchResults.fetched[i]) {
                    content = fetchResults.fetched[i].content;
                }
            } else {
                if (!item.title || !item.type) {
                    results.failed++;
                    results.errors.push({ item: `Item ${i + 1}`, message: 'Missing required fields' });
                    job.updateProgress(results.imported + results.failed, results.failed, [{ item: `Item ${i + 1}`, message: 'Missing required fields' }]);
                    if (errorPolicy === 'abort') break;
                    continue;
                }
                artifactName = item.title;
                artifactType = item.type;
            }

            const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(',').map(t => t.trim()) : []);
            const metadata = {
                ...item,
                tags: tags,
                description: item.description || `Imported from JSON: ${file.originalname}`,
                originalName: item.file_path || item.title || artifactName,
                source: isSOLIDFormat ? 'solid_violations' : (isBugReportMetadata ? 'bug_report_metadata' : 'json_manifest'),
                importedAt: new Date().toISOString()
            };

            await Artifact.create({
                name: artifactName,
                type: artifactType,
                file_path: null,
                content: content || null,
                metadata: metadata,
                uploaded_by: user.id,
                collection_id: collection.id
            });

            results.imported++;
            job.updateProgress(results.imported + results.failed, results.failed);

        } catch (error) {
            console.error('Error processing JSON item:', error);
            results.failed++;
            results.errors.push({ item: `Item ${i + 1}`, message: error.message });
            job.updateProgress(results.imported + results.failed, results.failed, [{ item: `Item ${i + 1}`, message: error.message }]);
            if (errorPolicy === 'abort') break;
        }
    }
}

function getMimeType(ext) {
    const mimeTypes = {
        '.java': 'text/x-java-source',
        '.py': 'text/x-python',
        '.md': 'text/markdown',
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.uml': 'text/plain',
        '.diff': 'text/x-diff',
        '.patch': 'text/x-patch',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.json': 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = { processBulkImport };

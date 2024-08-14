import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

// Create express app
const app = express();
const port = 3000;

// Promisify pipeline for handling streams
const pipelinePromise = promisify(pipeline);

// Create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to parse JSON bodies
app.use(express.json());

// Optimize fetch calls with timeout handling
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000000 } = options; // Set a timeout (70 seconds default)

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });
    clearTimeout(id);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response;
}

// Function to query the model based on user input
async function queryModel(model, data) {
    let url;
    const headers = {
        Authorization: "Bearer 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",
        "Content-Type": "application/json",
    };

    switch (model) {
        case 'dev':
            url = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev";
            break;
        case 'schnell':
            url = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";
            break;
        default:
            throw new Error('Invalid model parameter');
    }

    try {
        const response = await fetchWithTimeout(url, {
            headers: headers,
            method: "POST",
            body: JSON.stringify(data),
        });

        // For 'dev' model, return the stream; for 'schnell', return Buffer
        if (model === 'dev') {
            return response.body; // Stream for dev
        } else {
            const result = await response.blob();
            return Buffer.from(await result.arrayBuffer()); // Convert Blob to Buffer for schnell
        }
    } catch (error) {
        console.error('Error querying model:', error.message);
        throw error;
    }
}

// Endpoint for generating images with the model
app.get('/gen', async (req, res) => {
    const prompt = req.query.prompt;
    const model = req.query.model;

    if (!prompt || !model) {
        return res.status(400).send('Both prompt and model parameters are required');
    }

    try {
        if (model === 'dev') {
            const stream = await queryModel('dev', { "inputs": prompt });

            // Set the appropriate content type for PNG images
            res.setHeader('Content-Type', 'image/png');

            // Use the optimized pipeline for streaming
            await pipelinePromise(stream, res);
        } else {
            const data = await queryModel('schnell', { "inputs": prompt });
            const filename = `generated_prompt_image_model_${model}.png`;
            const filePath = saveImageToFile(data, filename);
            res.sendFile(filePath);
        }
    } catch (error) {
        console.error('Error generating image:', error.message);
        res.status(500).send('Error generating image');
    }
});

// Save image to file
function saveImageToFile(data, filename) {
    const cacheFolderPath = path.join('/tmp', 'cache'); // Changed to /tmp/cache
    if (!fs.existsSync(cacheFolderPath)) {
        fs.mkdirSync(cacheFolderPath, { recursive: true }); // Ensure the directory is created if it doesn't exist
    }
    const filePath = path.join(cacheFolderPath, filename);
    fs.writeFileSync(filePath, data);
    return filePath;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
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

// Function to query the FLUX.1-dev model
async function queryFLUX1Dev(data) {
    const url = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev";
    const headers = {
        Authorization: "Bearer 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",
        "Content-Type": "application/json",
    };

    try {
        const response = await fetch(url, {
            headers: headers,
            method: "POST",
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return response.body; // Return ReadableStream
    } catch (error) {
        console.error('Error querying model:', error.message);
        throw error;
    }
}

// Endpoint for generating images with the FLUX.1-dev model
app.get('/gen', async (req, res) => {
    const prompt = req.query.prompt;

    if (!prompt) {
        return res.status(400).send('Prompt parameter is required');
    }

    try {
        const stream = await queryFLUX1Dev({ "inputs": prompt });
        const filename = `generated_prompt_image_FLUX1Dev.png`;
        const cacheFolderPath = path.join('/tmp', 'cache');

        // Create cache folder if it doesn't exist
        if (!fs.existsSync(cacheFolderPath)) {
            fs.mkdirSync(cacheFolderPath);
        }

        const filePath = path.join(cacheFolderPath, filename);

        // Save the image directly from the stream
        const writeStream = fs.createWriteStream(filePath);
        await pipelinePromise(stream, writeStream);

        // Send the image file
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error generating image:', error.message);
        res.status(500).send('Error generating image');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
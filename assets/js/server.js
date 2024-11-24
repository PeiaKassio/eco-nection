const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware to parse JSON data
app.use(bodyParser.json());

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Personal Access Token
const REPO_OWNER = process.env.REPO_OWNER;     // Repository owner
const REPO_NAME = process.env.REPO_NAME;       // Repository name

app.post('/submit-artwork', async (req, res) => {
    try {
        const { title, description, artist, location, year, topics, email } = req.body;

        // Validate mandatory fields
        if (!title || !description || !artist || !location || !year || !topics) {
            return res.status(400).send("All fields are required.");
        }

        // Validate email if provided
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex for a valid email
        if (email && !emailRegex.test(email)) {
            return res.status(400).send("Invalid email address.");
        }

        // Fetch the existing artwork-data.json from GitHub
        const fileResponse = await axios.get(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/artwork-data.json`,
            {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            }
        );
        const fileContent = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
        const artworkData = JSON.parse(fileContent);

        // Add the new artwork to the dataset
        const newArtwork = {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] }, // Default placeholder for coordinates
            properties: {
                title,
                description,
                artist,
                location,
                year: parseInt(year, 10),
                tags: { topic: topics.split(',').map(t => t.trim()) },
                email: email || null, // Include email only if provided
            },
        };

        artworkData.features.push(newArtwork);

        // Create a new branch for the pull request
        const branchName = `add-artwork-${Date.now()}`;
        const mainBranchSha = fileResponse.data.sha; // Get the SHA of the latest commit on the main branch

        await axios.post(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`,
            {
                ref: `refs/heads/${branchName}`,
                sha: mainBranchSha,
            },
            {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            }
        );

        // Commit the updated artwork-data.json to the new branch
        const updatedContent = Buffer.from(JSON.stringify(artworkData, null, 2)).toString('base64');

        await axios.put(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/artwork-data.json`,
            {
                message: `Add new artwork: ${title}`,
                content: updatedContent, // Updated file content
                branch: branchName, // New branch name
                sha: fileResponse.data.sha, // File's current SHA
            },
            {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            }
        );

        // Create a pull request
        const pullRequestResponse = await axios.post(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
            {
                title: `Add new artwork: ${title}`,
                head: branchName,
                base: "main", // Adjust if your default branch is different
                body: `
This PR adds a new artwork titled "${title}" to the dataset.

### Submission Details:
- **Title:** ${title}
- **Artist:** ${artist}
- **Location:** ${location}
- **Year:** ${year}
- **Topics:** ${topics.split(',').join(', ')}
${email ? `- **Contact Email:** ${email}` : ''}

Please review the submission and merge if appropriate.
                `,
            },
            {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            }
        );

        res.send(`Pull request created successfully: ${pullRequestResponse.data.html_url}`);
    } catch (error) {
        console.error("Error handling submission:", error.response ? error.response.data : error.message);
        res.status(500).send("Failed to submit artwork. Please try again later.");
    }
});

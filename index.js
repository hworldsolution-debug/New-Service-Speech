const express = require('express');
const { createClient } = require('@deepgram/sdk');
const app = express();

app.use(express.json({ limit: '50mb' }));

// API Key ko environment variable se lena behtar rehta hai
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "dfa41e478a2cea22ed719b1e321e26af4fa91b41";
const deepgram = createClient(DEEPGRAM_API_KEY);

// Spoken words ko digits mein convert karne ke liye helper function
function wordsToDigits(text) {
    if (!text) return "";
    
    const wordToNumMap = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'oh': '0'
    };

    // Text se punctuation hatayein aur words ko check karein
    let cleanedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    let words = cleanedText.split(/\s+/);

    let result = words.map(word => wordToNumMap[word] || word).join('');
    
    // Agar result mein digits hain toh sirf digits extract karein
    let digitsOnly = result.replace(/[^0-9]/g, '');
    
    return digitsOnly.length > 0 ? digitsOnly : text;
}

app.post('/base64-transcribe', async (req, res) => {
    try {
        const { audioBase64 } = req.body;
        if (!audioBase64) {
            return res.status(400).json({ error: 'Missing audioBase64 string' });
        }

        // 1. Clean Base64 String
        const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
        const audioBuffer = Buffer.from(cleanBase64, 'base64');

        // 2. Deepgram Prerecorded API ka use karein (Fast aur accurate formatting ke liye)
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
                model: 'nova-2',
                language: 'en',
                smart_format: true,  // Text ko formatting aur numbers mein convert karta hai
                filler_words: false
            }
        );

        if (error) {
            console.error('Deepgram Error:', error);
            return res.status(500).json({ error: 'Failed to transcribe' });
        }

        // 3. Transcript extract karein
        let rawTranscript = result?.results?.channels[0]?.alternatives[0]?.transcript || "";
        
        // 4. Text ko Digits mein convert karein
        let formattedText = wordsToDigits(rawTranscript);

        return res.json({ 
            raw: rawTranscript,
            text: formattedText 
        });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Base64 API active on port ${PORT}`));

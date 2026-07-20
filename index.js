const express = require('express');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const axios = require('axios'); // Stream read karne ke liye
const app = express();

app.use(express.json());

// Deepgram client initialized with your API Key directly or via env
const deepgram = createClient("dfa41e478a2cea22ed719b1e321e26af4fa91b41");

app.post('/stream-transcribe', async (req, res) => {
    try {
        const { audioUrl } = req.body; 
        if (!audioUrl) {
            return res.status(400).json({ error: 'Missing audioUrl in request body' });
        }

        // 1. Live connection setup
        const connection = deepgram.listen.live({
            model: 'nova-2',
            language: 'en',
            smart_format: true,
        });

        let finalTranscript = '';
        let responseSent = false;

        connection.on(LiveTranscriptionEvents.Open, async () => {
            console.log('Deepgram connection opened. Fetching audio stream...');
            try {
                // Audio URL se live data stream download karna shuru karein
                const response = await axios({
                    method: 'get',
                    url: audioUrl,
                    responseType: 'stream'
                });

                // Data chunks ko receive karke Deepgram ko send karna
                response.data.on('data', (chunk) => {
                    if (connection.getReadyState() === 1) { // 1 means OPEN
                        connection.send(chunk);
                    }
                });

                response.data.on('end', () => {
                    console.log('Audio stream ended.');
                    setTimeout(() => {
                        if (connection.getReadyState() === 1) connection.finish();
                    }, 2000); // Thoda wait taaki bacha hua process ho jaye
                });

            } catch (streamError) {
                console.error("Streaming Error:", streamError);
                if (connection.getReadyState() === 1) connection.finish();
            }
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript) {
                finalTranscript += transcript + ' ';
            }
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log('Deepgram live connection closed.');
            if (!responseSent) {
                responseSent = true;
                return res.json({ text: finalTranscript.trim() });
            }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error('Deepgram Error:', err);
            if (!responseSent) {
                responseSent = true;
                return res.status(500).json({ error: 'Transcription failed' });
            }
        });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Live Stream API active on port ${PORT}`));

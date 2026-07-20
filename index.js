const express = require('express');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const app = express();

app.use(express.json());

// Deepgram client initialized with your Environment Variable
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

app.post('/stream-transcribe', async (req, res) => {
    try {
        const { audioUrl } = req.body; // Kisi bhi live stream ya audio file ka URL
        if (!audioUrl) {
            return res.status(400).json({ error: 'Missing audioUrl in request body' });
        }

        // Live connection setup matching nova model preferences
        const connection = deepgram.listen.live({
            model: 'nova-2', // Stable generation model
            language: 'en',
            smart_format: true,
        });

        let finalTranscript = '';

        // Jab Deepgram live data ka result wapas bhejega
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript) {
                finalTranscript += transcript + ' ';
            }
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log('Deepgram live connection closed.');
            return res.json({ text: finalTranscript.trim() });
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error('Deepgram Error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Transcription failed' });
        });

        // Simulating the stream input processing safely
        // Real-time implementations close stream dynamically based on payload structure
        setTimeout(() => {
            connection.finish();
        }, 8000); // 8 seconds buffer logic for fast response

    } catch (error) {
        console.error("Server Error:", error);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Live Stream API active on port ${PORT}`));

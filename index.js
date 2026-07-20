const express = require('express');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const app = express();

// Payload capacity badhane ke liye taaki bada base64 data smoothly accept ho sake
app.use(express.json({ limit: '50mb' }));

// Deepgram client initialization
const deepgram = createClient("dfa41e478a2cea22ed719b1e321e26af4fa91b41");

app.post('/base64-transcribe', async (req, res) => {
    try {
        const { audioBase64 } = req.body;
        if (!audioBase64) {
            return res.status(400).json({ error: 'Missing audioBase64 string' });
        }

        // 1. Base64 string ko clean karke standard Buffer me convert karein
        const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
        const audioBuffer = Buffer.from(cleanBase64, 'base64');

        // 2. Live stream configuration setup
        const connection = deepgram.listen.live({
            model: 'nova-2',
            language: 'en',
            smart_format: true,
        });

        let finalTranscript = '';
        let responseSent = false;

        connection.on(LiveTranscriptionEvents.Open, () => {
            console.log('Deepgram process connection opened.');
            
            // Raw buffer chunks ko safely stream feed me push karein
            connection.send(audioBuffer);
            
            // Feeding complete hone ke baad connection end signal bhejein
            setTimeout(() => {
                if (connection.getReadyState() === 1) connection.finish();
            }, 1500);
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript) {
                finalTranscript += transcript + ' ';
            }
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log('Deepgram process connection finished.');
            if (!responseSent) {
                responseSent = true;
                return res.json({ text: finalTranscript.trim() });
            }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error('Deepgram Processing Error:', err);
            if (!responseSent) {
                responseSent = true;
                return res.status(500).json({ error: 'Failed to transcribe audio stream' });
            }
        });

    } catch (error) {
        console.error("Internal Server Error:", error);
        return res.status(500).json({ error: 'Internal server processing failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Base64 Stream API active on port ${PORT}`));

const express = require('express');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const app = express();

app.use(express.json({ limit: '50mb' }));

const deepgram = createClient("dfa41e478a2cea22ed719b1e321e26af4fa91b41");

app.post('/base64-transcribe', async (req, res) => {
    try {
        const { audioBase64 } = req.body;
        if (!audioBase64) {
            return res.status(400).json({ error: 'Missing audioBase64 string' });
        }

        const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
        const audioBuffer = Buffer.from(cleanBase64, 'base64');

        // numbers: true se Deepgram word spellings ko digits me badal deta hai
        const connection = deepgram.listen.live({
            model: 'nova-2',
            language: 'en',
            smart_format: false,
            numbers: true 
        });

        let finalTranscript = '';
        let responseSent = false;

        connection.on(LiveTranscriptionEvents.Open, () => {
            connection.send(audioBuffer);
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
            if (!responseSent) {
                responseSent = true;
                return res.json({ text: finalTranscript.trim() });
            }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            if (!responseSent) {
                responseSent = true;
                return res.status(500).json({ error: 'Failed to transcribe' });
            }
        });

    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Base64 Stream API active on port ${PORT}`));

# Piper voices

Local neural text-to-speech for Purr Assist, using [Piper](https://github.com/rhasspy/piper) (MIT).
The `.onnx` models are ~60 MB each and are **not** committed. Install and fetch them with:

```bash
pip install piper-tts
cd backend/voices
BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main
curl -LO $BASE/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx
curl -LO $BASE/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json
curl -LO $BASE/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx
curl -LO $BASE/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx.json
curl -LO $BASE/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx
curl -LO $BASE/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx.json
```

Pick the default with `PIPER_VOICE=en_GB-jenny_dioco-medium` in `.env`.
Without these files `/speak` returns 503 and the app uses the browser's own voice.

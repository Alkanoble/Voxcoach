# VoxCoach

### AI-Based Speech Analysis and Communication Improvement Platform

VoxCoach is a web-based platform that helps users practice and improve their communication skills for **interviews, presentations, and public speaking**.

A recorded response is processed through multiple stages of speech and language analysis. The system converts speech into text, examines vocal characteristics and linguistic patterns, and uses generative AI to produce personalized feedback. Users can then review their performance through visual reports and improve individual sentences with AI-assisted rephrasing.

---

## Project Overview

Effective communication is an important skill for students, job seekers, professionals, and anyone who regularly speaks in front of others. However, practicing alone often makes it difficult to identify problems such as excessive fillers, uneven speaking pace, poor pitch variation, or unclear sentence construction.

VoxCoach addresses this by turning a speech recording into a structured analysis report.

The platform examines:

* **Speech delivery** — pace, pauses, and pitch
* **Language usage** — grammar, readability, sentiment, and vocabulary
* **Pronunciation** — phoneme-level pronunciation patterns
* **Communication quality** — fluency and confidence-related indicators
* **Sentence construction** — AI-generated alternatives for improvement

The resulting analysis is presented as scores, charts, observations, and actionable suggestions.

---

## Main Functionalities

### Practice & Interview Modes

Users can choose how they want to practice:

* **Freestyle Mode** for general speaking practice
* **Interview Mode** for simulated interview responses
* Interview questions can be played aloud using the browser's built-in Text-to-Speech functionality

This allows the same platform to be used for both open-ended speaking exercises and structured interview preparation.

### Speech-to-Text Conversion

Recorded audio is passed through **Faster-Whisper** for transcription.

The system intentionally retains speech elements such as:

* `um`
* `uh`
* `like`
* Other hesitations and disfluencies

Keeping these elements in the transcript allows the later analysis stages to detect and evaluate them rather than removing them during transcription.

### Vocal Analysis

The recorded audio is also examined independently of the transcript.

Using `librosa`, VoxCoach extracts information such as:

* Words Per Minute (WPM)
* Average pitch
* Pitch variation
* Pause intervals
* Filler-word frequency
* Speech clarity indicators

Pitch estimation is performed using the **YIN algorithm**.

### Language & NLP Analysis

The transcript is processed using NLP techniques to identify linguistic characteristics.

The analysis includes:

* Readability measurement
* Sentiment polarity
* Tokenization
* Part-of-speech information
* Grammar-related observations
* Vocabulary patterns
* Sentence-level characteristics

The NLP layer makes use of **NLTK, TextBlob, and Textstat**.

### Generative AI Evaluation

The transcript and extracted speech metrics are combined and provided to the AI coaching layer.

**Google Gemini 2.0 Flash** is used as the primary model, while **Groq with Llama 3.3 70B** provides a fallback mechanism.

The generated evaluation includes five major performance areas:

| Category          | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| **Grammar**       | Identifies grammatical problems and possible corrections   |
| **Pronunciation** | Highlights pronunciation-related issues                    |
| **Vocabulary**    | Evaluates word usage and suggests improvements             |
| **Confidence**    | Examines communication patterns associated with confidence |
| **Fluency**       | Evaluates smoothness and overall speech flow               |

Each category receives a structured score on a **0–100 scale** along with supporting feedback.

For Interview Mode, the original interview question is also supplied to the AI so that the answer can be evaluated according to its context.

### Pronunciation Support

VoxCoach provides pronunciation analysis at the phoneme level.

It uses:

* **CMU Pronouncing Dictionary**
* `g2p-en`
* IPA/syllabic pronunciation representations

This allows users to identify individual words that may require additional pronunciation practice.

### AI Sentence Rewriter

Users can select individual sentences from their speech and request alternative versions.

The system can generate variations such as:

* **Natural**
* **Formal**
* **Confident**
* **Concise**
* **Simple**

This feature helps users understand how the same idea can be expressed more effectively in different communication styles.

### Visual Performance Reports

Analysis results are converted into an interactive report rather than being presented only as raw numbers.

The dashboard includes:

* Overall performance score
* Individual skill scores
* Radar chart for skill comparison
* Bar-chart breakdown
* Speech statistics
* Linguistic metrics
* AI-generated recommendations

The frontend uses **Recharts** for data visualization.

---

## Processing Workflow

A typical VoxCoach session follows the pipeline below:

```text
                 ┌───────────────────┐
                 │       User        │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │  React Interface  │
                 │ Record / Practice │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │   Audio Input     │
                 └─────────┬─────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │ Faster-Whisper  │         │    Librosa      │
    │  Transcription  │         │ Vocal Analysis  │
    └────────┬────────┘         └────────┬────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
                 ┌───────────────────┐
                 │ NLP Processing    │
                 │ NLTK / TextBlob   │
                 │ / Textstat        │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │   AI Evaluation   │
                 │ Gemini / Groq      │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Report Generation │
                 │ Scores + Charts + │
                 │ Recommendations   │
                 └───────────────────┘
```

### Stage 1 — Audio Transcription

The recorded speech is processed with Faster-Whisper using the `small` model and CPU-oriented `int8` configuration. Voice Activity Detection is disabled and the transcription prompt is configured to help preserve filler expressions.

### Stage 2 — Speech Feature Extraction

The original audio is analyzed separately to calculate vocal characteristics such as pitch, speaking rate, and pauses.

### Stage 3 — Linguistic Processing

The generated transcript is examined using NLP libraries to obtain readability, sentiment, token-level, and linguistic information.

### Stage 4 — AI Assessment

The collected transcript and analysis results are consolidated into an AI evaluation request. Gemini generates structured feedback, while Groq/Llama acts as the fallback model.

### Stage 5 — Results

The generated information is stored and displayed through the application's reporting interface, allowing the user to review their performance.

---

## System Architecture

VoxCoach follows a **React frontend + FastAPI backend** architecture.

```text
┌───────────────────────┐
│      React / Vite     │
│                       │
│ Recording             │
│ Interview Practice    │
│ Dashboard             │
│ Sentence Rephrasing   │
└───────────┬───────────┘
            │
            │ HTTP / API
            ▼
┌───────────────────────┐
│       FastAPI         │
│       Backend         │
├───────────────────────┤
│ Authentication        │
│ Speech Processing     │
│ NLP Processing        │
│ AI Integration        │
│ Report Generation     │
└───────────┬───────────┘
            │
     ┌──────┼──────────┐
     │      │          │
     ▼      ▼          ▼
 Whisper  Librosa    NLP
     │      │          │
     └──────┼──────────┘
            ▼
      Gemini / Groq
            │
            ▼
      Firebase Firestore
```

---

## Technology Stack

### Backend

| Technology                     | Usage                             |
| ------------------------------ | --------------------------------- |
| **FastAPI**                    | REST API and backend services     |
| **Python 3.12**                | Backend implementation            |
| **Faster-Whisper**             | Speech transcription              |
| **CTranslate2**                | Whisper inference backend         |
| **librosa**                    | Audio and pitch processing        |
| **NLTK**                       | NLP operations                    |
| **TextBlob**                   | Sentiment and linguistic analysis |
| **Textstat**                   | Readability analysis              |
| **Google Gemini 2.0 Flash**    | Primary AI evaluation             |
| **Groq / Llama 3.3 70B**       | AI fallback                       |
| **CMU Pronouncing Dictionary** | Pronunciation mapping             |
| **g2p-en**                     | Grapheme-to-phoneme conversion    |
| **Firebase Firestore**         | Data persistence                  |
| **python-jose**                | JWT authentication                |
| **bcrypt**                     | Password security                 |

### Frontend

| Technology              | Usage                             |
| ----------------------- | --------------------------------- |
| **React 19**            | User interface                    |
| **Vite 7**              | Development and build tooling     |
| **react-router-dom v7** | Application routing               |
| **Axios**               | Backend communication             |
| **Recharts**            | Performance visualization         |
| **Web Speech API**      | Interview-question text-to-speech |

### Deployment

* Docker
* Docker Compose
* `uv` Python package manager

---

## System Requirements

For running the complete application locally, the following configuration is recommended:

| Requirement        | Specification                         |
| ------------------ | ------------------------------------- |
| Processor          | Modern multi-core Intel/AMD processor |
| Memory             | 8 GB minimum; 16 GB recommended       |
| Storage            | 20 GB or more                         |
| Operating System   | Windows / Linux / macOS               |
| Python             | 3.12 or later                         |
| Dependency Manager | `uv`                                  |
| Container Runtime  | Docker Desktop, when using Docker     |

Additional system resources may be required when running Faster-Whisper locally.

---

## Data Organization

The application organizes information around individual speech practice sessions.

```text
User
 │
 └── Speech Session
       ├── Audio
       ├── Practice Mode
       ├── Timestamp
       │
       ├── Transcript
       │
       ├── Vocal Metrics
       │     ├── WPM
       │     ├── Pitch
       │     ├── Pauses
       │     └── Filler Count
       │
       └── Performance Report
             ├── NLP Metrics
             ├── AI Feedback
             ├── Skill Scores
             └── Suggestions
```

Firebase Firestore is organized around the following primary collections:

* `users`
* `recordings`
* `reports`

Reports contain transcript information, speech metrics, NLP results, performance scores, and processing status information.

---

## Verification & Testing

The application was evaluated at multiple levels to verify both individual components and the complete workflow.

### Unit Testing

Individual functionality was checked for:

* Authentication
* Firestore interactions
* NLP edge cases
* Pronunciation mapping
* Prompt generation
* AI fallback handling

### Integration Testing

The complete processing chain was tested from:

**Audio → Transcription → Audio Analysis → NLP → AI Evaluation**

### Validation Testing

The application was also checked for:

* Browser audio recording
* MediaRecorder behavior
* Chart rendering
* Sentence rephrasing output
* Structured AI responses

### User Acceptance Testing

The overall experience was evaluated based on:

* Transcription quality
* Usefulness of coaching feedback
* Interview practice workflow
* Dashboard usability

---

## Performance

Approximate results observed during development and testing:

| Operation                     | Approximate Time |
| ----------------------------- | ---------------: |
| Interview question TTS        |         < 200 ms |
| 60-second audio transcription |           8–12 s |
| Audio + NLP processing        |          14–16 s |
| Gemini evaluation             |            3–6 s |
| Complete analysis             |          40–60 s |
| Firestore operations          |         < 100 ms |
| Filler detection accuracy     |            ≈ 91% |

Actual processing time can vary depending on audio duration, hardware configuration, model execution, and network conditions.

---

## Future Development

Possible extensions for VoxCoach include:

### Progress Monitoring

Track communication performance across multiple practice sessions and visualize improvement over time.

### Multilingual Support

Extend speech recognition and NLP processing to additional languages.

### Mobile Version

Provide the same coaching workflow through a dedicated mobile application.

### Real-Time Coaching

Move from post-recording analysis toward live speech feedback and streaming corrections.

---

## Academic Project

VoxCoach was developed as a **Final Year B.Tech Computer Science and Engineering project** at:

**Viswajyothi College of Engineering and Technology, Vazhakulam**

**Affiliated to:** APJ Abdul Kalam Technological University, Kerala

**Project Guide:** Mrs. Manjusha Mathew

### Team

* **Alka Noble**
* **Andrea Rose Joseph**
* **Lakshmi Haridas**

---

## Project Purpose

VoxCoach was developed to provide a practical way for users to **practice speaking, understand their communication patterns, and receive personalized guidance for improvement**.

By combining speech recognition, audio processing, NLP, pronunciation analysis, visualization, and generative AI in one workflow, the system converts an ordinary practice recording into a detailed communication assessment.

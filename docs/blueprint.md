# **App Name**: ClipGrab

## Core Features:

- URL Input: Accept video URLs from various platforms (YouTube, Instagram, X, Reddit, Snapchat, Discord) via a simple input field.
- Quality Selection: Provide options to select the desired video quality (HD, 720p, or lower) using a dropdown menu or radio buttons.
- Download Link Generation: Generate a direct download link based on the selected quality and provided URL.  Handle link generation for supported platforms.
- Download Button: Display the generated download link prominently with a clear call-to-action button (e.g., 'Download').
- Intelligent Quality Detection: The tool detects the video source platform and attempts to extract the available video quality options using an AI model, even when these are not directly provided in an API. The LLM must use reasoning to identify when this information can be derived from publicly available metadata associated with the provided URL.

## Style Guidelines:

- Primary color: Blue (#3498db) to convey trust and stability.
- Secondary color: Light gray (#ecf0f1) for backgrounds and subtle UI elements.
- Accent: Green (#2ecc71) for the download button to highlight the main action.
- Clean and readable sans-serif fonts for a modern look.
- Use recognizable icons for supported platforms (e.g., YouTube, Instagram).
- Simple and intuitive layout with a focus on ease of use. Prominent input field and download button.
- Subtle loading animations while generating the download link.
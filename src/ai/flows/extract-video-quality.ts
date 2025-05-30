
// src/ai/flows/extract-video-quality.ts
'use server';
/**
 * @fileOverview Extracts video quality options from a given URL using an AI model,
 * with overrides for common platforms based on URL.
 *
 * - extractVideoQuality - A function that handles the video quality extraction process.
 * - ExtractVideoQualityInput - The input type for the extractVideoQuality function.
 * - ExtractVideoQualityOutput - The return type for the extractVideoQuality function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractVideoQualityInputSchema = z.object({
  url: z.string().describe('The URL of the video to extract quality options from.'),
});
export type ExtractVideoQualityInput = z.infer<typeof ExtractVideoQualityInputSchema>;

const ExtractVideoQualityOutputSchema = z.object({
  platform: z.string().describe('The single, canonical primary platform where the video is hosted (e.g., "YouTube", "Instagram", "X", "Reddit", "Snapchat", "Discord", "Other"). It MUST be one of these exact names if applicable. If the platform is unclear, use "Other".'),
  qualities: z.array(z.string()).describe('The available video quality options (e.g., HD, 720p, 360p, Reel, Story, Auto). If unknown, provide ["Auto"].'),
});
export type ExtractVideoQualityOutput = z.infer<typeof ExtractVideoQualityOutputSchema>;

export async function extractVideoQuality(input: ExtractVideoQualityInput): Promise<ExtractVideoQualityOutput> {
  return extractVideoQualityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractVideoQualityPrompt',
  input: {schema: ExtractVideoQualityInputSchema},
  output: {schema: ExtractVideoQualityOutputSchema},
  prompt: `You are an expert in identifying video platforms and extracting available video quality options from URLs.

  Given the following URL, identify the single, canonical, primary video platform.
  The platform MUST be one of the following exact strings if it matches: "YouTube", "Instagram", "X", "Reddit", "Snapchat", "Discord".
  If the platform is not one of these, or it is unclear, you MUST use "Other".

  Then, list any discernible video quality options. If the quality options are not directly available from the URL, use publicly available metadata or reasoning to determine plausible quality options (e.g., "HD", "SD", "Reel", "Story", "Auto"). If no specific qualities can be determined, return ["Auto"].

  URL: {{{url}}}

  Respond ONLY in the following JSON format. Do not include any other text or explanations.

  Example for a YouTube URL (like https://www.youtube.com/watch?v=dQw4w9WgXcQ):
  {
    "platform": "YouTube",
    "qualities": ["1080p", "720p", "480p", "Auto"]
  }

  Example for an Instagram Reel URL (like https://www.instagram.com/reel/Cxyz123abc/):
  {
    "platform": "Instagram",
    "qualities": ["Reel", "Auto"]
  }
  
  Example for an X (Twitter) URL (like https://x.com/user/status/12345):
  {
    "platform": "X",
    "qualities": ["HD", "SD", "Auto"]
  }

  Example for a Reddit video URL:
  {
    "platform": "Reddit",
    "qualities": ["HD", "SD", "Auto"]
  }
  
  Example for a Snapchat URL:
  {
    "platform": "Snapchat",
    "qualities": ["Story", "Auto"]
  }

  Example for a Discord video URL:
  {
    "platform": "Discord",
    "qualities": ["HD", "SD", "Auto"]
  }

  Example for an unknown or generic video URL (like https://example.com/myvideo.mp4):
  {
    "platform": "Other",
    "qualities": ["Auto"]
  }
  `,
});

const extractVideoQualityFlow = ai.defineFlow(
  {
    name: 'extractVideoQualityFlow',
    inputSchema: ExtractVideoQualityInputSchema,
    outputSchema: ExtractVideoQualityOutputSchema,
  },
  async (input) => {
    const {output: aiOutput} = await prompt(input);

    if (!aiOutput) {
      console.error("AI failed to return output for extractVideoQualityFlow with input:", input);
      return { platform: "Other", qualities: ["Auto"] };
    }

    let finalPlatform = aiOutput.platform;
    let finalQualities = aiOutput.qualities && aiOutput.qualities.length > 0 ? aiOutput.qualities : ["Auto"];

    // Force platform based on URL domain for common cases, overriding AI if necessary
    const urlLower = input.url.toLowerCase();
    const knownPlatforms = ["YouTube", "Instagram", "X", "Reddit", "Snapchat", "Discord"];

    if (urlLower.includes("instagram.com/reel/") || urlLower.includes("instagram.com/p/") || urlLower.includes("instagram.com/tv/")) {
      finalPlatform = "Instagram";
      // If AI didn't provide specific Instagram qualities, set a sensible default
      if (finalQualities.length === 1 && finalQualities[0].toLowerCase() === "auto") {
        finalQualities = ["Reel", "Auto"];
      }
    } else if (urlLower.includes("youtube.com/") || urlLower.includes("youtu.be/")) {
      finalPlatform = "YouTube";
    } else if (urlLower.includes("x.com/") || urlLower.includes("twitter.com/")) {
      finalPlatform = "X";
    } else if (urlLower.includes("reddit.com/")) {
      finalPlatform = "Reddit";
    } else if (urlLower.includes("snapchat.com/")) {
      finalPlatform = "Snapchat";
       if (finalQualities.length === 1 && finalQualities[0].toLowerCase() === "auto") {
        finalQualities = ["Story", "Auto"];
      }
    } else if (urlLower.includes("discord.com/") || urlLower.includes("discord.gg/")) {
        finalPlatform = "Discord";
    }

    // If after URL check, the platform determined is not in the known list, map to "Other"
    if (!knownPlatforms.includes(finalPlatform)) {
      if (aiOutput.platform !== finalPlatform) { // Log if URL override led to "Other"
          console.warn(`Platform derived from URL ("${finalPlatform}") is not in known list. Original AI platform was "${aiOutput.platform}". Mapping to "Other". Input URL: ${input.url}`);
      } else { // Log if AI's output was already unknown
          console.warn(`AI returned platform "${aiOutput.platform}", which is not in known list. Mapping to "Other". Input URL: ${input.url}`);
      }
      finalPlatform = "Other";
      finalQualities = ["Auto"]; // Default qualities for "Other"
    }
    
    // Ensure qualities array is never empty
    if (!finalQualities || finalQualities.length === 0) {
        finalQualities = ["Auto"];
    }
    // Ensure "Auto" is present if other specific qualities are listed
    if (finalQualities.length > 0 && !finalQualities.map(q => q.toLowerCase()).includes("auto") && finalPlatform !== "Other") {
        const hasSpecificQualities = finalQualities.some(q => q.toLowerCase() !== "reel" && q.toLowerCase() !== "story");
        if (hasSpecificQualities || finalPlatform === "YouTube" || finalPlatform === "X" || finalPlatform === "Reddit" || finalPlatform === "Discord") {
            finalQualities.push("Auto");
        }
    }


    return { platform: finalPlatform, qualities: finalQualities };
  }
);


// src/ai/flows/extract-video-quality.ts
'use server';
/**
 * @fileOverview Extracts video quality options from a given URL using an AI model.
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
  platform: z.string().describe('The platform where the video is hosted (e.g., YouTube, Instagram).'),
  qualities: z.array(z.string()).describe('The available video quality options (e.g., HD, 720p, 360p).'),
});
export type ExtractVideoQualityOutput = z.infer<typeof ExtractVideoQualityOutputSchema>;

export async function extractVideoQuality(input: ExtractVideoQualityInput): Promise<ExtractVideoQualityOutput> {
  return extractVideoQualityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractVideoQualityPrompt',
  input: {schema: ExtractVideoQualityInputSchema},
  output: {schema: ExtractVideoQualityOutputSchema},
  prompt: `You are an expert in identifying video platforms and extracting available video quality options from URLs and associated metadata.

  Given the following URL, identify the video platform and extract the available video quality options. If the quality options are not directly available, use publicly available metadata or reasoning to determine the possible quality options.

  URL: {{{url}}}

  Respond in a JSON format with the platform and an array of qualities. For example:
  {
    "platform": "YouTube",
    "qualities": ["HD", "720p", "360p"]
  }
  `,
});

const extractVideoQualityFlow = ai.defineFlow(
  {
    name: 'extractVideoQualityFlow',
    inputSchema: ExtractVideoQualityInputSchema,
    outputSchema: ExtractVideoQualityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

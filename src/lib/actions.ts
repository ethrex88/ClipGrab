// src/lib/actions.ts
"use server";

import { extractVideoQuality, type ExtractVideoQualityInput, type ExtractVideoQualityOutput } from "@/ai/flows/extract-video-quality";
import { downloadVideo as genkitDownloadVideo, type DownloadVideoInput, type DownloadVideoOutput } from "@/ai/flows/download-video-flow";


export async function analyzeVideoUrl(
  input: ExtractVideoQualityInput
): Promise<{ success: boolean; data?: ExtractVideoQualityOutput; error?: string }> {
  try {
    const result = await extractVideoQuality(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error analyzing video URL:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred while analyzing the video URL." };
  }
}

export async function initiateVideoDownload(
  input: DownloadVideoInput
): Promise<{ success: boolean; data?: DownloadVideoOutput; error?: string }> {
  try {
    const result = await genkitDownloadVideo(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error initiating video download:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred while preparing the video download." };
  }
}

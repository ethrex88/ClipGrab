
'use server';
/**
 * @fileOverview Prepares a video for download by fetching its details from a third-party API (e.g., RapidAPI).
 *
 * - downloadVideo - A function that handles the video download preparation.
 * - DownloadVideoInput - The input type for the downloadVideo function.
 * - DownloadVideoOutput - The return type for the downloadVideo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DownloadVideoInputSchema = z.object({
  url: z.string().describe('The original URL of the video (e.g., YouTube link).'),
  quality: z.string().describe('The selected video quality preference (e.g., 720p, Auto).'),
  platform: z.string().describe('The platform of the video (e.g., YouTube). This might be less relevant if the API is YouTube-specific.'),
  downloadType: z.string().describe('The type of download: video_audio, audio_only, or video_only.'),
});
export type DownloadVideoInput = z.infer<typeof DownloadVideoInputSchema>;

const DownloadVideoOutputSchema = z.object({
  downloadUrl: z.string().url().describe('The direct URL to the video file for download.'),
  fileName: z.string().describe('The suggested filename for the downloaded video.'),
  message: z.string().describe('A confirmation or informational message for the user.'),
});
export type DownloadVideoOutput = z.infer<typeof DownloadVideoOutputSchema>;

export async function downloadVideo(input: DownloadVideoInput): Promise<DownloadVideoOutput> {
  return downloadVideoFlow(input);
}

// Helper function to extract YouTube Video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  // Regex updated to include /shorts/ and /live/ patterns
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);

  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  
  // Fallback for standard query parameters if regex fails
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.searchParams.has('v')) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && videoId.length === 11) return videoId;
    }
    // This 'id' check is more for URLs that might directly contain an 'id' param, less common for typical YouTube links.
    if (parsedUrl.searchParams.has('id')) {
         const videoId = parsedUrl.searchParams.get('id');
         if (videoId && videoId.length === 11) return videoId;
    }
  } catch (e) {
    // Not a valid URL, or no 'v' or 'id' param
    console.warn("Error parsing URL in extractYouTubeVideoId fallback:", e);
  }
  return null;
}


// CRITICAL TODO: The interfaces ApiLink, RapidApiSuccessResponse, and RapidApiErrorResponse are GENERIC EXAMPLES.
// You MUST inspect the actual JSON response from the 'ytstream-download-youtube-videos.p.rapidapi.com/dl'
// endpoint and update these interfaces and the link selection logic below to match THE API's output.
// The structure of links, quality information, and video/audio types will be specific to THIS API.
interface ApiLink {
  url: string;
  qualityLabel?: string; // e.g., "720p", "1080p", "AUDIO_QUALITY_MEDIUM" - Check API response
  mimeType?: string;     // e.g., "video/mp4", "audio/webm" - Check API response
  hasVideo?: boolean;    // Or similar flags - Check API response
  hasAudio?: boolean;    // Or similar flags - Check API response
  container?: string;    // e.g., "mp4", "webm" - Check API response
  itag?: number;         // YouTube itag if available from API - Check API response
  // Add ANY OTHER relevant properties your chosen RapidAPI might return (e.g., size, bitrate, codecs, etc.)
}

interface RapidApiSuccessResponse {
  // Check the API response for a success indicator, or assume success if status is 200 and data looks right.
  // success?: boolean; // Some APIs include a success flag
  title?: string;    // Video title - Check API response
  formats?: ApiLink[]; // The array of available formats/links might be keyed as 'formats', 'links', 'items', 'adaptiveFormats', 'downloadLinks' etc. CHECK API RESPONSE.
  // Add other top-level properties your chosen RapidAPI might return (e.g., videoId, thumbnail, duration)
}

interface RapidApiErrorResponse {
  // Check how this specific API indicates errors.
  // success?: boolean;
  message?: string;  // Error message
  error?: string;    // Alternative error message key
  // Add other error properties
}

const downloadVideoFlow = ai.defineFlow(
  {
    name: 'downloadVideoFlow',
    inputSchema: DownloadVideoInputSchema,
    outputSchema: DownloadVideoOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey || apiKey === "YOUR_RAPIDAPI_KEY_HERE") {
      throw new Error('RapidAPI key is not configured in .env or is still the placeholder. Please set RAPIDAPI_KEY in your .env file.');
    }

    const videoId = extractYouTubeVideoId(input.url);
    if (!videoId) {
      throw new Error('Could not extract YouTube video ID from the provided URL. Please ensure it is a valid YouTube video link.');
    }

    const rapidApiHost = 'ytstream-download-youtube-videos.p.rapidapi.com';
    const rapidApiEndpoint = `https://${rapidApiHost}/dl?id=${videoId}`;

    let response;
    try {
      response = await fetch(rapidApiEndpoint, {
        method: 'GET', 
        headers: {
          'x-rapidapi-host': rapidApiHost,
          'x-rapidapi-key': apiKey,
        },
      });
    } catch (fetchError: any) {
      console.error('Fetch error calling RapidAPI:', fetchError);
      throw new Error(`Network error when trying to contact download service: ${fetchError.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Could not read error response.");
      console.error(`RapidAPI error: ${response.status} ${response.statusText}`, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && (errorJson.message || errorJson.error)) {
          throw new Error(`Video download service returned an error: ${errorJson.message || errorJson.error}`);
        }
      } catch (e) {
        // Not a JSON error response, or parsing failed
      }
      throw new Error(`Video download service returned an error: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }
    
    const data: RapidApiSuccessResponse | RapidApiErrorResponse = await response.json();

    if ('error' in data || ('message' in data && response.status !== 200 && !('formats' in data))) {
        const errorMessage = (data as RapidApiErrorResponse).error || (data as RapidApiErrorResponse).message || 'API indicated failure but provided no specific message.';
        console.error('RapidAPI response error:', data);
        throw new Error(errorMessage);
    }

    if (!('formats' in data && Array.isArray(data.formats) && data.formats.length > 0)) {
      const errorMessage = (data as RapidApiErrorResponse).message || 'No downloadable links found or API error. Check API response structure. Expected "formats" array.';
      console.error('RapidAPI response error or no "formats" array found:', data);
      throw new Error(errorMessage);
    }
    
    const successData = data as RapidApiSuccessResponse;
    const linksToProcess: ApiLink[] = successData.formats || []; 

    let chosenLink: ApiLink | undefined;

    // CRITICAL TODO: Adapt this link selection logic based on how YOUR API provides:
    // - 'mimeType' (e.g., "video/mp4", "audio/webm")
    // - 'qualityLabel' (e.g., "720p", "AUDIO_QUALITY_MEDIUM")
    // - flags like 'hasVideo', 'hasAudio' or if audio/video is distinguished by mimeType or itag.
    // The properties (link.mimeType, link.qualityLabel, link.hasAudio, etc.) are EXAMPLES.

    if (input.downloadType === 'audio_only') {
      chosenLink = linksToProcess.find(link => 
        (link.mimeType && link.mimeType.startsWith('audio/')) || 
        (typeof link.hasVideo === 'boolean' && typeof link.hasAudio === 'boolean' && !link.hasVideo && link.hasAudio) 
      );
    } else if (input.downloadType === 'video_only') {
      chosenLink = linksToProcess.find(link =>
        (link.mimeType && link.mimeType.startsWith('video/') && !link.mimeType.includes('audio')) || 
        (typeof link.hasVideo === 'boolean' && typeof link.hasAudio === 'boolean' && link.hasVideo && !link.hasAudio) ||
        (link.mimeType && link.mimeType.startsWith('video/')) 
      );
    }
    
    if (!chosenLink || input.downloadType === 'video_audio') {
        chosenLink = linksToProcess.find(link => 
            (link.mimeType && link.mimeType.startsWith('video/') && (link.hasAudio !== false)) || 
            (typeof link.hasVideo === 'boolean' && typeof link.hasAudio === 'boolean' && link.hasVideo && link.hasAudio) 
        );
        
        if (!chosenLink) {
            chosenLink = linksToProcess.find(link => link.mimeType && link.mimeType.startsWith('video/'));
        }
        if (!chosenLink && linksToProcess.length > 0) {
             chosenLink = linksToProcess[0];
        }
    }

    if (!chosenLink || !chosenLink.url) {
      console.error("Could not find a suitable download link after processing API response. Chosen link:", chosenLink, "All links:", linksToProcess, "Input:", input);
      throw new Error('Could not find a suitable download link for the requested type/quality from API response. Please check the API response structure and adapt the selection logic.');
    }
    
    const videoTitle = successData.title || videoId; 
    const safeTitle = videoTitle.replace(/[^a-zA-Z0-9_-\s]/g, '_').replace(/\s+/g, '_');
    
    let extension = 'mp4'; 
    if (input.downloadType === 'audio_only') {
      extension = 'mp3'; 
    }

    if (chosenLink.container) {
      extension = chosenLink.container;
    } else if (chosenLink.mimeType) {
      if (chosenLink.mimeType.includes('mp4')) extension = 'mp4';
      else if (chosenLink.mimeType.includes('webm')) extension = 'webm';
      else if (chosenLink.mimeType.includes('mp3')) extension = 'mp3';
      else if (chosenLink.mimeType.includes('aac')) extension = 'aac';
      else if (chosenLink.mimeType.includes('ogg')) extension = 'ogg';
    } else if (chosenLink.url) {
        const urlExtMatch = chosenLink.url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
        if (urlExtMatch && urlExtMatch[1]) {
            extension = urlExtMatch[1];
        }
    }
    
    const qualitySuffix = input.quality === 'Auto' ? '' : `_${input.quality.replace(/\s+/g, '')}`;
    const fileName = `${safeTitle}${qualitySuffix}_${input.downloadType}.${extension}`.toLowerCase();

    return {
      downloadUrl: chosenLink.url,
      fileName: fileName,
      message: `Download for "${videoTitle}" prepared. Type: ${input.downloadType}, Quality: ${input.quality}.`,
    };
  }
);
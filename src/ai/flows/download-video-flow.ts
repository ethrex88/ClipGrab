
'use server';
/**
 * @fileOverview Prepares a video for download by fetching its details.
 * Dispatches to platform-specific handlers (YouTube, Instagram).
 *
 * - downloadVideo - A function that handles the video download preparation.
 * - DownloadVideoInput - The input type for the downloadVideo function.
 * - DownloadVideoOutput - The return type for the downloadVideo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// --- SHARED SCHEMAS AND TYPES ---
const DownloadVideoInputSchema = z.object({
  url: z.string().describe('The original URL of the video (e.g., YouTube link, Instagram Reel link).'),
  quality: z.string().describe('The selected video quality preference (e.g., 720p, Auto). This is a general preference; actual availability depends on the API/scraping.'),
  platform: z.string().describe('The platform of the video (e.g., YouTube, Instagram).'),
  downloadType: z.string().describe('The type of download: video_audio, audio_only, or video_only.'),
});
export type DownloadVideoInput = z.infer<typeof DownloadVideoInputSchema>;

const DownloadVideoOutputSchema = z.object({
  downloadUrl: z.string().url().describe('The direct URL to the video file for download.'),
  fileName: z.string().describe('The suggested filename for the downloaded video.'),
  message: z.string().describe('A confirmation or informational message for the user.'),
});
export type DownloadVideoOutput = z.infer<typeof DownloadVideoOutputSchema>;


// --- SHARED HELPER FUNCTIONS ---
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  let decodedText = text;
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'",
    '&#x2F;': "/",
    '\\u0026': '&', // For unicode escaped ampersands
  };
  for (const key in entities) {
    const regex = new RegExp(key, 'g');
    decodedText = decodedText.replace(regex, entities[key]);
  }
  try {
    // Attempt to decode unicode sequences like \uXXXX
    decodedText = decodedText.replace(/\\u([\dA-F]{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
  } catch (e) { /* ignore if not needed or invalid sequence */ }
  decodedText = decodedText.replace(/\\\//g, '/'); // Replace escaped slashes
  return decodedText;
}

// --- YOUTUBE DOWNLOAD LOGIC ---
interface YoutubeApiLink {
  url: string;
  itag?: number;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  lastModified?: string;
  contentLength?: string;
  quality?: string; // e.g., "medium", "hd1080"
  fps?: number;
  qualityLabel?: string; // e.g., "360p", "1080p"
  projectionType?: string;
  averageBitrate?: number;
  audioQuality?: string; // e.g., "AUDIO_QUALITY_LOW", "AUDIO_QUALITY_MEDIUM"
  approxDurationMs?: string;
  audioSampleRate?: string;
  audioChannels?: number;
  initRange?: { start: string; end: string };
  indexRange?: { start: string; end: string };
  colorInfo?: {
    primaries?: string;
    transferCharacteristics?: string;
    matrixCoefficients?: string;
  };
  loudnessDb?: number;
  isDrc?: boolean;
  xtags?: string;
}

interface RapidApiYoutubeSuccessResponse {
  status?: string; // Should be "OK"
  id?: string;
  title?: string;
  formats?: YoutubeApiLink[];          // Combined video + audio streams
  adaptiveFormats?: YoutubeApiLink[];  // Video-only or Audio-only streams
  lengthSeconds?: string;
  channelTitle?: string;
  // ... other fields from the API response you expect
}

interface RapidApiErrorResponse {
  status?: string; // Should NOT be "OK"
  message?: string; // API error message
  error?: string; // Alternative error message field
}

const YOUTUBE_QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
const YOUTUBE_AUDIO_QUALITY_ORDER: Record<string, number> = {
  'AUDIO_QUALITY_HIGH': 3,
  'AUDIO_QUALITY_MEDIUM': 2,
  'AUDIO_QUALITY_LOW': 1,
  'AUDIO_QUALITY_ULTRALOW': 0
};

function extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    // Combined regex for various YouTube URL formats including shorts and live
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([^#&?]{11}).*/;
    const match = url.match(regExp);

    if (match && match[1] && match[1].length === 11) {
        return match[1];
    }
    
    // Fallback for URLs that might not be caught by the primary regex, like direct /v/VIDEO_ID or /e/VIDEO_ID
    try {
        const parsedUrl = new URL(url);
        const videoIdFromVParam = parsedUrl.searchParams.get('v');
        if (videoIdFromVParam && videoIdFromVParam.length === 11) {
          return videoIdFromVParam;
        }
        
        const pathSegments = parsedUrl.pathname.split('/');
        // Check for patterns like /shorts/VIDEO_ID or /live/VIDEO_ID
        const shortsIndex = pathSegments.indexOf('shorts');
        if (shortsIndex !== -1 && pathSegments.length > shortsIndex + 1 && pathSegments[shortsIndex + 1].length === 11) {
          return pathSegments[shortsIndex + 1];
        }
        const liveIndex = pathSegments.indexOf('live');
        if (liveIndex !== -1 && pathSegments.length > liveIndex + 1 && pathSegments[liveIndex + 1].length === 11) {
          return pathSegments[liveIndex + 1];
        }
        // Handle cases like youtu.be/VIDEO_ID
        if (parsedUrl.hostname === 'youtu.be' && pathSegments.length > 1 && pathSegments[1].length === 11) {
            return pathSegments[1];
        }

    } catch (e) {
        // console.warn("Error parsing URL in extractYouTubeVideoId fallback:", e);
    }
    return null;
}


async function handleYouTubeDownload(input: DownloadVideoInput): Promise<DownloadVideoOutput> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || apiKey === "YOUR_RAPIDAPI_KEY_HERE") {
    console.error('RapidAPI key for YouTube is not configured. Please set RAPIDAPI_KEY in your .env file.');
    throw new Error('RapidAPI key for YouTube is not configured in .env or is still the placeholder. Please set RAPIDAPI_KEY in your .env file.');
  }

  const videoId = extractYouTubeVideoId(input.url);
  if (!videoId) {
    throw new Error('Could not extract YouTube video ID from the provided URL. Please ensure it is a valid YouTube video link.');
  }
  let videoTitleFromApi = videoId; 

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
    console.error('Fetch error calling YouTube RapidAPI:', fetchError);
    throw new Error(`Network error when trying to contact YouTube download service: ${fetchError.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not read error response.");
    console.error(`YouTube RapidAPI error: ${response.status} ${response.statusText}`, errorText);
    try {
      const errorJson = JSON.parse(errorText) as RapidApiErrorResponse;
      if (errorJson && (errorJson.message || errorJson.error || errorJson.status !== "OK")) {
        throw new Error(`YouTube download service returned an error: ${errorJson.message || errorJson.error || `Status: ${errorJson.status || response.statusText}`}`);
      }
    } catch (e) { /* Not a JSON error response, or parsing failed */ }
    throw new Error(`YouTube download service returned an error: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }

  const data: RapidApiYoutubeSuccessResponse | RapidApiErrorResponse = await response.json();

  if (!('status' in data) || data.status !== 'OK') {
     const errorMessage = (data as RapidApiErrorResponse).message || (data as RapidApiErrorResponse).error || `YouTube API request failed or returned unexpected data structure. Status: ${data.status || 'Unknown'}.`;
    console.error('YouTube RapidAPI response error or unexpected structure:', data);
    throw new Error(errorMessage);
  }
  
  const successData = data as RapidApiYoutubeSuccessResponse;
  videoTitleFromApi = decodeHtmlEntities(successData.title || videoId);

  const combinedFormats: YoutubeApiLink[] = successData.formats || [];
  const adaptiveFormats: YoutubeApiLink[] = successData.adaptiveFormats || [];
  let chosenApiLink: YoutubeApiLink | undefined;

  const userQualityInput = input.quality; 
  const normalizedUserQuality = userQualityInput.includes('(') ? userQualityInput.split(' (')[0] : userQualityInput;

  if (input.downloadType === 'audio_only') {
    let audioStreams = adaptiveFormats.filter(f => f.mimeType?.toLowerCase().startsWith('audio/'));
    if (audioStreams.length === 0) {
      throw new Error('No dedicated audio streams found in YouTube API response for audio_only.');
    }
    
    if (normalizedUserQuality.toLowerCase().includes('mp3') && audioStreams.some(s => s.mimeType?.toLowerCase().includes('audio/mpeg'))) {
        chosenApiLink = audioStreams.find(s => s.mimeType?.toLowerCase().includes('audio/mpeg'));
    }
    
    if (!chosenApiLink) { 
        audioStreams.sort((a, b) => {
            const qualityA = YOUTUBE_AUDIO_QUALITY_ORDER[a.audioQuality?.toUpperCase() || ''] ?? -1;
            const qualityB = YOUTUBE_AUDIO_QUALITY_ORDER[b.audioQuality?.toUpperCase() || ''] ?? -1;
            if (qualityA !== qualityB) return qualityB - qualityA; 
            return (b.averageBitrate || b.bitrate || 0) - (a.averageBitrate || a.bitrate || 0);
        });
        if (normalizedUserQuality === 'Lowest') {
            chosenApiLink = audioStreams[audioStreams.length - 1];
        } else { 
            chosenApiLink = audioStreams[0]; 
        }
    }

  } else if (input.downloadType === 'video_only') {
    let videoOnlyStreams = adaptiveFormats.filter(f => f.mimeType?.toLowerCase().startsWith('video/'));
    if (videoOnlyStreams.length === 0) {
       throw new Error('No dedicated video-only streams found in YouTube API response (adaptiveFormats).');
    }

    if (normalizedUserQuality !== 'Auto' && normalizedUserQuality !== 'Lowest') {
      chosenApiLink = videoOnlyStreams.find(f => f.qualityLabel?.toLowerCase() === normalizedUserQuality.toLowerCase());
    }

    if (!chosenApiLink) { 
      videoOnlyStreams.sort((a, b) => {
        const aIdx = YOUTUBE_QUALITY_ORDER.indexOf(a.qualityLabel || '');
        const bIdx = YOUTUBE_QUALITY_ORDER.indexOf(b.qualityLabel || '');
        if (aIdx !== -1 && bIdx !== -1) { if (aIdx !== bIdx) return aIdx - bIdx; } 
        else if (aIdx !== -1) return -1; 
        else if (bIdx !== -1) return 1;  
        const resA = (a.height || 0) * (a.width || 0);
        const resB = (b.height || 0) * (b.width || 0);
        if (resA !== resB) return resB - resA; 
        return (b.averageBitrate || b.bitrate || 0) - (a.averageBitrate || a.bitrate || 0); 
      });
      if (normalizedUserQuality === 'Lowest') {
        chosenApiLink = videoOnlyStreams[videoOnlyStreams.length - 1];
      } else { 
        chosenApiLink = videoOnlyStreams[0];
      }
    }
  } else { // video_audio (combined)
    let streamsToConsider = combinedFormats.filter(f => f.mimeType?.toLowerCase().startsWith('video/'));
    if (streamsToConsider.length === 0) {
         throw new Error('No combined video+audio streams (formats) found in YouTube API response for video_audio type.');
    }

    if (normalizedUserQuality !== 'Auto' && normalizedUserQuality !== 'Lowest') {
      chosenApiLink = streamsToConsider.find(f => f.qualityLabel?.toLowerCase() === normalizedUserQuality.toLowerCase());
    }
    if (!chosenApiLink) { 
      streamsToConsider.sort((a, b) => {
        const aIdx = YOUTUBE_QUALITY_ORDER.indexOf(a.qualityLabel || '');
        const bIdx = YOUTUBE_QUALITY_ORDER.indexOf(b.qualityLabel || '');
        if (aIdx !== -1 && bIdx !== -1) { if (aIdx !== bIdx) return aIdx - bIdx; }
        else if (aIdx !== -1) return -1;
        else if (bIdx !== -1) return 1;
        const resA = (a.height || 0) * (a.width || 0);
        const resB = (b.height || 0) * (b.width || 0);
        if (resA !== resB) return resB - resA;
        return (b.averageBitrate || b.bitrate || 0) - (a.averageBitrate || a.bitrate || 0);
      });
      if (normalizedUserQuality === 'Lowest') {
        chosenApiLink = streamsToConsider[streamsToConsider.length - 1];
      } else { 
        chosenApiLink = streamsToConsider[0];
      }
    }
  }

  if (!chosenApiLink || !chosenApiLink.url) {
    console.error("Could not find a suitable YouTube download link. API Response:", JSON.stringify(successData, null, 2), "User Input:", input, "Chosen Link (if any):", chosenApiLink);
    throw new Error('Could not find a suitable YouTube download link for the requested type/quality from the API response.');
  }

  const safeTitle = (videoTitleFromApi || "youtube_video").replace(/[<>:"/\\|?*#%&{}]/g, '_').replace(/\s+/g, '_');
  let extension = 'mp4'; 
  const mime = chosenApiLink.mimeType?.toLowerCase() || "";

  if (mime.includes('audio/mpeg')) { 
      extension = 'mp3';
  } else if (mime.includes('audio/mp4')) { 
      extension = 'm4a';
  } else if (mime.includes('audio/webm')) { 
      extension = 'webm'; 
  } else if (mime.includes('video/mp4')) {
      extension = 'mp4';
  } else if (mime.includes('video/webm')) {
      extension = 'webm';
  } else if (mime.includes('video/x-flv')) {
      extension = 'flv';
  } else if (mime.includes('video/3gpp')) {
      extension = '3gp';
  }
  
  if (extension === 'mp4' && !mime.startsWith('audio/') && chosenApiLink.url) {
      const urlExtMatch = chosenApiLink.url.match(/\.([a-zA-Z0-9]+)(?:$|[#?&])/);
      if (urlExtMatch && urlExtMatch[1]) {
          const potentialExt = urlExtMatch[1].toLowerCase();
          if (['mp4', 'webm', 'mkv', 'flv', 'avi', 'mov', '3gp'].includes(potentialExt)) {
               extension = potentialExt;
          }
      }
  }

  const qualitySuffix = (input.quality === 'Auto' || !input.quality) 
      ? (chosenApiLink.qualityLabel ? `_${chosenApiLink.qualityLabel.replace(/\s+/g, '').replace(/[()]/g, '')}` : (chosenApiLink.audioQuality ? `_${chosenApiLink.audioQuality.replace('AUDIO_QUALITY_', '').toLowerCase()}`: '' )) 
      : `_${input.quality.replace(/\s+/g, '').replace(/[()]/g, '')}`;

  const downloadTypeSuffix = input.downloadType.replace('_', '-');
  const userMessage = `Download for "${videoTitleFromApi}" (${downloadTypeSuffix}) prepared. Quality: ${chosenApiLink.qualityLabel || chosenApiLink.audioQuality || 'N/A'}.`;

  const fileName = `${safeTitle}${qualitySuffix}_${downloadTypeSuffix}.${extension}`.toLowerCase();

  return {
    downloadUrl: chosenApiLink.url,
    fileName: fileName,
    message: userMessage,
  };
}

// --- INSTAGRAM DOWNLOAD LOGIC ---
interface InstagramMediaItem {
    id: string;
    url: string;
    quality: string; // e.g., "640-1137p", "audio"
    type: "video" | "audio";
    extension: "mp4" | "m4a" | string; // Potentially others
    // Other fields might exist like mimeType, codec, bandwidth, resolution, frameRate
}

interface InstagramOwner {
    id: string;
    username: string;
    is_verified: boolean;
    profile_pic_url: string;
    full_name: string;
    // ... other owner details
}

interface InstagramApiData {
    url: string;
    source: string;
    title: string;
    author: string;
    shortcode: string;
    thumbnail: string;
    duration: number;
    owner: InstagramOwner;
    medias: InstagramMediaItem[];
    type: string; // e.g., "multiple"
    error: boolean;
    time_end?: number; // Optional, from your example
    // ... other fields like view_count, like_count, music_attribution_info
}

interface InstagramDownloaderApiResponse {
    success: boolean;
    message: string;
    data: InstagramApiData;
    timestamp?: string; // Optional, from your example
}

interface InstagramDownloaderApiErrorResponse {
  success: boolean;
  message: string;
  error?: string; // Or whatever structure an error might take
  data?: null; // Typically null or absent on error
}


async function handleInstagramDownload(input: DownloadVideoInput): Promise<DownloadVideoOutput> {
  const igHost = process.env.INSTAGRAM_DOWNLOADER_RAPIDAPI_HOST;
  const igKey = process.env.INSTAGRAM_DOWNLOADER_RAPIDAPI_KEY;

  if (!igHost || igHost === "YOUR_INSTAGRAM_DOWNLOADER_RAPIDAPI_HOST_HERE" || !igKey || igKey === "YOUR_INSTAGRAM_DOWNLOADER_RAPIDAPI_KEY_HERE") {
    console.error('Instagram Downloader RapidAPI host or key is not configured. Please set them in your .env file.');
    throw new Error('Instagram Downloader RapidAPI host or key is not configured in .env or is still the placeholder. Please set them in your .env file.');
  }

  const encodedReelUrl = encodeURIComponent(input.url);
  const instagramApiEndpoint = `https://${igHost}/download?url=${encodedReelUrl}`;

  let response;
  try {
    response = await fetch(instagramApiEndpoint, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': igHost,
        'x-rapidapi-key': igKey,
      },
    });
  } catch (fetchError: any) {
    console.error('Fetch error calling Instagram Downloader RapidAPI:', fetchError);
    throw new Error(`Network error when trying to contact Instagram download service: ${fetchError.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not read error response from Instagram API.");
    console.error(`Instagram Downloader RapidAPI error: ${response.status} ${response.statusText}`, errorText);
    try {
      const errorJson = JSON.parse(errorText) as InstagramDownloaderApiErrorResponse;
      const errorMessage = errorJson.message || errorJson.error || `Status: ${response.statusText}`;
      throw new Error(`Instagram download service returned an error: ${errorMessage}`);
    } catch (e) { /* Not a JSON error response, or parsing failed */ }
    throw new Error(`Instagram download service returned an error: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }
  
  const responseData: InstagramDownloaderApiResponse | InstagramDownloaderApiErrorResponse = await response.json();

  if (!responseData.success || !('data' in responseData) || !responseData.data || responseData.data.error) {
    const errorMessage = ('message' in responseData && responseData.message) || 
                         (responseData.data && 'error' in responseData.data && responseData.data.error) || 
                         `Instagram API request failed or returned unexpected data structure.`;
    console.error('Instagram Downloader RapidAPI response error or unexpected structure:', responseData);
    throw new Error(errorMessage);
  }

  const apiData = responseData.data as InstagramApiData; // We've asserted successData has .data

  let chosenMediaItem: InstagramMediaItem | undefined;
  let userMessage: string;

  const videoTitleFromApi = decodeHtmlEntities(apiData.title || "instagram_video");
  const safeTitle = videoTitleFromApi.replace(/[<>:"/\\|?*#%&{}]/g, '_').replace(/\s+/g, '_');

  if (input.downloadType === 'audio_only') {
    chosenMediaItem = apiData.medias.find(m => m.type === 'audio');
    if (!chosenMediaItem) {
      // Fallback to main video if no dedicated audio, but message that it's not audio-only
      chosenMediaItem = apiData.medias.find(m => m.type === 'video');
      userMessage = `Dedicated audio stream not found for "${videoTitleFromApi}". Providing main video, which may include audio.`;
    } else {
      userMessage = `Audio download for "${videoTitleFromApi}" prepared.`;
    }
  } else if (input.downloadType === 'video_only') {
    chosenMediaItem = apiData.medias.find(m => m.type === 'video');
    // Note: The API response doesn't explicitly say if this video stream has audio.
    // We assume it might, and the user is responsible for muting if needed.
    userMessage = `Video download for "${videoTitleFromApi}" prepared. Note: This stream may still contain audio.`;
  } else { // video_audio (default)
    chosenMediaItem = apiData.medias.find(m => m.type === 'video');
    userMessage = `Video + Audio download for "${videoTitleFromApi}" prepared.`;
  }

  if (!chosenMediaItem || !chosenMediaItem.url) {
    console.error("Could not find a suitable Instagram download link from API response. Response data:", JSON.stringify(apiData, null, 2));
    throw new Error('Could not extract a suitable download URL from Instagram API response. Please check the API documentation and response structure.');
  }
  
  const fileExtension = chosenMediaItem.extension || 'mp4'; // Default to mp4 if extension not provided
  
  const qualitySuffix = (input.quality === 'Auto' || !input.quality || input.quality.toLowerCase().includes('reel')) 
      ? '_Reel' 
      : `_${input.quality.replace(/\s+/g, '').replace(/[()]/g, '')}`;
  
  let downloadTypeSuffix = input.downloadType.replace('_', '-');
  if (input.downloadType === 'audio_only' && chosenMediaItem.type !== 'audio') {
      downloadTypeSuffix = 'video-audio-fallback'; // Indicate it's a fallback
  }
  
  const fileName = `${safeTitle}${qualitySuffix}_${downloadTypeSuffix}.${fileExtension}`.toLowerCase();

  return {
    downloadUrl: chosenMediaItem.url,
    fileName: fileName,
    message: userMessage,
  };
}

// --- MAIN EXPORTED FUNCTION ---
export async function downloadVideo(input: DownloadVideoInput): Promise<DownloadVideoOutput> {
  return downloadVideoFlow(input);
}

// --- GENKIT FLOW DEFINITION (Dispatcher) ---
const downloadVideoFlow = ai.defineFlow(
  {
    name: 'downloadVideoFlow',
    inputSchema: DownloadVideoInputSchema,
    outputSchema: DownloadVideoOutputSchema,
  },
  async (input) => {
    const platformLower = input.platform.toLowerCase();

    if (platformLower.includes("youtube")) {
      return handleYouTubeDownload(input);
    } else if (platformLower.includes("instagram")) {
      return handleInstagramDownload(input);
    } else {
      console.warn(`Platform "${input.platform}" is not fully supported for download. Returning placeholder.`);
      // You might want to throw an error for unsupported platforms
      throw new Error(`Unsupported platform: ${input.platform}. Only YouTube and Instagram are currently supported for download.`);
    }
  }
);

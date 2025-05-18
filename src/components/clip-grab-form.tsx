
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeVideoUrl, initiateVideoDownload } from "@/lib/actions";
import type { ExtractVideoQualityOutput } from "@/ai/flows/extract-video-quality";
import type { DownloadVideoInput } from "@/ai/flows/download-video-flow";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Info, Film, AudioWaveform, Video } from "lucide-react";
import PlatformIcon from "./icons/platform-icon";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }),
  quality: z.string().min(1, { message: "Please select a quality." }),
  downloadType: z.string().min(1, { message: "Please select a download type." }),
});

type FormValues = z.infer<typeof formSchema>;

const initialQualities = ["Auto", "1080p (HD)", "720p", "480p", "360p", "Lowest"];
// This constant might be less relevant if actual download URLs are fetched.
// const PLACEHOLDER_DOWNLOAD_DOMAIN = "example.com/video-download-not-implemented"; 

export default function ClipGrabForm() {
  const [isAnalyzing, startTransitionAnalyze] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ExtractVideoQualityOutput | null>(null);
  const [availableQualities, setAvailableQualities] = useState<string[]>(initialQualities);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      quality: "Auto",
      downloadType: "video_audio",
    },
  });

  const onSubmitUrl = async (values: Pick<FormValues, 'url'>) => {
    setAnalysisResult(null);
    setAvailableQualities(initialQualities);
    form.setValue('quality', 'Auto');
    form.setValue('downloadType', 'video_audio');
    form.clearErrors('quality');
    form.clearErrors('downloadType');

    startTransitionAnalyze(async () => {
      const result = await analyzeVideoUrl({ url: values.url });
      if (result.success && result.data) {
        setAnalysisResult(result.data);
        const newQualitiesOptions = ["Auto", ...result.data.qualities];
        setAvailableQualities(newQualitiesOptions);
        
        const preferredQuality = result.data.qualities.includes("720p") ? "720p" : (result.data.qualities[0] || "Auto");
        form.setValue('quality', preferredQuality, { shouldValidate: true });
        form.setValue('downloadType', 'video_audio', { shouldValidate: true });
        await form.trigger(['quality', 'url', 'downloadType']);

        toast({
          title: "Analysis Complete",
          description: (
            <div className="flex items-center">
              <PlatformIcon platform={result.data.platform} className="mr-2 h-5 w-5" />
              Detected platform: {result.data.platform}. Select quality, download type and download.
            </div>
          ),
          variant: "default",
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: result.error || "Could not analyze the video URL.",
          variant: "destructive",
        });
      }
    });
  };

  const handleDownload = async (values: FormValues) => {
    if (!analysisResult) return;

    setIsDownloading(true);
    toast({
      title: "Preparing Download...",
      description: `Requesting download for video from ${analysisResult.platform} in ${values.quality} quality (${values.downloadType.replace('_', ' ')}).`,
    });

    const downloadInput: DownloadVideoInput = {
      url: form.getValues("url"),
      quality: values.quality,
      platform: analysisResult.platform,
      downloadType: values.downloadType,
    };

    const result = await initiateVideoDownload(downloadInput);
    setIsDownloading(false);

    if (result.success && result.data) {
      // const isPlaceholderDownload = result.data.downloadUrl.includes(PLACEHOLDER_DOWNLOAD_DOMAIN);
      // Check if it's an actual download URL. A more robust check might be needed
      // depending on what non-downloadable URLs might be returned on error by the API.
      const isLikelyRealDownload = result.data.downloadUrl.startsWith('http');


      toast({
        title: isLikelyRealDownload ? "Download Ready!" : "Download Information",
        description: result.data.message,
        icon: isLikelyRealDownload ? <Download className="h-5 w-5" /> : <Info className="h-5 w-5" />,
        duration: isLikelyRealDownload ? 5000 : 9000,
      });

      if (isLikelyRealDownload) {
        const link = document.createElement('a');
        link.href = result.data.downloadUrl;
        link.setAttribute('download', result.data.fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.warn("Download not triggered or placeholder returned: " + result.data.message);
      }
    } else {
      toast({
        title: "Download Failed",
        description: result.error || "Could not prepare the video for download.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <div className="flex items-center space-x-2 mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
            <path d="M12 15L12 9M9 12H15" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d_grab="M16.5 9.4C16.5 8.294 15.387 7.5 14.25 7.5C13.113 7.5 12 8.294 12 9.4C12 10.227 12.477 10.854 13.125 11.187V14.25C13.125 14.664 13.461 15 13.875 15C14.289 15 14.625 14.664 14.625 14.25V11.187C15.273 10.854 15.75 10.227 15.75 9.4H16.5ZM7.5 9.4C7.5 8.294 8.613 7.5 9.75 7.5C10.887 7.5 12 8.294 12 9.4C12 10.227 11.523 10.854 10.875 11.187V14.25C10.875 14.664 10.539 15 10.125 15C9.711 15 9.375 14.664 9.375 14.25V11.187C8.227 10.854 7.5 10.227 7.5 9.4Z" fill="currentColor" transform="translate(0 1)"/>
          </svg>
          <CardTitle className="text-3xl font-bold">ClipGrab</CardTitle>
        </div>
        <CardDescription>
          Enter a video URL (e.g., YouTube) to get download options. Requires RapidAPI key setup.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleDownload)} className="space-y-6">
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video URL</FormLabel>
                  <div className="flex space-x-2">
                    <FormControl>
                      <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      onClick={() => onSubmitUrl({ url: form.getValues("url") })}
                      disabled={isAnalyzing || !form.watch("url") || !!form.formState.errors.url}
                      variant="outline"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "Analyze"
                      )}
                    </Button>
                  </div>
                  <FormDescription>
                    Paste the full video link from the supported platform.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {analysisResult && (
              <>
                <div className="space-y-2 p-3 bg-secondary/50 rounded-md">
                  <div className="flex items-center text-sm font-medium">
                    <PlatformIcon platform={analysisResult.platform} className="mr-2 h-5 w-5" />
                    Detected Platform: {analysisResult.platform}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available qualities (from AI analysis): {analysisResult.qualities.join(", ") || "N/A"}.
                    Actual download options depend on the third-party service.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="quality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Quality Preference</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.trigger(['quality', 'url', 'downloadType']); 
                        }}
                        value={field.value}
                        disabled={isAnalyzing || !analysisResult}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a quality option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableQualities.map((q) => (
                            <SelectItem key={q} value={q}>
                              {q}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="downloadType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Download Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.trigger(['quality', 'url', 'downloadType']);
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                          disabled={isAnalyzing || !analysisResult}
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="video_audio" id="r1" />
                            </FormControl>
                            <FormLabel htmlFor="r1" className="font-normal flex items-center">
                              <Film className="mr-2 h-4 w-4 text-primary" /> Video + Audio
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="audio_only" id="r2" />
                            </FormControl>
                            <FormLabel htmlFor="r2" className="font-normal flex items-center">
                              <AudioWaveform className="mr-2 h-4 w-4 text-primary" /> Audio Only
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="video_only" id="r3" />
                            </FormControl>
                            <FormLabel htmlFor="r3" className="font-normal flex items-center">
                               <Video className="mr-2 h-4 w-4 text-primary" /> Video Only
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isAnalyzing || isDownloading || !analysisResult || !form.formState.isValid}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? "Preparing..." : "Download Video"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

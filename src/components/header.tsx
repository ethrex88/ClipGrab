"use client";
import type {Dispatch, SetStateAction } from "react";
import React, {useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HeaderProps {
    theme: string;
    setTheme: Dispatch<SetStateAction<string>>;
}

interface Language {
    code: string;
    name: string;
}

const supportedLanguages: Language[]=[
    { code:"EN", name: "English"},
    {code: "ES", name: "Español"},
    { code: "FR", name: "Français" },
];

export default function Header({ theme, setTheme }: HeaderProps) {
    const [selectedLanguage, setSelectedLanguage] = useState<string>("EN");
    const { toast } = useToast();
  
    useEffect(() => {
      const storedLanguage = localStorage.getItem("clipgrab-lang");
      if (storedLanguage && supportedLanguages.some(lang => lang.code === storedLanguage)) {
        setSelectedLanguage(storedLanguage);
      }
    }, []);
  
    const handleThemeToggle = () => {
      setTheme(theme === "light" ? "dark" : "light");
    };
  
    const handleLanguageChange = (languageCode: string) => {
      setSelectedLanguage(languageCode);
      localStorage.setItem("clipgrab-lang", languageCode);
      const langName = supportedLanguages.find(l => l.code === languageCode)?.name || languageCode;
      toast({
        title: "Language Changed",
        description: `Interface language set to ${langName}. (Full translation not yet implemented)`,
      });
      // Here you would typically integrate with an i18n library
      // to change the application's displayed text.
    };
  
    return (
      <header className="py-3 px-4 sm:px-6 bg-card shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">ClipGrab</h1>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "flex items-center",
                    "hover:bg-primary hover:text-primary-foreground focus-visible:ring-primary"
                  )}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {selectedLanguage}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {supportedLanguages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onSelect={() => handleLanguageChange(lang.code)}
                    className="flex justify-between items-center focus:bg-primary/10 focus:text-primary"
                  >
                    {lang.name} ({lang.code})
                    {selectedLanguage === lang.code && <Check className="h-4 w-4 ml-2 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
  
            <div className="flex items-center space-x-2">
              <Sun className={`h-5 w-5 transition-colors ${theme === 'light' ? 'text-primary' : 'text-foreground opacity-60'}`} />
              <Switch
                id="theme-switch"
                checked={theme === "dark"}
                onCheckedChange={handleThemeToggle}
                aria-label="Toggle theme"
              />
              <Moon className={`h-5 w-5 transition-colors ${theme === 'dark' ? 'text-primary' : 'text-foreground opacity-60'}`} />
            </div>
          </div>
        </div>
      </header>
    );
  }

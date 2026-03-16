import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const models = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "llama3-70b-8192", name: "Llama 3 70B", provider: "Groq" },
  { id: "llama3-8b-8192", name: "Llama 3 8B", provider: "Groq" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "OpenRouter" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash", provider: "OpenRouter" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Gemini" },
  { id: "zo", name: "AutoAI Engine", provider: "AutoAI" }
];

export function ModelSelector({ value, onChange }: { value: string, onChange: (val: string, provider: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-500 uppercase tracking-wider">AI Model</label>
      <Select 
        value={value} 
        onValueChange={(val) => {
          const model = models.find(m => m.id === val);
          if (model) onChange(val, model.provider.toLowerCase());
        }}
      >
        <SelectTrigger className="w-full bg-slate-950 border-slate-800 text-slate-300">
          <SelectValue placeholder="Select Model" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id} className="focus:bg-slate-800">
              <div className="flex items-center justify-between w-full gap-2">
                <span>{model.name}</span>
                <Badge variant="outline" className="text-[10px] py-0 h-4 px-1 opacity-50">
                  {model.provider}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { AngeLifelineOverlay } from "@angelifeline/react";
import {
  analyzeForRedFlag,
  classifyDeviceTelephony,
  extractRegionHint,
  fetchCrisisHelplines,
  hasLocationContext,
  hasResolvablePlaceHint,
  inferCrisisFocus,
  inferEmergencyRegion,
  emergencyRegionFromRegionHint,
  placeLookupFromKeywords,
  resolveLiveEventLookup,
  resolveSecondaryLines,
  type CrisisHelplinesResult,
  type DeviceTelephonyClass,
  type RedFlagAnalysis,
  type SecondaryLine,
  fetchCrisisTriage,
  type UiLocale,
} from "@angelifeline/core";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SEED: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Sandbox chat — messages stay in your browser except optional API calls to this demo’s AngeLifeline routes (Gemini / Places when keys are set). Try “panic at Fuji Rock” or 「想死」 to preview the overlay.",
  },
];

function simulateReply(userText: string): string {
  if (/thank|多謝|ok/i.test(userText)) {
    return "I’m here with you. Breathe slowly — in for four, out for six. What would feel safest in the next minute?";
  }
  return "Thank you for sharing. This is a local demo reply (no AI chat backend). Distress phrases open AngeLifeline with the same routing policy we ship in @angelifeline/core.";
}

export function SandboxChat() {
  const [uiLocale] = useState<UiLocale>("en");
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [input, setInput] = useState("");
  const [lifeline, setLifeline] = useState<RedFlagAnalysis | null>(null);
  const [secondaryLines, setSecondaryLines] = useState<SecondaryLine[]>([]);
  const [crisisHelplines, setCrisisHelplines] =
    useState<CrisisHelplinesResult | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [telephony, setTelephony] =
    useState<DeviceTelephonyClass>("non-telephony");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTelephony(classifyDeviceTelephony(navigator.userAgent));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, lifeline]);

  function buildAnalysis(text: string): RedFlagAnalysis {
    const redFlag = analyzeForRedFlag(text);
    const keywordPlace = placeLookupFromKeywords(text);
    const liveEvent = resolveLiveEventLookup(text);
    const regionHint =
      extractRegionHint(text) ??
      keywordPlace?.fallbackRegionHint ??
      liveEvent?.event.fallbackRegionHint;
    const emergencyRegion =
      inferEmergencyRegion(text) ??
      emergencyRegionFromRegionHint(regionHint) ??
      keywordPlace?.fallbackEmergencyRegion ??
      liveEvent?.event.fallbackEmergencyRegion;
    const locationKnown = hasLocationContext({
      chatSnippet: text,
      regionHint,
      emergencyRegion,
    });
    return {
      ...redFlag,
      regionHint,
      emergencyRegion,
      locationKnown,
      crisisFocus: inferCrisisFocus(text),
    };
  }

  async function openLifeline(analysis: RedFlagAnalysis, chatSnippet: string) {
    setLifeline(analysis);
    setCrisisHelplines(null);

    const skipVenue =
      analysis.crisisFocus === "suicide" &&
      !hasResolvablePlaceHint(chatSnippet);

    if (skipVenue) {
      setSecondaryLines([]);
      setResolvingLocation(false);
    } else {
      setResolvingLocation(true);
      const result = await resolveSecondaryLines({ chatSnippet });
      setSecondaryLines(result.lines);
      setResolvingLocation(false);
      if (result.resolved?.regionHint || result.resolved?.countryCode) {
        setLifeline((prev) =>
          prev
            ? {
                ...prev,
                regionHint: result.resolved?.regionHint ?? prev.regionHint,
                countryCode: result.resolved?.countryCode ?? prev.countryCode,
                emergencyNumber:
                  result.resolved?.emergencyNumber ?? prev.emergencyNumber,
                emergencyRegion:
                  result.resolved?.emergencyRegion ?? prev.emergencyRegion,
                locationKnown: true,
              }
            : prev,
        );
      }
    }

    if (
      analysis.crisisFocus === "suicide" ||
      analysis.crisisFocus === "mixed"
    ) {
      const helplines = await fetchCrisisHelplines({
        chatSnippet,
        regionHint: analysis.regionHint,
        emergencyRegion: analysis.emergencyRegion,
        crisisFocus: analysis.crisisFocus,
        uiLocale,
      });
      setCrisisHelplines(helplines);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const analysis = buildAnalysis(text);
    const triage = await fetchCrisisTriage({
      lastUserText: text,
      chatSnippet: text,
    });

    if (triage?.hardCrisis) {
      void openLifeline(
        {
          ...analysis,
          triggered: true,
          highSeverity: true,
          crisisFocus: triage.crisisFocus,
        },
        text,
      );
      return;
    }

    if (analysis.triggered && analysis.highSeverity) {
      void openLifeline(analysis, text);
      return;
    }

    const reply: Message = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: simulateReply(text),
    };
    setMessages((prev) => [...prev, reply]);

    if (analysis.triggered && !analysis.highSeverity) {
      setTimeout(() => void openLifeline(analysis, text), 400);
    }
  }

  const blurred = lifeline !== null;

  return (
    <div className="relative flex min-h-[100dvh] flex-col text-fog">
      <AmbientBackground />

      <header className="relative z-10 border-b border-line/80 px-5 py-4 md:px-8">
        <p className="font-[family-name:var(--font-cormorant)] text-xl tracking-[0.12em] text-fog md:text-2xl">
          AngeLifeline
        </p>
      </header>

      <main
        className={`relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 transition-all duration-700 md:px-8 ${
          blurred ? "pointer-events-none blur-xl" : ""
        }`}
      >
        <div className="flex-1 space-y-6 overflow-y-auto pb-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:text-base ${
                  m.role === "user"
                    ? "bg-lavender/15 text-fog ring-1 ring-lavender/30"
                    : "bg-[#f7fbff] text-mist ring-1 ring-line"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="sticky bottom-0 border-t border-line bg-night/75 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-lg"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="message-input" className="sr-only">
            Message
          </label>
          <div className="flex gap-3">
            <input
              id="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type here — demo uses live routing when API keys are set"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-[#f7fbff] px-4 py-3 text-sm text-fog placeholder:text-mist/70 focus:border-lavender/50 focus:outline-none focus:ring-1 focus:ring-lavender/30"
              autoComplete="off"
            />
            <button
              type="submit"
              className="shrink-0 rounded-2xl bg-sage/20 px-5 py-3 text-sm font-medium text-[#2d5a4c] ring-1 ring-sage/35 transition hover:bg-sage/30"
            >
              Send
            </button>
          </div>
          <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-wider text-mist/70">
            Policy: EMS from search/country · no resort POI phones · language fallbacks
          </p>
        </form>
      </main>

      {lifeline ? (
        <AngeLifelineOverlay
          uiLocale={uiLocale}
          analysis={lifeline}
          telephony={telephony}
          secondaryLines={secondaryLines}
          crisisHelplines={crisisHelplines}
          chatSnippet={messages.at(-1)?.content}
          resolvingLocation={resolvingLocation}
          onDismiss={() => {
            setLifeline(null);
            setSecondaryLines([]);
            setCrisisHelplines(null);
          }}
        />
      ) : null}
    </div>
  );
}

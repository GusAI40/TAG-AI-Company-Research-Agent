import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import Header from './components/Header';
import ResearchBriefings from './components/ResearchBriefings';
import CurationExtraction from './components/CurationExtraction';
import ResearchQueries from './components/ResearchQueries';
import ResearchStatus from './components/ResearchStatus';
import ResearchReport from './components/ResearchReport';
import ResearchForm from './components/ResearchForm';
import {
  ResearchStatus as ResearchStatusType,
  ResearchOutput,
  DocCount,
  DocCounts,
  EnrichmentCounts,
  ResearchState,
  GlassStyle,
  AnimationStyle
} from './types';

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const rawWsUrl = import.meta.env.VITE_WS_URL as string | undefined;

// Debug logging for environment variables
console.log("Debug - Environment Variables:");
console.log("VITE_API_URL:", rawApiUrl);
console.log("VITE_WS_URL:", rawWsUrl);

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const ensureLeadingSlash = (value: string) =>
  value.startsWith("/") ? value : `/${value}`;

const joinUrl = (base: string, path: string) => {
  if (!path) return stripTrailingSlash(base);
  const cleanBase = stripTrailingSlash(base || "");
  const cleanPath = ensureLeadingSlash(path);
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
};

const isBrowser = typeof window !== 'undefined';

const getBrowserFallbacks = () => {
  if (!isBrowser) {
    return { http: "", ws: "" };
  }

  const httpOrigin = stripTrailingSlash(window.location.origin);
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsOrigin = `${wsProtocol}//${window.location.host}`;

  return {
    http: httpOrigin,
    ws: stripTrailingSlash(wsOrigin)
  };
};

const browserFallbacks = getBrowserFallbacks();

const toAbsoluteUrl = (value: string) => {
  try {
    return new URL(value);
  } catch (error) {
    if (isBrowser) {
      try {
        return new URL(value, window.location.origin);
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
};

const getUrlHost = (value: string) => {
  const parsed = toAbsoluteUrl(value);
  return parsed ? parsed.host : "";
};

const normalizeHttpBase = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return stripTrailingSlash(fallback);

  if (/^https?:\/\//i.test(trimmed)) {
    return stripTrailingSlash(trimmed);
  }

  if (trimmed.startsWith('//')) {
    const protocol = isBrowser ? window.location.protocol : 'https:';
    return stripTrailingSlash(`${protocol}${trimmed}`);
  }

  const protocol = isBrowser ? window.location.protocol : 'https:';
  return stripTrailingSlash(`${protocol}//${trimmed}`);
};

const normalizeWsBase = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return stripTrailingSlash(fallback);

  if (/^wss?:\/\//i.test(trimmed)) {
    return stripTrailingSlash(trimmed);
  }

  if (trimmed.startsWith('//')) {
    const protocol = isBrowser && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return stripTrailingSlash(`${protocol}${trimmed}`);
  }

  const protocol = isBrowser && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return stripTrailingSlash(`${protocol}//${trimmed}`);
};

// Define writing animation
const writingAnimation = `
@keyframes writing {
  0% { width: 0; }
  100% { width: 100%; }
}

.writing-animation {
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid;
  animation: writing 1.5s steps(40, end) forwards,
            blink-caret 0.75s step-end infinite;
}

@keyframes blink-caret {
  from, to { border-color: transparent; }
  50% { border-color: #0078D2; }
}
`;

// Add this near your other styles at the top of the file
const colorAnimation = `
@keyframes colorTransition {
  0% { stroke: #0078D2; }
  25% { stroke: #ffffff; }
  50% { stroke: #8A1C33; }
  75% { stroke: #d9d9d9; }
  100% { stroke: #0078D2; }
}

.animate-colors {
  animation: colorTransition 8s ease-in-out infinite;
  animation-fill-mode: forwards;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Add transition for smoother color changes */
.loader-icon {
  transition: stroke 1s ease-in-out;
}
`;

// Add this right after the writingAnimation style
const colorStyle = document.createElement('style');
colorStyle.textContent = colorAnimation;
document.head.appendChild(colorStyle);

// Apply writing animation style
const writingStyle = document.createElement('style');
writingStyle.textContent = writingAnimation;
document.head.appendChild(writingStyle);

// Add DM Sans font import
const dmSansStyle = document.createElement('style');
dmSansStyle.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  
  /* Apply DM Sans globally */
  body {
    font-family: 'DM Sans', sans-serif;
  }
`;
document.head.appendChild(dmSansStyle);

function App() {

  const bypassStorageKey = 'pitchguard.vercelBypassToken';
  const [apiBase, setApiBase] = useState(() => normalizeHttpBase(rawApiUrl, browserFallbacks.http));
  const [wsBase, setWsBase] = useState(() => normalizeWsBase(rawWsUrl, browserFallbacks.ws));
  const fallbackOriginsRef = useRef(browserFallbacks);
  const usingFallbackRef = useRef({
    api: !rawApiUrl,
    ws: !rawWsUrl,
  });

  const [vercelBypassToken, setVercelBypassToken] = useState<string>(() => {
    if (!isBrowser) return '';
    return window.localStorage.getItem(bypassStorageKey) ?? '';
  });
  const [bypassInputValue, setBypassInputValue] = useState<string>(() => {
    if (!isBrowser) return '';
    return window.localStorage.getItem(bypassStorageKey) ?? '';
  });
  const [vercelBypassStatus, setVercelBypassStatus] = useState<string | null>(null);
  const bypassAppliedRef = useRef<Map<string, string>>(new Map());

  const getActiveApiBase = () => {
    if (usingFallbackRef.current.api && isBrowser) {
      return fallbackOriginsRef.current.http;
    }
    return apiBase;
  };

  const getActiveWsBase = () => {
    if (usingFallbackRef.current.ws && isBrowser) {
      return fallbackOriginsRef.current.ws;
    }
    return wsBase;
  };

  useEffect(() => {
    if (!isBrowser) return;
    if (vercelBypassToken) {
      window.localStorage.setItem(bypassStorageKey, vercelBypassToken);
    } else {
      window.localStorage.removeItem(bypassStorageKey);
    }
  }, [vercelBypassToken]);

  const switchToBrowserFallback = () => {
    if (!isBrowser) {
      return false;
    }

    const { http, ws } = fallbackOriginsRef.current;
    let switched = false;

    if (!usingFallbackRef.current.api) {
      usingFallbackRef.current.api = true;
      setApiBase(http);
      switched = true;
    }

    if (!usingFallbackRef.current.ws) {
      usingFallbackRef.current.ws = true;
      setWsBase(ws);
      switched = true;
    }

    if (switched) {
      console.warn("Switching to browser origin for API/WebSocket requests");
    }

    return switched;
  };

  const applyVercelBypassCookie = async (targetUrl: string, token: string) => {
    if (!isBrowser || !token) {
      return false;
    }

    const parsedTarget = toAbsoluteUrl(targetUrl);
    if (!parsedTarget) {
      return false;
    }

    const origin = parsedTarget.origin;
    const previousToken = bypassAppliedRef.current.get(origin);

    if (previousToken === token) {
      return true;
    }

    const bypassUrl = `${origin}/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(bypassUrl, {
        credentials: 'include',
        mode: 'cors',
      });

      if (response.ok) {
        bypassAppliedRef.current.set(origin, token);
        return true;
      }

      console.warn('Bypass cookie request failed with status', response.status);
      bypassAppliedRef.current.delete(origin);
      return false;
    } catch (error) {
      console.warn('Bypass cookie request error', error);
      bypassAppliedRef.current.delete(origin);
      return false;
    }
  };

  const buildRequestInit = (baseInit: RequestInit | undefined, includeCredentials: boolean) => {
    if (!includeCredentials) {
      return baseInit;
    }

    const nextInit: RequestInit = { ...(baseInit ?? {}) };
    nextInit.credentials = (baseInit?.credentials ?? 'include') as RequestCredentials;
    return nextInit;
  };

  const isVercelProtectionText = (text: string) =>
    /x-vercel-protection-bypass/i.test(text) || /Authentication Required/i.test(text);

  const handleProtectedResponse = async (
    response: Response,
    url: string,
    baseInit?: RequestInit
  ): Promise<Response> => {
    if (response.status !== 401) {
      return response;
    }

    const errorText = await response.clone().text().catch(() => '');

    if (!isVercelProtectionText(errorText)) {
      return response;
    }

    const hostLabel = getUrlHost(url);

    if (!vercelBypassToken) {
      setVercelBypassStatus(
        hostLabel
          ? `Protected deployment detected at ${hostLabel}. Enter a Vercel bypass token below to continue.`
          : 'Protected deployment detected. Enter a Vercel bypass token below to continue.'
      );
      return response;
    }

    const applied = await applyVercelBypassCookie(url, vercelBypassToken);

    if (!applied) {
      setVercelBypassStatus(
        hostLabel
          ? `Unable to apply bypass token for ${hostLabel}. Confirm the token and try again.`
          : 'Unable to apply bypass token. Confirm the token and try again.'
      );
      return response;
    }

    setVercelBypassStatus(
      hostLabel
        ? `Bypass token accepted for ${hostLabel}. Retrying request...`
        : 'Bypass token accepted. Retrying request...'
    );

    const retryInit = buildRequestInit(baseInit, true);
    const retryResponse = await fetch(url, retryInit);

    if (retryResponse.ok) {
      setVercelBypassStatus(
        hostLabel ? `Bypass token active for ${hostLabel}.` : 'Bypass token active.'
      );
      return retryResponse;
    }

    if (retryResponse.status === 401) {
      const retryText = await retryResponse.clone().text().catch(() => '');
      if (isVercelProtectionText(retryText)) {
        setVercelBypassStatus(
          hostLabel
            ? `Bypass token was rejected for ${hostLabel}. Confirm the token and try again.`
            : 'Bypass token was rejected. Confirm the token and try again.'
        );
      }
    }

    return retryResponse;
  };

  const fetchWithAutoFallback = async (path: string, init?: RequestInit) => {
    const activeApiBase = getActiveApiBase();
    const targetUrl = joinUrl(activeApiBase, path);
    const shouldForceCredentials =
      isBrowser && usingFallbackRef.current.api && activeApiBase === browserFallbacks.http;

    const includeCredentials = shouldForceCredentials || Boolean(vercelBypassToken);

    const requestInit = buildRequestInit(init, includeCredentials);

    console.log("Issuing request to:", targetUrl);

    try {
      const response = await fetch(targetUrl, requestInit);
      return handleProtectedResponse(response, targetUrl, requestInit);
    } catch (error) {
      console.warn("Fetch failed for URL:", targetUrl, error);
      if (error instanceof TypeError && switchToBrowserFallback()) {
        const fallbackApiBase = getActiveApiBase();
        const fallbackUrl = joinUrl(fallbackApiBase, path);
        const fallbackShouldForceCredentials =
          isBrowser && usingFallbackRef.current.api && fallbackApiBase === browserFallbacks.http;
        const fallbackIncludeCredentials = fallbackShouldForceCredentials || Boolean(vercelBypassToken);
        const fallbackInit = buildRequestInit(init, fallbackIncludeCredentials);
        console.log("Retrying request with fallback origin:", fallbackUrl);
        const fallbackResponse = await fetch(fallbackUrl, fallbackInit);
        return handleProtectedResponse(fallbackResponse, fallbackUrl, fallbackInit);
      }
      throw error;
    }
  };

  const interpretErrorResponse = async (response: Response) => {
    const errorText = await response.clone().text().catch(() => '');
    console.log("Error response:", errorText);

    if (response.status === 401) {
      const isVercelProtection = /x-vercel-protection-bypass/i.test(errorText) || /Authentication Required/i.test(errorText);
      if (isVercelProtection) {
        return new Error(
          "This deployment is protected. Enter a Vercel bypass token in the access panel above or configure VITE_API_URL/VITE_WS_URL to a reachable backend."
        );
      }
      return new Error("Authentication failed. Please verify your credentials or bypass token.");
    }

    if (response.status === 404) {
      return new Error("The requested endpoint was not found on the research service.");
    }

    if (response.status >= 500) {
      return new Error("The research service encountered an internal error. Please try again shortly.");
    }

    if (errorText) {
      return new Error(errorText);
    }

    return new Error(`Request failed with status ${response.status}`);
  };

  useEffect(() => {
    if (!isBrowser) return;
    console.log("Active API base:", getActiveApiBase() || '(relative origin)');
  }, [apiBase]);

  useEffect(() => {
    if (!isBrowser) return;
    console.log("Active WS base:", getActiveWsBase() || '(relative origin)');
  }, [wsBase]);

  const [isResearching, setIsResearching] = useState(false);
  const [status, setStatus] = useState<ResearchStatusType | null>(null);
  const [output, setOutput] = useState<ResearchOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasFinalReport, setHasFinalReport] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 3;
  const reconnectDelay = 2000; // 2 seconds
  const [researchState, setResearchState] = useState<ResearchState>({
    status: "idle",
    message: "",
    queries: [],
    streamingQueries: {},
    briefingStatus: {
      company: false,
      industry: false,
      financial: false,
      news: false
    }
  });
  const [originalCompanyName, setOriginalCompanyName] = useState<string>("");

  // Add ref for status section
  const statusRef = useRef<HTMLDivElement>(null);

  // Add state to track initial scroll
  const [hasScrolledToStatus, setHasScrolledToStatus] = useState(false);

  // Modify the scroll helper function
  const scrollToStatus = () => {
    if (!hasScrolledToStatus && statusRef.current) {
      const yOffset = -20; // Reduced negative offset to scroll further down
      const y = statusRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      setHasScrolledToStatus(true);
    }
  };

  // Add new state for query section collapse
  const [isQueriesExpanded, setIsQueriesExpanded] = useState(true);
  const [shouldShowQueries, setShouldShowQueries] = useState(false);
  
  // Add new state for tracking search phase
  const [isSearchPhase, setIsSearchPhase] = useState(false);

  // Add state for section collapse
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(true);
  const [isEnrichmentExpanded, setIsEnrichmentExpanded] = useState(true);

  // Add state for phase tracking
  const [currentPhase, setCurrentPhase] = useState<'search' | 'enrichment' | 'briefing' | 'complete' | null>(null);

  // Add new state for PDF generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [, setPdfUrl] = useState<string | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Add new state for color cycling
  const [loaderColor, setLoaderColor] = useState("#0078D2");
  
  // Add useEffect for color cycling
  useEffect(() => {
    if (!isResearching) return;
    
    const colors = [
      "#0078D2", // Bright blue
      "#ffffff", // White
      "#8A1C33", // Crimson
      "#d9d9d9", // Light gray
    ];
    
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % colors.length;
      setLoaderColor(colors[currentIndex]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isResearching]);

  const handleBypassInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBypassInputValue(event.target.value);
  };

  const handleClearBypassToken = () => {
    setBypassInputValue('');
    setVercelBypassToken('');
    bypassAppliedRef.current.clear();
    setVercelBypassStatus('Bypass token cleared.');
  };

  const handleBypassTokenSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedToken = bypassInputValue.trim();
    setVercelBypassToken(trimmedToken);
    bypassAppliedRef.current.clear();

    if (!trimmedToken) {
      setVercelBypassStatus('Bypass token cleared.');
      return;
    }

    const activeBase = getActiveApiBase() || browserFallbacks.http;
    const targetBase = activeBase || (isBrowser ? window.location.origin : '');

    if (!targetBase) {
      setVercelBypassStatus('Unable to determine the active API host.');
      return;
    }

    const applied = await applyVercelBypassCookie(targetBase, trimmedToken);
    const hostLabel = getUrlHost(targetBase);

    if (applied) {
      setVercelBypassStatus(
        hostLabel ? `Bypass token active for ${hostLabel}.` : 'Bypass token active.'
      );
    } else {
      setVercelBypassStatus(
        hostLabel
          ? `Unable to apply bypass token for ${hostLabel}. Confirm the token and try again.`
          : 'Unable to apply bypass token. Confirm the token and try again.'
      );
    }
  };

  const resetResearch = () => {
    setIsResetting(true);

    // Use setTimeout to create a smooth transition
    setTimeout(() => {
      setStatus(null);
      setOutput(null);
      setError(null);
      setIsComplete(false);
      setResearchState({
        status: "idle",
        message: "",
        queries: [],
        streamingQueries: {},
        briefingStatus: {
          company: false,
          industry: false,
          financial: false,
          news: false
        }
      });
      setPdfUrl(null);
      setCurrentPhase(null);
      setIsSearchPhase(false);
      setShouldShowQueries(false);
      setIsQueriesExpanded(true);
      setIsBriefingExpanded(true);
      setIsEnrichmentExpanded(true);
      setIsResetting(false);
      setHasScrolledToStatus(false); // Reset scroll flag when resetting research
    }, 300); // Match this with CSS transition duration
  };

  const connectWebSocket = (jobId: string) => {
    console.log("Initializing WebSocket connection for job:", jobId);

    const wsUrl = joinUrl(getActiveWsBase(), `/research/ws/${jobId}`);

    console.log("Connecting to WebSocket URL:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connection established for job:", jobId);
        setReconnectAttempts(0);
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", {
          jobId,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        });

        if (isResearching && !hasFinalReport) {
          // Start polling for final report
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(() => checkForFinalReport(jobId), 5000);
          }

          // Attempt reconnection if we haven't exceeded max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
            setTimeout(() => {
              setReconnectAttempts(prev => prev + 1);
              connectWebSocket(jobId);
            }, reconnectDelay);
          } else {
            console.log("Max reconnection attempts reached");
            setError("Connection lost. Checking for final report...");
            // Keep polling for final report
          }
        } else if (isResearching) {
          setError("Research connection lost. Please try again.");
          setIsResearching(false);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", {
          jobId,
          error: event,
          timestamp: new Date().toISOString(),
          readyState: ws.readyState,
          url: wsUrl
        });
        if (switchToBrowserFallback()) {
          console.log("Retrying WebSocket connection using fallback origin");
          ws.close(1012, "Retrying with fallback origin");
          connectWebSocket(jobId);
          return;
        }
        setError("WebSocket connection error - Check browser console for details");
        setIsResearching(false);
      };

      ws.onmessage = (event) => {
        const rawData = JSON.parse(event.data);

        if (rawData.type === "status_update") {
          const statusData = rawData.data;

          // Handle phase transitions
          if (statusData.result?.step) {
            const step = statusData.result.step;
            if (step === "Search" && currentPhase !== 'search') {
              setCurrentPhase('search');
              setIsSearchPhase(true);
              setShouldShowQueries(true);
              setIsQueriesExpanded(true);
            } else if (step === "Enriching" && currentPhase !== 'enrichment') {
              setCurrentPhase('enrichment');
              setIsSearchPhase(false);
              setIsQueriesExpanded(false);
              setIsEnrichmentExpanded(true);
            } else if (step === "Briefing" && currentPhase !== 'briefing') {
              setCurrentPhase('briefing');
              setIsEnrichmentExpanded(false);
              setIsBriefingExpanded(true);
            }
          }

          // Handle completion
          if (statusData.status === "completed") {
            setCurrentPhase('complete');
            setIsComplete(true);
            setIsResearching(false);
            setStatus({
              step: "Complete",
              message: "Research completed successfully"
            });
            setOutput({
              summary: "",
              details: {
                report: statusData.result.report,
              },
            });
            setHasFinalReport(true);
            
            // Clear polling interval if it exists
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }

          // Set search phase when first query starts generating
          if (statusData.status === "query_generating" && !isSearchPhase) {
            setIsSearchPhase(true);
            setShouldShowQueries(true);
            setIsQueriesExpanded(true);
          }
          
          // End search phase and start enrichment when moving to next step
          if (statusData.result?.step && statusData.result.step !== "Search") {
            if (isSearchPhase) {
              setIsSearchPhase(false);
              // Add delay before collapsing queries
              setTimeout(() => {
                setIsQueriesExpanded(false);
              }, 1000);
            }
            
            // Handle enrichment phase
            if (statusData.result.step === "Enriching") {
              setIsEnrichmentExpanded(true);
              // Collapse enrichment section when complete
              if (statusData.status === "enrichment_complete") {
                setTimeout(() => {
                  setIsEnrichmentExpanded(false);
                }, 1000);
              }
            }
            
            // Handle briefing phase
            if (statusData.result.step === "Briefing") {
              setIsBriefingExpanded(true);
              if (statusData.status === "briefing_complete" && statusData.result?.category) {
                // Update briefing status
                setResearchState((prev) => {
                  const newBriefingStatus = {
                    ...prev.briefingStatus,
                    [statusData.result.category]: true
                  };
                  
                  // Check if all briefings are complete
                  const allBriefingsComplete = Object.values(newBriefingStatus).every(status => status);
                  
                  // Only collapse when all briefings are complete
                  if (allBriefingsComplete) {
                    setTimeout(() => {
                      setIsBriefingExpanded(false);
                    }, 2000);
                  }
                  
                  return {
                    ...prev,
                    briefingStatus: newBriefingStatus
                  };
                });
              }
            }
          }

          // Handle enrichment-specific updates
          if (statusData.result?.step === "Enriching") {
            
            // Initialize enrichment counts when starting a category
            if (statusData.status === "category_start") {
              const category = statusData.result.category as keyof EnrichmentCounts;
              if (category) {
                setResearchState((prev) => ({
                  ...prev,
                  enrichmentCounts: {
                    ...prev.enrichmentCounts,
                    [category]: {
                      total: statusData.result.count || 0,
                      enriched: 0
                    }
                  } as EnrichmentCounts
                }));
              }
            }
            // Update enriched count when a document is processed
            else if (statusData.status === "extracted") {
              const category = statusData.result.category as keyof EnrichmentCounts;
              if (category) {
                setResearchState((prev) => {
                  const currentCounts = prev.enrichmentCounts?.[category];
                  if (currentCounts) {
                    return {
                      ...prev,
                      enrichmentCounts: {
                        ...prev.enrichmentCounts,
                        [category]: {
                          ...currentCounts,
                          enriched: Math.min(currentCounts.enriched + 1, currentCounts.total)
                        }
                      } as EnrichmentCounts
                    };
                  }
                  return prev;
                });
              }
            }
            // Handle extraction errors
            else if (statusData.status === "extraction_error") {
              const category = statusData.result.category as keyof EnrichmentCounts;
              if (category) {
                setResearchState((prev) => {
                  const currentCounts = prev.enrichmentCounts?.[category];
                  if (currentCounts) {
                    return {
                      ...prev,
                      enrichmentCounts: {
                        ...prev.enrichmentCounts,
                        [category]: {
                          ...currentCounts,
                          total: Math.max(0, currentCounts.total - 1)
                        }
                      } as EnrichmentCounts
                    };
                  }
                  return prev;
                });
              }
            }
            // Update final counts when a category is complete
            else if (statusData.status === "category_complete") {
              const category = statusData.result.category as keyof EnrichmentCounts;
              if (category) {
                setResearchState((prev) => ({
                  ...prev,
                  enrichmentCounts: {
                    ...prev.enrichmentCounts,
                    [category]: {
                      total: statusData.result.total || 0,
                      enriched: statusData.result.enriched || 0
                    }
                  } as EnrichmentCounts
                }));
              }
            }
          }

          // Handle curation-specific updates
          if (statusData.result?.step === "Curation") {
            
            // Initialize doc counts when curation starts
            if (statusData.status === "processing" && statusData.result.doc_counts) {
              setResearchState((prev) => ({
                ...prev,
                docCounts: statusData.result.doc_counts as DocCounts
              }));
            }
            // Update initial count for a category
            else if (statusData.status === "category_start") {
              const docType = statusData.result?.doc_type as keyof DocCounts;
              if (docType) {
                setResearchState((prev) => ({
                  ...prev,
                  docCounts: {
                    ...prev.docCounts,
                    [docType]: {
                      initial: statusData.result.initial_count,
                      kept: 0
                    } as DocCount
                  } as DocCounts
                }));
              }
            }
            // Increment the kept count for a specific category
            else if (statusData.status === "document_kept") {
              const docType = statusData.result?.doc_type as keyof DocCounts;
              setResearchState((prev) => {
                if (docType && prev.docCounts?.[docType]) {
                  return {
                    ...prev,
                    docCounts: {
                      ...prev.docCounts,
                      [docType]: {
                        initial: prev.docCounts[docType].initial,
                        kept: prev.docCounts[docType].kept + 1
                      }
                    } as DocCounts
                  };
                }
                return prev;
              });
            }
            // Update final doc counts when curation is complete
            else if (statusData.status === "curation_complete" && statusData.result.doc_counts) {
              setResearchState((prev) => ({
                ...prev,
                docCounts: statusData.result.doc_counts as DocCounts
              }));
            }
          }

          // Handle briefing status updates
          if (statusData.status === "briefing_start") {
            setStatus({
              step: "Briefing",
              message: statusData.message
            });
          } else if (statusData.status === "briefing_complete" && statusData.result?.category) {
            const category = statusData.result.category;
            setResearchState((prev) => ({
              ...prev,
              briefingStatus: {
                ...prev.briefingStatus,
                [category]: true
              }
            }));
          }

          // Handle query updates
          if (statusData.status === "query_generating") {
            setResearchState((prev) => {
              const key = `${statusData.result.category}-${statusData.result.query_number}`;
              return {
                ...prev,
                streamingQueries: {
                  ...prev.streamingQueries,
                  [key]: {
                    text: statusData.result.query,
                    number: statusData.result.query_number,
                    category: statusData.result.category,
                    isComplete: false
                  }
                }
              };
            });
          } else if (statusData.status === "query_generated") {
            setResearchState((prev) => {
              // Remove from streaming queries and add to completed queries
              const key = `${statusData.result.category}-${statusData.result.query_number}`;
              const { [key]: _, ...remainingStreamingQueries } = prev.streamingQueries;
              
              return {
                ...prev,
                streamingQueries: remainingStreamingQueries,
                queries: [
                  ...prev.queries,
                  {
                    text: statusData.result.query,
                    number: statusData.result.query_number,
                    category: statusData.result.category,
                  },
                ],
              };
            });
          }
          // Handle report streaming
          else if (statusData.status === "report_chunk") {
            setOutput((prev) => ({
              summary: "Generating report...",
              details: {
                report: prev?.details?.report
                  ? prev.details.report + statusData.result.chunk
                  : statusData.result.chunk,
              },
            }));
          }
          // Handle other status updates
          else if (statusData.status === "processing") {
            setIsComplete(false);
            // Only update status.step if we're not in curation or the new step is curation
            if (!status?.step || status.step !== "Curation" || statusData.result?.step === "Curation") {
              setStatus({
                step: statusData.result?.step || "Processing",
                message: statusData.message || "Processing...",
              });
            }
            
            // Reset briefing status when starting a new research
            if (statusData.result?.step === "Briefing") {
              setResearchState((prev) => ({
                ...prev,
                briefingStatus: {
                  company: false,
                  industry: false,
                  financial: false,
                  news: false
                }
              }));
            }
            
            scrollToStatus();
          } else if (
            statusData.status === "failed" ||
            statusData.status === "error" ||
            statusData.status === "website_error"
          ) {
            setError(statusData.error || statusData.message || "Research failed");
            if (statusData.status === "website_error" && statusData.result?.continue_research) {
            } else {
              setIsResearching(false);
              setIsComplete(false);
            }
          }
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      setError(`Failed to establish WebSocket connection: ${error}`);
      setIsResearching(false);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Create a custom handler for the form that receives form data
  const handleFormSubmit = async (formData: {
    companyName: string;
    companyUrl: string;
    companyHq: string;
    companyIndustry: string;
  }) => {

    // Clear any existing errors first
    setError(null);

    // If research is complete, reset the UI first
    if (isComplete) {
      resetResearch();
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for reset animation
    }

    // Reset states
    setHasFinalReport(false);
    setReconnectAttempts(0);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsResearching(true);
    setOriginalCompanyName(formData.companyName);
    setHasScrolledToStatus(false); // Reset scroll flag when starting new research

    try {
      const requestPath = '/research';

      // Format the company URL if provided
      const formattedCompanyUrl = formData.companyUrl
        ? formData.companyUrl.startsWith('http://') || formData.companyUrl.startsWith('https://')
          ? formData.companyUrl
          : `https://${formData.companyUrl}`
        : undefined;

      // Log the request details
      const requestData = {
        company: formData.companyName,
        company_url: formattedCompanyUrl,
        industry: formData.companyIndustry || undefined,
        hq_location: formData.companyHq || undefined,
      };

      const response = await fetchWithAutoFallback(requestPath, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      }).catch((error) => {
        console.error("Fetch error:", error);
        throw error;
      });

      console.log("Response received:", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      if (!response.ok) {
        throw await interpretErrorResponse(response);
      }

      const data = await response.json();
      console.log("Response data:", data);

      if (data.job_id) {
        console.log("Connecting WebSocket with job_id:", data.job_id);
        connectWebSocket(data.job_id);
      } else {
        throw new Error("No job ID received");
      }
    } catch (err) {
      console.log("Caught error:", err);
      let message = "Failed to start research";
      if (err instanceof TypeError) {
        message = "Unable to reach the research service. Please verify your connection or API URL.";
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setIsResearching(false);
    }
  };

  // Add new function to handle PDF generation
  const handleGeneratePdf = async () => {
    if (!output || isGeneratingPdf) return;
    
    setIsGeneratingPdf(true);
    try {
      console.log("Generating PDF with company name:", originalCompanyName);
      const response = await fetchWithAutoFallback('/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_content: output.details.report,
          company_name: originalCompanyName || output.details.report
        }),
      });

      if (!response.ok) {
        throw await interpretErrorResponse(response);
      }


      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `${originalCompanyName || 'research_report'}.pdf`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (error instanceof TypeError) {
        setError("Unable to reach the PDF service. Please try again once the connection is restored.");
      } else {
        setError(error instanceof Error ? error.message : 'Failed to generate PDF');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Add new function to handle copying to clipboard
  const handleCopyToClipboard = async () => {
    if (!output?.details?.report) return;
    
    try {
      await navigator.clipboard.writeText(output.details.report);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError('Failed to copy to clipboard');
    }
  };

  // Add document count display component

  // Add BriefingProgress component

  // Add EnrichmentProgress component

  // Add these styles at the top of the component, before the return statement
  const glassSurface = "equilibrium-card text-white";
  const glassStyle: GlassStyle = {
    base: glassSurface,
    card: glassSurface,
    input: "equilibrium-input"
  };

  // Add these to your existing styles
  const fadeInAnimation: AnimationStyle = {
    fadeIn: "transition-all duration-300 ease-in-out",
    writing: writingAnimation,
    colorTransition: colorAnimation
  };

  // Function to render progress components in order
  const renderProgressComponents = () => {
    const components = [];

    // Research Report (always at the top when available)
    if (output && output.details) {
      components.push(
        <ResearchReport
          key="report"
          output={{
            summary: output.summary,
            details: {
              report: output.details.report || ''
            }
          }}
          isResetting={isResetting}
          glassStyle={glassStyle}
          fadeInAnimation={fadeInAnimation}
          loaderColor={loaderColor}
          isGeneratingPdf={isGeneratingPdf}
          isCopied={isCopied}
          onCopyToClipboard={handleCopyToClipboard}
          onGeneratePdf={handleGeneratePdf}
        />
      );
    }

    // Current phase component
    if (currentPhase === 'briefing' || (currentPhase === 'complete' && researchState.briefingStatus)) {
      components.push(
        <ResearchBriefings
          key="briefing"
          briefingStatus={researchState.briefingStatus}
          isExpanded={isBriefingExpanded}
          onToggleExpand={() => setIsBriefingExpanded(!isBriefingExpanded)}
          isResetting={isResetting}
        />
      );
    }

    if (currentPhase === 'enrichment' || currentPhase === 'briefing' || currentPhase === 'complete') {
      components.push(
        <CurationExtraction
          key="enrichment"
          enrichmentCounts={researchState.enrichmentCounts}
          isExpanded={isEnrichmentExpanded}
          onToggleExpand={() => setIsEnrichmentExpanded(!isEnrichmentExpanded)}
          isResetting={isResetting}
          loaderColor={loaderColor}
        />
      );
    }

    // Queries are always at the bottom when visible
    if (shouldShowQueries && (researchState.queries.length > 0 || Object.keys(researchState.streamingQueries).length > 0)) {
      components.push(
        <ResearchQueries
          key="queries"
          queries={researchState.queries}
          streamingQueries={researchState.streamingQueries}
          isExpanded={isQueriesExpanded}
          onToggleExpand={() => setIsQueriesExpanded(!isQueriesExpanded)}
          isResetting={isResetting}
          glassStyle={glassStyle.base}
        />
      );
    }

    return components;
  };

  // Add function to check for final report
  const checkForFinalReport = async (jobId: string) => {
    try {
      const response = await fetchWithAutoFallback(`/research/status/${jobId}`);
      if (!response.ok) throw await interpretErrorResponse(response);
      
      const data = await response.json();
      
      if (data.status === "completed" && data.result?.report) {
        setOutput({
          summary: "",
          details: {
            report: data.result.report,
          },
        });
        setStatus({
          step: "Complete",
          message: "Research completed successfully"
        });
        setIsComplete(true);
        setIsResearching(false);
        setCurrentPhase('complete');
        setHasFinalReport(true);
        
        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error checking final report:', error);
    }
  };

  // Add cleanup for polling interval
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="equilibrium-bg min-h-screen overflow-hidden relative">
      <div className="equilibrium-grid" aria-hidden="true" />
      <div className="equilibrium-orbit equilibrium-orbit--left" aria-hidden="true" />
      <div className="equilibrium-orbit equilibrium-orbit--right" aria-hidden="true" />
      <div className="equilibrium-orbit equilibrium-orbit--bottom" aria-hidden="true" />

      <div className="equilibrium-shell">
        <Header glassStyle={glassStyle.card} />

        <form
          onSubmit={handleBypassTokenSubmit}
          className={`${glassStyle.card} equilibrium-panel equilibrium-panel--compact space-y-4 font-['DM_Sans']`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2 md:max-w-2xl">
              <h2 className="text-lg font-semibold text-white">Protected deployment access</h2>
              <p className="text-sm text-[#D9D9D9]/80">
                If the backend is protected by Vercel deployment safeguards, paste the bypass token provided by the
                maintainer. PitchGuard will store it locally and retry requests with the required cookie.
              </p>
              <p className="text-xs text-[#D9D9D9]/70">
                Active API host:&nbsp;
                <span className="text-[#FFFFFF]">
                  {(() => {
                    const activeBase = getActiveApiBase();
                    if (activeBase) {
                      return getUrlHost(activeBase) || activeBase;
                    }
                    if (isBrowser) {
                      return window.location.host;
                    }
                    return 'local-runtime';
                  })()}
                </span>
                {usingFallbackRef.current.api ? ' (browser origin fallback)' : ''}
              </p>
              {vercelBypassStatus && (
                <p className="text-xs text-[#FFD3DC]">{vercelBypassStatus}</p>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 md:w-96">
              <input
                type="text"
                value={bypassInputValue}
                onChange={handleBypassInputChange}
                placeholder="Paste Vercel bypass token"
                className="equilibrium-input text-sm text-white placeholder:text-[#D9D9D9]/50"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="equilibrium-chip w-full justify-center gap-2 px-6 py-3 text-sm font-semibold border-[#0078D2]/45 bg-[#0078D2]/30 text-white transition-all duration-300 hover:border-[#79C1FF]/60 hover:bg-[#0078D2]/45"
                >
                  Apply token
                </button>
                {vercelBypassToken && (
                  <button
                    type="button"
                    onClick={handleClearBypassToken}
                    className="equilibrium-chip w-full justify-center gap-2 px-6 py-3 text-sm font-medium border-white/20 bg-white/5 text-[#D9D9D9] transition-all duration-300 hover:border-white/40 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        <ResearchForm
          onSubmit={handleFormSubmit}
          isResearching={isResearching}
          glassStyle={glassStyle}
          loaderColor={loaderColor}
        />

        {error && (
          <div
            className={`${glassStyle.card} equilibrium-panel equilibrium-panel--compact ${fadeInAnimation.fadeIn} ${isResetting ? 'opacity-0 transform -translate-y-4' : 'opacity-100 transform translate-y-0'} font-['DM_Sans']`}
          >
            <p className="text-[#FFD3DC]">{error}</p>
          </div>
        )}

        <ResearchStatus
          status={status}
          error={error}
          isComplete={isComplete}
          currentPhase={currentPhase}
          isResetting={isResetting}
          glassStyle={glassStyle}
          loaderColor={loaderColor}
          statusRef={statusRef}
        />

        <div className="equilibrium-stack transition-all duration-500 ease-in-out">
          {renderProgressComponents()}
        </div>
      </div>
    </div>
  );
}

export default App;

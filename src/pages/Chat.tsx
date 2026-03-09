import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useAgentsStore } from "@/stores/agents-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, StopCircle } from "lucide-react";

export function Chat() {
  const {
    tabs, activeTabIndex,
    openTab, closeTab, setActiveTab, sendMessage, abortCurrent,
    loadSessions, init,
  } = useChatStore();
  const agents = useAgentsStore((s) => s.agents);
  const agentsFetch = useAgentsStore((s) => s.fetch);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init();
    loadSessions();
    agentsFetch();
  }, []);

  const activeTab = tabs[activeTabIndex];

  const handleSend = async () => {
    if (!input.trim() || !activeTab) return;
    const msg = input;
    setInput("");
    await sendMessage(msg);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTab?.messages.length, activeTab?.streamBuffer]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b pb-2 mb-2 overflow-x-auto shrink-0">
        {tabs.map((tab, i) => (
          <div
            key={tab.sessionKey}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm cursor-pointer shrink-0 ${
              i === activeTabIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            }`}
            onClick={() => setActiveTab(i)}
          >
            <span className="truncate max-w-[120px]">{tab.agentId}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(i); }}
              className="hover:bg-muted-foreground/20 rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <select
          className="text-sm border rounded px-2 py-1.5 bg-background shrink-0"
          value=""
          onChange={(e) => {
            if (e.target.value) openTab(e.target.value);
          }}
        >
          <option value="">+ New Chat</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      {activeTab ? (
        <>
          <ScrollArea className="flex-1">
            <div className="space-y-3 px-1">
              {activeTab.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-primary/10 ml-12"
                      : "bg-muted mr-12"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              ))}
              {activeTab.streaming && activeTab.streamBuffer && (
                <div className="bg-muted mr-12 p-3 rounded-lg text-sm">
                  <div className="whitespace-pre-wrap break-words">{activeTab.streamBuffer}</div>
                  <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5" />
                </div>
              )}
              {activeTab.streaming && !activeTab.streamBuffer && (
                <div className="bg-muted mr-12 p-3 rounded-lg text-sm">
                  <span className="inline-block w-1.5 h-4 bg-foreground animate-pulse" />
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex gap-2 pt-2 border-t mt-2 shrink-0">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="resize-none min-h-[60px]"
              rows={2}
            />
            {activeTab.streaming ? (
              <Button variant="destructive" size="icon" onClick={abortCurrent} className="shrink-0">
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={handleSend} disabled={!input.trim()} className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select an agent to start chatting
        </div>
      )}
    </div>
  );
}